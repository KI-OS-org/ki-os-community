/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: pki.core.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const crypto = require('crypto');
const https = require('https');
const Telemetry = require('../core/system-view.service');
const logger = require('../core/logger.service');

// Safe Provider Import
const safeReq = (path) => { try { return require(path); } catch { return null; } };
const OpenAI = safeReq('../providers/openai.provider');

const MODULE_EMBED_CACHE = new Map();
const MAX_CACHE_SIZE = 500;

const REGION = process.env.AWS_REGION || 'eu-central-1';

let DynamoDBClient = null, DynamoDBDocumentClient = null, PutCommand = null, QueryCommand = null, GetCommand = null, UpdateCommand = null;
try {
  ({ DynamoDBClient } = require('@aws-sdk/client-dynamodb'));
  ({ DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb'));
} catch(e) {
  logger.warn('[pki.core] AWS SDK nicht installiert — DynamoDB deaktiviert');
}

let _ddb = null;
function getDdb() {
  if (!_ddb && DynamoDBDocumentClient && DynamoDBClient && (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.MEMORY_DRIVER === 'dynamodb')) {
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  }
  return _ddb;
}

async function safeFetch(url, options) {
    if (global.fetch) return global.fetch(url, options);
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: options.method, headers: options.headers }, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => resolve({ ok: res.statusCode < 300, json: () => Promise.resolve(JSON.parse(data)) }));
        });
        req.on('error', reject);
        if(options.body) req.write(options.body);
        req.end();
    });
}

class PKICore {
  constructor(config = {}) {
    this.config = {
      embeddingModel: 'text-embedding-3-small',
      profileTable: process.env.PKI_PROFILE_TABLE || 'kimba_user_profiles',
      embeddingTable: process.env.PKI_EMBEDDING_TABLE || 'kimba_embeddings',
      ...config
    };
    // FIX 2: Separate Throttles
    this.statsThrottle = new Map(); // For LastSeen (10 min)
    this.summaryThrottle = new Map(); // For Summarization (60 min)
  }

  _getId(userId, tenantId) { return `${tenantId}#${userId}`; }

  checkXSGate(memoryItem, userClearance = 'public') {
      const sensitivity = memoryItem.sensitivity || 'public';
      const levels = { 'public': 0, 'internal': 1, 'confidential': 2, 'secret': 3 };
      return (levels[userClearance] || 0) >= (levels[sensitivity] || 0);
  }

  async retrieveRelevantMemories(userId, tenantId, queryEmbedding, k = 5, userClearance = 'public') {
    const uid = this._getId(userId, tenantId);
    try {
        const res = await getDdb()?.send(new QueryCommand({
            TableName: this.config.embeddingTable,
            KeyConditionExpression: 'uid = :u',
            ExpressionAttributeValues: { ':u': uid },
            Limit: 100, ScanIndexForward: false
        }));
        if (!res.Items) return [];
        
        const scored = res.Items.map(item => ({
            ...item,
            relevanceScore: this.cosineSimilarity(queryEmbedding, item.embedding || [])
        })).sort((a,b) => b.relevanceScore - a.relevanceScore);

        return scored.filter(item => this.checkXSGate(item, userClearance)).slice(0, k);
    } catch(e) { return []; }
  }

  async arbitrateAndStore(userId, tenantId, text, category, sensitivity='internal') {
      const emb = await this.generateEmbedding(text);
      if (!emb || emb.length === 0) Telemetry.logEvent('embedding_failed', { category });

      const uid = this._getId(userId, tenantId);
      const ts = Date.now().toString();

      const item = {
          uid, ts,
          content: text,
          embedding: emb || [],
          category,
          sensitivity,
          lastUsed: ts
      };
      await getDdb()?.send(new PutCommand({ TableName: this.config.embeddingTable, Item: item }));
  }

  async getUserProfile(userId, tenantId) {
      const uid = this._getId(userId, tenantId);
      try {
          const res = await getDdb()?.send(new GetCommand({ TableName: this.config.profileTable, Key: { uid } }));
          if (res.Item) return res.Item;

          const newProfile = {
              uid,
              preferences: { language: 'de', formality: 'default', theme: 'cyan' },
              stats: { created: new Date().toISOString(), interactions: 0 },
              roles: ['user'],
              plan: 'free'
          };
          await getDdb()?.send(new PutCommand({ TableName: this.config.profileTable, Item: newProfile }));
          return newProfile;
      } catch (e) {
          return { preferences: { language: 'de' }, plan: 'free', roles: ['user'] };
      }
  }

  // FEATURE: Periodic Stats Update (Cheap)
  async updateStats(userId, tenantId) {
      const uid = this._getId(userId, tenantId);
      const now = Date.now();
      
      const lastUpdate = this.statsThrottle.get(uid) || 0;
      if (now - lastUpdate < 1000 * 60 * 10) return; // 10 Min Throttle

      try {
          await getDdb()?.send(new UpdateCommand({
              TableName: this.config.profileTable,
              Key: { uid },
              UpdateExpression: 'set stats = if_not_exists(stats, :empty), stats.lastSeen = :d, stats.interactions = if_not_exists(stats.interactions, :zero) + :inc',
              ExpressionAttributeValues: { ':d': new Date(now).toISOString(), ':inc': 1, ':zero': 0, ':empty': {} }
          }));
          this.statsThrottle.set(uid, now);
      } catch(e) { logger.warn('pki.stats.update.failed', { message: e.message }); }
  }

  // FEATURE: Consolidate Memory (Expensive - 60min Throttle)
  async consolidateMemory(userId, tenantId) {
      const uid = this._getId(userId, tenantId);
      const now = Date.now();

      const lastRun = this.summaryThrottle.get(uid) || 0;
      if (now - lastRun < 1000 * 60 * 60) return; // 60 Min Throttle

      this.summaryThrottle.set(uid, now); // Lock immediately

      try {
          // Fetch recent raw items
          const res = await getDdb()?.send(new QueryCommand({
              TableName: this.config.embeddingTable,
              KeyConditionExpression: 'uid = :u',
              ExpressionAttributeValues: { ':u': uid },
              Limit: 20, 
              ScanIndexForward: false 
          }));

          if (!res.Items || res.Items.length < 5) return;

          const chatItems = res.Items.filter(i => i.category === 'chat_history');
          if (chatItems.length < 3) return;

          const textBlock = chatItems.map(i => i.content).reverse().join('\n'); 

          if (OpenAI && process.env.OPENAI_API_KEY) {
              const summaryRes = await OpenAI.chat({
                  model: 'gemini-2.0-flash',
                  messages: [{ role: 'user', content: `Summarize context:\n${textBlock}` }],
                  temperature: 0.3
              });

              if (summaryRes.text) {
                  logger.info('pki.memory.consolidated', { message: `Consolidated Memory for ${userId}` });
                  await this.arbitrateAndStore(userId, tenantId, `[SUMMARY]: ${summaryRes.text}`, 'short_term_summary', 'internal');
              }
          }
      } catch(e) { logger.error('pki.memory.consolidation.error', { message: e.message }); }
  }

  async generateEmbedding(text) {
    if(!text) return [];
    const cacheKey = crypto.createHash('md5').update(text).digest('hex');
    if (MODULE_EMBED_CACHE.has(cacheKey)) return MODULE_EMBED_CACHE.get(cacheKey);
    try {
        const response = await safeFetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.config.embeddingModel, input: text })
        });
        if (!response.ok) return [];
        const data = await response.json();
        const vec = data.data?.[0]?.embedding || [];
        MODULE_EMBED_CACHE.set(cacheKey, vec);
        if (MODULE_EMBED_CACHE.size > MAX_CACHE_SIZE) {
            MODULE_EMBED_CACHE.delete(MODULE_EMBED_CACHE.keys().next().value);
        }
        return vec;
    } catch(e) { return []; }
  }

  cosineSimilarity(vecA, vecB) {
      if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) return 0;
      let dot = 0, magA = 0, magB = 0;
      for (let i = 0; i < vecA.length; i++) {
          const vA = vecA[i] || 0; const vB = vecB[i] || 0;
          dot += vA * vB; magA += vA * vA; magB += vB * vB;
      }
      return (magA > 0 && magB > 0) ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
  }
}
module.exports = { PKICore };
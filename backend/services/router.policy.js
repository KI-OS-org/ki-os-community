/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: router.policy.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';
let DynamoDBClient = null;
let DynamoDBDocumentClient = null;
let GetCommand = null;
let PutCommand = null;
try {
  ({ DynamoDBClient } = require('@aws-sdk/client-dynamodb'));
  ({ DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb'));
} catch {}

const logger = require('./core/logger.service');

const REGION = process.env.AWS_REGION || 'eu-central-1';
const TABLE = process.env.KIMBA_CONFIG_TABLE || 'kimba_config'; // Neue Tabelle für Configs

// Fallback, falls DB nicht erreichbar
let MEMORY_CONFIG = {
  wTrust: 0.45, wCost: 0.2, wLatency: 0.2, wContext: 0.15,
  trustGate: 0.62,
  targetMs: 3500,
  targetCpm: 8
};

// Lazy Init
let ddb;
try { if (DynamoDBDocumentClient && DynamoDBClient) ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION })); } catch(e) {}

/**
 * Lädt die aktuelle Policy aus der DB (mit kurzem Caching möglich)
 */
async function getConfig() {
    if (!ddb) return MEMORY_CONFIG;
    try {
        const res = await ddb.send(new GetCommand({
            TableName: TABLE,
            Key: { configId: 'router_policy' }
        }));
        if (res.Item && res.Item.policy) {
            MEMORY_CONFIG = { ...MEMORY_CONFIG, ...res.Item.policy };
        }
    } catch (e) {
        // Silent Fail -> Use Memory Defaults (z.B. bei erstem Start)
    }
    return MEMORY_CONFIG;
}

/**
 * Speichert Policy-Updates persistent
 */
async function updatePolicyConfig(newConfig) {
    // Merge mit bestehenden Werten
    const merged = { ...MEMORY_CONFIG, ...newConfig };
    
    // 1. Update Memory (für sofortige Wirkung in dieser Instanz)
    MEMORY_CONFIG = merged;

    // 2. Update Database (für Persistenz und andere Lambdas)
    if (ddb) {
        try {
            await ddb.send(new PutCommand({
                TableName: TABLE,
                Item: {
                    configId: 'router_policy',
                    updatedAt: new Date().toISOString(),
                    policy: merged
                }
            }));
            logger.info('router.policy.config_persisted', {});
        } catch (e) {
            logger.error('router.policy.persist_failed', { message: e.message });
        }
    }
}

function norm01(x){ if (x<0) return 0; if (x>1) return 1; return x; }

// Synchrone Scoring-Funktion (nutzt die zuletzt geladene Config)
function scoreCandidate(c, verifierConf=0.6, wantTags=[]) {
  const cfg = MEMORY_CONFIG; // Nutzung der geladenen Config
  
  const meta = c.meta || { cost_cpm: 5.0, p95_ms: 2500, strengths: [] };
  
  const sCost = norm01(cfg.targetCpm / Math.max(1e-6, meta.cost_cpm));
  const sLat  = norm01(cfg.targetMs / Math.max(1, meta.p95_ms));
  
  const sCtx = wantTags.length ? 
    (meta.strengths?.filter(s => wantTags.includes(s)).length / wantTags.length) : 0.5;
    
  const sTrust = norm01(verifierConf);

  const score = 
    cfg.wTrust * sTrust + 
    cfg.wCost * sCost + 
    cfg.wLatency * sLat + 
    cfg.wContext * sCtx;

  const trace = {
    score: Number(score.toFixed(3)),
    factors: {
        trust: { val: sTrust, w: cfg.wTrust },
        cost: { val: sCost, w: cfg.wCost, raw: meta.cost_cpm },
        latency: { val: sLat, w: cfg.wLatency, raw: meta.p95_ms },
        context: { val: sCtx, w: cfg.wContext, matches: wantTags }
    }
  };

  return { ...c, score, trace };
}

function inferContextTags(query) {
    const q = String(query).toLowerCase();
    const tags = [];
    if (/code|api|java|script/i.test(q)) tags.push('coding');
    if (/analyse|warum|begründe/i.test(q)) tags.push('reasoning');
    if (/bild|video|generiere/i.test(q)) tags.push('media');
    return tags;
}

module.exports = { 
    scoreCandidate, 
    updatePolicyConfig, 
    inferContextTags,
    getConfig 
};
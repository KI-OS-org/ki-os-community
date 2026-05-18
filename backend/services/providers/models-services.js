/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: models-services.js
 * Diese Datei lädt den Modell-Katalog für KI-OS aus Discovery, DynamoDB, lokaler Datei oder Fallback und stellt Rollenmodelle für AgentMesh bereit.
 * Sie ist die zentrale Registry-Schicht zwischen Multi-Provider-Discovery, Router und den Laufzeit-Komponenten von api.kimba.in.
 * @license AGPL-3.0-only
 */

'use strict';

let DynamoDBClient = null;
let GetItemCommand = null;
try {
  ({ DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb'));
} catch {}
const fs = require('fs');
const path = require('path');
const { discoverAllProviders } = require('./model.discovery.service');
const logger = require('../core/logger.service');

function shouldUseDdb(env = process.env) {
  if (String(env.MOCK_MODEL_CATALOG || 'false').toLowerCase() === 'true') return false;
  if (env.NODE_ENV === 'test') return false;
  if (!env.AWS_REGION && !env.AWS_DEFAULT_REGION) return false;
  return true;
}
const ddb = DynamoDBClient && shouldUseDdb() ? new DynamoDBClient({}) : null;

const CFG = {
  table: process.env.MODELS_DDB_TABLE || process.env.KIMBA_MODELS_TABLE || 'kimba_models',
  pk: process.env.MODELS_DDB_PK || 'key',
  blobAttr: process.env.MODELS_DDB_BLOB_ATTR || process.env.KIMBA_MODELS_ATTR || 'blob',
  itemKey: process.env.MODELS_DDB_ITEM_KEY || process.env.KIMBA_MODELS_KEY || 'models.json',
  ttlSec: Number(process.env.MODELS_CACHE_TTL_SEC || process.env.MODEL_DISCOVERY_CACHE_TTL_SECONDS || 900)
};

let cache = { at: 0, doc: null, version: null };

function shouldAttemptDdb(env = process.env) {
  return Boolean(DynamoDBClient && GetItemCommand && shouldUseDdb(env));
}

const nowSec = () => Math.floor(Date.now() / 1000);

const minimum = {
  version: '1.1.0-minimum',
  meta: { source: 'minimum-fallback', generatedAt: 'static' },
  roles: {
    default: { provider: 'openai', model: 'gpt-5.4', source: 'minimum' },
    fast: { provider: 'gemini', model: 'gemini-2.0-flash', source: 'minimum' },
    reasoning: { provider: 'anthropic', model: 'claude-sonnet-4-6', source: 'minimum' },
    research: { provider: 'openai', model: 'gpt-5.4', source: 'minimum' },
    code: { provider: 'anthropic', model: 'claude-sonnet-4-6', source: 'minimum' },
    low_cost: { provider: 'deepseek', model: 'deepseek-reasoner', source: 'minimum' },
    fallback: { provider: 'openrouter', model: 'openai/gpt-5.4', source: 'minimum' },
    vision: { provider: 'openai', model: 'gpt-5.4', source: 'minimum' }
  },
  providers: {
    openai: { default: 'gpt-5.4', models: { 'gpt-5.4': ['default', 'reasoning', 'research', 'vision'] } },
    anthropic: { default: 'claude-sonnet-4-6', models: { 'claude-sonnet-4-6': ['reasoning', 'code'] } },
    gemini: { default: 'gemini-2.0-flash', models: { 'gemini-2.0-flash': ['fast'] } },
    deepseek: { default: 'deepseek-reasoner', models: { 'deepseek-reasoner': ['reasoning', 'low_cost'] } },
    openrouter: { default: 'openai/gpt-5.4', models: { 'openai/gpt-5.4': ['fallback'] } }
  }
};

function readLocalFallback() {
  try {
    const p = path.join(process.cwd(), 'models.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

async function fetchFromDDB() {
  if (!ddb || !GetItemCommand) throw new Error('DynamoDB client unavailable');
  const res = await ddb.send(
    new GetItemCommand({
      TableName: CFG.table,
      Key: { [CFG.pk]: { S: CFG.itemKey } },
      ConsistentRead: true
    })
  );

  const blob = res && res.Item && res.Item[CFG.blobAttr] && res.Item[CFG.blobAttr].S;
  if (!blob) throw new Error('models.json not found in DDB');
  return JSON.parse(blob);
}

function isDiscoveryEnabled(env = process.env) {
  return String(env.MODEL_DISCOVERY_ENABLED || 'false').toLowerCase() === 'true';
}

async function tryDiscovery(options = {}) {
  const env = options.env || process.env;
  if (!isDiscoveryEnabled(env)) return null;
  const discovered = await discoverAllProviders(options);
  const hasAnyRole = Object.keys(discovered.roles || {}).length > 0;
  if (!hasAnyRole) throw new Error('model discovery returned no roles');
  return discovered;
}

async function loadModelCatalog(force = false, options = {}) {
  const fresh = cache.doc && nowSec() - cache.at < CFG.ttlSec;
  if (!force && fresh) return cache.doc;

  try {
    const discovered = await tryDiscovery(options);
    if (discovered) {
      cache = { at: nowSec(), doc: discovered, version: discovered.version || 'discovery' };
      return discovered;
    }
  } catch (e) {
    logger.warn('models.discovery_failed', { message: e.message || String(e) });
  }

  if (shouldAttemptDdb(options.env || process.env)) {
    try {
      const doc = await fetchFromDDB();
      cache = { at: nowSec(), doc, version: doc?.version || 'ddb' };
      return doc;
    } catch (e) {
      logger.warn('models.ddb_load_failed', { message: e.message || String(e) });
    }
  }

  const local = readLocalFallback();
  if (local) {
    cache = { at: nowSec(), doc: local, version: local?.version || 'local' };
    return local;
  }
  logger.warn('models.fallback_minimum', {});
  cache = { at: nowSec(), doc: minimum, version: 'minimum' };
  return minimum;
}

async function refreshModelCatalog(options = {}) {
  return loadModelCatalog(true, options);
}

function getRoleSelection(catalog, role) {
  if (catalog?.roles?.[role]?.model) return catalog.roles[role];
  if (catalog?.roles?.default?.model) return catalog.roles.default;
  return null;
}

async function resolveAgentRuntimeModels(options = {}) {
  const env = options.env || process.env;
  const plannerModel = env.AGENT_PLANNER_MODEL;
  const synthesizerModel = env.AGENT_SYNTHESIZER_MODEL;
  if (plannerModel || synthesizerModel) {
    return {
      plannerModel: plannerModel || synthesizerModel || minimum.roles.reasoning.model,
      synthesizerModel: synthesizerModel || plannerModel || minimum.roles.default.model,
      source: 'env-override'
    };
  }

  const catalog = await loadModelCatalog(false, options);
  const planner = env.AGENT_REASONING_MODEL || getRoleSelection(catalog, 'reasoning')?.model || minimum.roles.reasoning.model;
  const synthesizer = env.AGENT_RESPONSE_MODEL || getRoleSelection(catalog, 'default')?.model || minimum.roles.default.model;
  return {
    plannerModel: planner,
    synthesizerModel: synthesizer,
    source: catalog?.meta?.source || catalog?.version || 'catalog'
  };
}

function clearModelCatalogCache() {
  cache = { at: 0, doc: null, version: null };
}

module.exports = {
  loadModelCatalog,
  refreshModelCatalog,
  resolveAgentRuntimeModels,
  clearModelCatalogCache,
  isDiscoveryEnabled,
  minimum,
  getRoleSelection
};

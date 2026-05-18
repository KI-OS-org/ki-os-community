/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @file    swarm.lancedb.js
 * @desc    LanceDB-Backend für KI-OS Swarm Memory — Vektor-Suche statt Keyword-Scoring.
 * @license AGPL-3.0-only
 */
'use strict';

const crypto = require('crypto');
const path   = require('path');

let logger;
try { logger = require('../core/logger.service'); }
catch { logger = { info: () => {}, warn: () => {}, error: () => {} }; }

let lancedb = null;
try { lancedb = require('@lancedb/lancedb'); } catch {}

const LANCEDB_PATH = process.env.SWARM_LANCEDB_PATH || path.join(process.cwd(), '.ki-os-swarm-lancedb');
const TABLE_NAME   = 'swarm_memory';
const INITIAL_CONFIDENCE = 0.70;
const DECAY_FLOOR        = 0.05;

let _db    = null;
let _table = null;
let _ready = false;

async function _ensureReady() {
  if (_ready) return;
  if (!lancedb) throw new Error('LanceDB nicht installiert. npm install @lancedb/lancedb');
  _db = await lancedb.connect(LANCEDB_PATH);
  const tables = await _db.tableNames();
  if (tables.includes(TABLE_NAME)) {
    _table = await _db.openTable(TABLE_NAME);
  } else {
    const { embed } = require('./embedding.service');
    const zeroVec = Array.from(await embed('init'));
    _table = await _db.createTable(TABLE_NAME, [{
      id: '_init', text: 'schema-init', vector: zeroVec,
      confidence: 0, usageCount: 0, createdAt: 0, metadata: '{}',
    }]);
    await _table.delete('id = "_init"');
  }
  _ready = true;
}

async function store(text, metadata = {}) {
  if (!text || !String(text).trim()) throw new Error('swarm.lancedb.store: text darf nicht leer sein');
  await _ensureReady();
  const { embed } = require('./embedding.service');
  const id  = crypto.createHash('sha1').update(String(text).trim()).digest('hex').slice(0, 12);
  const now = Date.now();

  // Prüf ob Entry existiert
  let existing = null;
  try {
    const rows = await _table.query().where(`id = '${id}'`).limit(1).toArray();
    if (rows.length) existing = rows[0];
  } catch {}

  if (existing) {
    try { await _table.delete(`id = '${id}'`); } catch {}
    const updatedMeta = { ...JSON.parse(existing.metadata || '{}'), ...metadata };
    const vector = Array.from(await embed(text));
    await _table.add([{
      id, text: String(text).trim(), vector,
      confidence: existing.confidence || INITIAL_CONFIDENCE,
      usageCount: (existing.usageCount || 0) + 1,
      createdAt: existing.createdAt || now,
      metadata: JSON.stringify({ type: 'pattern', author: 'claude', sprint: 'unknown', ...updatedMeta }),
    }]);
    logger.info('swarm.lancedb.store.updated', { id });
    return { id, updated: true };
  }

  const vector = Array.from(await embed(text));
  await _table.add([{
    id, text: String(text).trim(), vector,
    confidence: INITIAL_CONFIDENCE,
    usageCount: 0,
    createdAt: now,
    metadata: JSON.stringify({ type: 'pattern', author: 'claude', sprint: 'unknown', ...metadata }),
  }]);
  logger.info('swarm.lancedb.store.created', { id });
  return { id, created: true };
}

async function retrieve(query, k = 5) {
  if (!query) return [];
  await _ensureReady();
  const { embed } = require('./embedding.service');
  const vector = Array.from(await embed(query));
  let rows = [];
  try {
    rows = await _table.vectorSearch(vector).limit(k).toArray();
  } catch {
    rows = await _table.query().limit(k * 3).toArray();
  }
  return rows.map(r => {
    let meta = {};
    try { meta = JSON.parse(r.metadata || '{}'); } catch {}
    const dist = r._distance ?? 0;
    const score = Number((1 / (1 + dist)).toFixed(4));
    return {
      id: r.id, text: r.text, score,
      effectiveConfidence: Math.max(DECAY_FLOOR, r.confidence || INITIAL_CONFIDENCE),
      usageCount: r.usageCount || 0,
      metadata: meta,
    };
  }).sort((a, b) => b.score - a.score);
}

async function retrieveAsContext(query, k = 5) {
  const results = await retrieve(query, k);
  if (results.length === 0) return '';
  const lines = results.map(r => {
    const tag  = r.metadata?.type ? `[${r.metadata.type.toUpperCase()}]` : '[MEMORY]';
    const conf = `(conf:${r.effectiveConfidence.toFixed(2)})`;
    return `- ${tag} ${r.text} ${conf}`;
  });
  return `RELEVANTER SWARM-KONTEXT:\n${lines.join('\n')}`;
}

async function getStats() {
  await _ensureReady();
  const rows = await _table.query().limit(10000).toArray();
  const byType = {};
  for (const r of rows) {
    let meta = {};
    try { meta = JSON.parse(r.metadata || '{}'); } catch {}
    const t = meta.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  }
  return { total: rows.length, byType, adapter: 'lancedb', path: LANCEDB_PATH };
}

async function getEntries(limit = 50, type = null) {
  await _ensureReady();
  const rows = await _table.query().limit(limit * 3).toArray();
  return rows
    .filter(r => {
      if (!type) return true;
      let meta = {};
      try { meta = JSON.parse(r.metadata || '{}'); } catch {}
      return meta.type === type;
    })
    .slice(0, limit)
    .map(r => {
      let meta = {};
      try { meta = JSON.parse(r.metadata || '{}'); } catch {}
      return {
        id: r.id, text: r.text,
        confidence: r.confidence || INITIAL_CONFIDENCE,
        effectiveConfidence: Math.max(DECAY_FLOOR, r.confidence || INITIAL_CONFIDENCE),
        usageCount: r.usageCount || 0,
        createdAt: r.createdAt,
        metadata: meta,
      };
    });
}

module.exports = { store, retrieve, retrieveAsContext, getStats, getEntries };

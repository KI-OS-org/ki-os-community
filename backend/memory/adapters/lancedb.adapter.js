/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: lancedb.adapter.js
 * LanceDB Vektorspeicher-Adapter — optionale Dependency, kein Crash ohne Install.
 * @license AGPL-3.0-only
 */

'use strict';

const BaseMemoryAdapter = require('./base.adapter');

const LANCEDB_PATH = process.env.LANCEDB_PATH || './.ki-os-lancedb';
const TABLE_NAME   = 'ki_os_memory';
const MAX_ITEMS_PER_USER = Number(process.env.MEMORY_MAX_ITEMS_PER_USER || 1000);

let lancedb = null;
try {
  lancedb = require('@lancedb/lancedb');
} catch {
  // optionalDependency — Community Edition läuft ohne LanceDB
}

class LanceDBAdapter extends BaseMemoryAdapter {
  constructor() {
    super();
    if (!lancedb) {
      throw new Error('LanceDB nicht installiert. npm install @lancedb/lancedb');
    }
    this._db    = null;
    this._table = null;
    this._ready = false;
  }

  _normalizeItem(item = {}) {
    return {
      memoryId: item.memoryId || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: item.userId || 'guest',
      tenantId: item.tenantId || 'default',
      timestamp: String(item.timestamp || new Date().toISOString()),
      category: item.category || 'chat',
      text: item.text || '',
      metadata: item.metadata || {},
      semantic: item.semantic || null
    };
  }

  // ─── Lazy Init ───────────────────────────────────────────────────────────────

  async _ensureReady() {
    if (this._ready) return;

    this._db = await lancedb.connect(LANCEDB_PATH);
    const tables = await this._db.tableNames();

    if (tables.includes(TABLE_NAME)) {
      this._table = await this._db.openTable(TABLE_NAME);
    } else {
      // Schema via erstem Dummy-Record anlegen
      const { embed } = require('../../services/memory/embedding.service');
      const zeroVec = await embed('init');
      this._table = await this._db.createTable(TABLE_NAME, [{
        memoryId: '_init',
        userId: '_system',
        tenantId: 'default',
        timestamp: new Date(0).toISOString(),
        category: 'system',
        text: 'schema-init',
        vector: Array.from(zeroVec),
        metadata: '{}',
        semantic: 'null',
        payload: '{}',
        createdAt: Date.now(),
      }]);
      await this._table.delete('memoryId = "_init"');
    }

    this._ready = true;
  }

  // ─── BaseMemoryAdapter Interface ─────────────────────────────────────────────

  async save(item) {
    await this._ensureReady();
    const { embed } = require('../../services/memory/embedding.service');

    const normalized = this._normalizeItem(item);
    const {
      memoryId,
      userId,
      tenantId,
      timestamp,
      category,
      text,
      metadata = {},
      semantic = null
    } = normalized;
    if (!memoryId || !userId || !text) throw new Error('save() benötigt: memoryId, userId, text');

    try {
      await this._table.delete(`memoryId = '${String(memoryId).replace(/'/g, "''")}'`);
    } catch {
      // ignore missing row / backend-specific delete behavior
    }

    const vector = Array.from(await embed(text));
    await this._table.add([{
      memoryId,
      userId,
      tenantId,
      timestamp,
      category,
      text,
      vector,
      metadata: JSON.stringify(metadata),
      semantic: JSON.stringify(semantic),
      payload: JSON.stringify(normalized),
      createdAt: Date.now(),
    }]);
    await this._trimUserItems(userId, tenantId);
    return normalized;
  }

  async listByUser(userId, limit = 20, options = {}) {
    await this._ensureReady();
    const tenantId = String(options.tenantId || 'default');
    const rows = await this._table
      .query()
      .where(`userId = '${String(userId).replace(/'/g, "''")}' AND tenantId = '${tenantId.replace(/'/g, "''")}'`)
      .limit(limit)
      .toArray();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => this._rowToItem(row));
  }

  async getById(userId, memoryId, options = {}) {
    await this._ensureReady();
    const tenantId = String(options.tenantId || 'default');
    const rows = await this._table
      .query()
      .where(`userId = '${String(userId).replace(/'/g, "''")}' AND tenantId = '${tenantId.replace(/'/g, "''")}' AND memoryId = '${String(memoryId).replace(/'/g, "''")}'`)
      .limit(1)
      .toArray();
    return rows.length ? this._rowToItem(rows[0]) : null;
  }

  async search(userId, text, limit = 10, options = {}) {
    await this._ensureReady();
    const tenantId = String(options.tenantId || 'default');
    const { embed } = require('../../services/memory/embedding.service');
    const vector = Array.from(await embed(text));
    const escapedUserId = String(userId).replace(/'/g, "''");
    const escapedTenantId = tenantId.replace(/'/g, "''");
    const q = String(text || '').trim().toLowerCase();
    let rows = [];

    try {
      rows = await this._table
        .vectorSearch(vector)
        .where(`userId = '${escapedUserId}' AND tenantId = '${escapedTenantId}'`)
        .limit(limit)
        .toArray();
    } catch {
      rows = await this._table
        .query()
        .where(`userId = '${escapedUserId}' AND tenantId = '${escapedTenantId}'`)
        .limit(Math.max(limit * 5, 50))
        .toArray();
    }

    const mapped = rows.map((row) => ({ ...this._rowToItem(row), _distance: row._distance }));
    if (!q) return mapped.slice(0, limit);

    const lexical = mapped.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
    return (lexical.length > 0 ? lexical : mapped).slice(0, limit);
  }

  async health() {
    try {
      if (!lancedb) return { ok: false, adapter: 'lancedb', error: 'nicht installiert' };
      await this._ensureReady();
      return { ok: true, adapter: 'lancedb', path: LANCEDB_PATH };
    } catch (err) {
      return { ok: false, adapter: 'lancedb', error: err.message, path: LANCEDB_PATH };
    }
  }

  // ─── Helper ──────────────────────────────────────────────────────────────────

  async _trimUserItems(userId, tenantId) {
    const rows = await this._table
      .query()
      .where(`userId = '${String(userId).replace(/'/g, "''")}' AND tenantId = '${String(tenantId).replace(/'/g, "''")}'`)
      .limit(MAX_ITEMS_PER_USER + 50)
      .toArray();
    if (rows.length <= MAX_ITEMS_PER_USER) return;

    const staleRows = rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(MAX_ITEMS_PER_USER);

    for (const row of staleRows) {
      try {
        await this._table.delete(`memoryId = '${String(row.memoryId).replace(/'/g, "''")}'`);
      } catch {
        // ignore single-row cleanup failures
      }
    }
  }

  _rowToItem(row) {
    try {
      const payload = JSON.parse(row.payload || '{}');
      if (payload && typeof payload === 'object' && payload.memoryId) {
        return this._normalizeItem(payload);
      }
    } catch {}

    let metadata = {};
    try { metadata = JSON.parse(row.metadata || '{}'); } catch {}
    let semantic = null;
    try { semantic = JSON.parse(row.semantic || 'null'); } catch {}
    return {
      memoryId: row.memoryId,
      userId: row.userId,
      tenantId: row.tenantId || 'default',
      timestamp: String(row.timestamp || new Date(row.createdAt || Date.now()).toISOString()),
      category: row.category || 'chat',
      text: row.text,
      metadata,
      semantic,
    };
  }
}

module.exports = LanceDBAdapter;

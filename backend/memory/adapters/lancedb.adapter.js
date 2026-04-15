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
        memoryId:  '_init',
        userId:    '_system',
        text:      'schema-init',
        vector:    Array.from(zeroVec),
        metadata:  '{}',
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

    const { memoryId, userId, text, metadata = {} } = item;
    if (!memoryId || !userId || !text) throw new Error('save() benötigt: memoryId, userId, text');

    const vector = Array.from(await embed(text));
    await this._table.add([{
      memoryId,
      userId,
      text,
      vector,
      metadata: JSON.stringify(metadata),
      createdAt: Date.now(),
    }]);
  }

  async listByUser(userId, limit = 20) {
    await this._ensureReady();
    const rows = await this._table
      .query()
      .where(`userId = '${userId.replace(/'/g, "''")}'`)
      .limit(limit)
      .toArray();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(this._rowToItem);
  }

  async getById(userId, memoryId) {
    await this._ensureReady();
    const rows = await this._table
      .query()
      .where(`userId = '${userId.replace(/'/g, "''")}' AND memoryId = '${memoryId.replace(/'/g, "''")}'`)
      .limit(1)
      .toArray();
    return rows.length ? this._rowToItem(rows[0]) : null;
  }

  async search(userId, text, limit = 10) {
    await this._ensureReady();
    const { embed } = require('../../services/memory/embedding.service');
    const vector = Array.from(await embed(text));
    const rows = await this._table
      .vectorSearch(vector)
      .where(`userId = '${userId.replace(/'/g, "''")}'`)
      .limit(limit)
      .toArray();
    return rows.map(r => ({ ...this._rowToItem(r), _distance: r._distance }));
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

  _rowToItem(row) {
    let metadata = {};
    try { metadata = JSON.parse(row.metadata || '{}'); } catch {}
    return {
      memoryId:  row.memoryId,
      userId:    row.userId,
      text:      row.text,
      metadata,
      createdAt: new Date(row.createdAt),
    };
  }
}

module.exports = LanceDBAdapter;

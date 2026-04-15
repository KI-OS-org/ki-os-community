/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: sqlite.adapter.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */


'use strict';
const fs = require('fs');
const path = require('path');
const Base = require('./base.adapter');

class SqliteLikeAdapter extends Base {
  constructor() {
    super();
    this.file = process.env.LOCAL_MEMORY_FILE || path.join(process.cwd(), '.ki-os-memory.json');
    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, JSON.stringify({ items: [] }, null, 2));
  }
  _normalizeItem(item = {}) {
    return {
      memoryId: item.memoryId || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: item.userId || 'guest',
      timestamp: String(item.timestamp || new Date().toISOString()),
      category: item.category || 'chat',
      text: item.text || '',
      tenantId: item.tenantId || 'default',
      metadata: item.metadata || {},
      semantic: item.semantic || null
    };
  }
  _read() {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return { items: [] }; }
  }
  _write(data) { fs.writeFileSync(this.file, JSON.stringify(data, null, 2)); }
  async save(item) {
    const db = this._read();
    const normalized = this._normalizeItem(item);
    db.items.unshift(normalized);
    db.items = db.items.slice(0, 1000);
    this._write(db);
    return normalized;
  }
  async listByUser(userId, limit = 20, options = {}) {
    const db = this._read();
    const tenantId = options.tenantId || 'default';
    return db.items.filter(x => x.userId === userId && String(x.tenantId || 'default') === tenantId).slice(0, limit);
  }
  async getById(userId, memoryId, options = {}) {
    const db = this._read();
    const tenantId = options.tenantId || 'default';
    return db.items.find((x) => x.userId === userId && String(x.tenantId || 'default') === tenantId && x.memoryId === memoryId) || null;
  }
  async health() { return { ok: true, adapter: 'sqlite-like', file: this.file }; }
}
module.exports = SqliteLikeAdapter;

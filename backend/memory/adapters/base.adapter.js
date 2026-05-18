/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: base.adapter.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */


'use strict';
class BaseMemoryAdapter {
  async save(item) { throw new Error('Not implemented'); }
  async listByUser(userId, limit = 20, options = {}) { throw new Error('Not implemented'); }
  async getById(userId, memoryId, options = {}) {
    const items = await this.listByUser(userId, 500, options);
    return items.find((item) => item.memoryId === memoryId) || null;
  }
  async search(userId, text, limit = 10, options = {}) {
    const items = await this.listByUser(userId, 100, options);
    const q = String(text || '').toLowerCase();
    return items.filter(x => JSON.stringify(x).toLowerCase().includes(q)).slice(0, limit);
  }
  async health() { return { ok: true, adapter: 'base' }; }
}
module.exports = BaseMemoryAdapter;

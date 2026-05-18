/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: inmemory.adapter.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */


'use strict';
const Base = require('./base.adapter');
const store = new Map();
class InMemoryAdapter extends Base {
  async save(item) {
    const normalized = { memoryId: item.memoryId || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...item };
    const key = `${item.tenantId || 'default'}::${item.userId || 'guest'}`;
    const items = store.get(key) || [];
    items.unshift(normalized);
    store.set(key, items.slice(0, 200));
    return normalized;
  }
  async listByUser(userId, limit = 20, options = {}) {
    const key = `${options.tenantId || 'default'}::${userId}`;
    return (store.get(key) || []).slice(0, limit);
  }
  async getById(userId, memoryId, options = {}) {
    const key = `${options.tenantId || 'default'}::${userId}`;
    return (store.get(key) || []).find((item) => item.memoryId === memoryId) || null;
  }
  async health() { return { ok: true, adapter: 'inmemory' }; }
}
module.exports = InMemoryAdapter;

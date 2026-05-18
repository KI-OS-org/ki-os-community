/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: memory.broker.js
 * Memory Broker for KI-OS AgentMesh, managing memory retrieval and storage.
 * @license AGPL-3.0-only
 */

'use strict';

const { createMemoryAdapter } = require('../../memory/index');
const logger = require('../core/logger.service');

class MemoryBroker {
  constructor() {
    this._adapter = null;
    this._stats = { totalRetrievals: 0, totalStores: 0, lastAccessAt: null };
  }

  async _getAdapter() {
    if (!this._adapter) {
      try {
        this._adapter = createMemoryAdapter();
      } catch (error) {
        logger.error('MemoryBroker init failed:', error);
        this._adapter = null;
      }
    }
    return this._adapter;
  }

  async isEnabled() {
    const adapter = await this._getAdapter();
    return Boolean(adapter && process.env.MEMORY_BROKER_ENABLED !== 'false');
  }

  async retrieve(query, context) {
    const { userId, runId, agentRole, namespace } = context;
    const adapter = await this._getAdapter();
    if (!adapter || !query || !userId) return [];

    const limit = parseInt(process.env.MEMORY_BROKER_RETRIEVE_LIMIT) || 5;
    const memories = await adapter.search(userId, query, limit, { namespace });

    this._stats.totalRetrievals += 1;
    this._stats.lastAccessAt = new Date();

    logger.info(`Memory retrieval: runId=${runId}, agentRole=${agentRole}, query="${query}"`);
    return memories;
  }

  async store(item, context) {
    const { userId, runId, agentRole } = context;
    const adapter = await this._getAdapter();
    if (!adapter || !userId) return { memoryId: null };

    const enrichedItem = {
      ...item,
      runId,
      agentRole,
      storedAt: new Date().toISOString()
    };

    const result = await adapter.save(enrichedItem);

    this._stats.totalStores += 1;
    this._stats.lastAccessAt = new Date();

    logger.info(`Memory stored: runId=${runId}, agentRole=${agentRole}, content="${item.content}"`);
    return result;
  }

  async getRunContext(runId, userId, limit = 100) {
    const adapter = await this._getAdapter();
    if (!adapter) return [];

    const memories = await adapter.listByUser(userId, limit, { runId });
    return memories;
  }

  async enrichContext(runId, goal, agentRole, userId) {
    const adapter = await this._getAdapter();
    if (!adapter) return '';

    const context = { userId, runId, agentRole, namespace: process.env.MEMORY_BROKER_NAMESPACE_DEFAULT || 'global' };
    const memories = await this.retrieve(goal, context);

    if (memories.length === 0) return '';

    const formattedContext = memories.slice(0, 5).map(m => `- ${m.content}`).join('\n');
    return `Relevant context:\n${formattedContext}`;
  }

  getStatus() {
    return {
      adapter: this._adapter?.constructor.name || 'none',
      enabled: this.isEnabled(),
      lastAccessAt: this._stats.lastAccessAt,
      totalRetrievals: this._stats.totalRetrievals,
      totalStores: this._stats.totalStores
    };
  }
}

module.exports = new MemoryBroker();
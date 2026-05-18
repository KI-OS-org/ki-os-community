/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: routing-decision.log.js
 * Leichtgewichtiges In-Memory + SQLite Log fuer Economic-Router-Entscheidungen.
 * P0-Blueprint: Routing-Decision-Log — jede Modell-/Provider-Wahl wird nachvollziehbar.
 * @license AGPL-3.0-only
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const logger = require('./logger.service');

const ENABLED = process.env.ROUTING_LOG_ENABLED !== 'false';
const DB_PATH = process.env.ROUTING_DB_PATH || path.join(process.cwd(), 'data', 'routing.db');
const RING_MAX = 500;

class RoutingDecisionLog {
  constructor() {
    this._ring = [];
    this._db   = null;
    if (ENABLED) this._initDb();
  }

  _initDb() {
    let Database;
    try { Database = require('better-sqlite3'); } catch {
      logger.debug('routing-decision.log: better-sqlite3 not available — memory-only mode');
      return;
    }
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      this._db = new Database(DB_PATH);
      this._db.exec(`
        CREATE TABLE IF NOT EXISTS routing_decisions (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id           TEXT,
          model            TEXT NOT NULL,
          provider         TEXT,
          reason           TEXT,
          cost_estimate_usd REAL DEFAULT 0,
          latency_ms       INTEGER DEFAULT 0,
          fallback         INTEGER DEFAULT 0,
          user_id          TEXT,
          decided_at       TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch (e) {
      logger.warn('routing-decision.log: DB init failed', { error: e.message });
      this._db = null;
    }
  }

  record(decision = {}) {
    if (!ENABLED) return;
    const entry = { ...decision, timestamp: new Date().toISOString() };
    if (this._ring.length >= RING_MAX) this._ring.shift();
    this._ring.push(entry);

    if (this._db) {
      try {
        this._db.prepare(`
          INSERT INTO routing_decisions (run_id, model, provider, reason, cost_estimate_usd, latency_ms, fallback, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          decision.runId    || null,
          decision.model    || 'unknown',
          decision.provider || null,
          decision.reason   || null,
          decision.costEstimateUsd || 0,
          decision.latencyMs       || 0,
          decision.fallback ? 1 : 0,
          decision.userId   || null
        );
      } catch (e) {
        logger.warn('routing-decision.log: record failed', { error: e.message });
      }
    }
  }

  getRecent(limit = 50) {
    return this._ring.slice(-Math.min(limit, RING_MAX));
  }

  getStats() {
    const total = this._ring.length;
    if (total === 0) return { total: 0, byModel: {}, byProvider: {}, avgCostUsd: 0, fallbackRate: 0 };
    const byModel = {}, byProvider = {};
    let costSum = 0, fallbacks = 0;
    for (const e of this._ring) {
      byModel[e.model]       = (byModel[e.model] || 0) + 1;
      byProvider[e.provider] = (byProvider[e.provider] || 0) + 1;
      costSum += e.costEstimateUsd || 0;
      if (e.fallback) fallbacks++;
    }
    return { total, byModel, byProvider, avgCostUsd: costSum / total, fallbackRate: fallbacks / total };
  }

  search(query, limit = 20) {
    if (!this._db) {
      const q = query.toLowerCase();
      return this._ring.filter(e =>
        (e.model || '').toLowerCase().includes(q) ||
        (e.provider || '').toLowerCase().includes(q) ||
        (e.reason || '').toLowerCase().includes(q)
      ).slice(-limit);
    }
    return this._db.prepare(`
      SELECT * FROM routing_decisions
      WHERE model LIKE ? OR provider LIKE ? OR reason LIKE ?
      ORDER BY decided_at DESC LIMIT ?
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit);
  }

  pruneOld(keepDays = 14) {
    if (!this._db) return { deleted: 0 };
    const r = this._db.prepare(`DELETE FROM routing_decisions WHERE decided_at < datetime('now', ?)`).run(`-${keepDays} days`);
    return { deleted: r.changes };
  }
}

module.exports = new RoutingDecisionLog();

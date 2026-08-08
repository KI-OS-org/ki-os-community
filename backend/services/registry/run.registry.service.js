/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: run.registry.service.js
 * Persistentes Run-Logbuch — alle AgentMesh-Runs in SQLite, durchsuchbar via FTS5.
 * P0-Blueprint: Run Registry (dediziertes Modul, nicht mesh.store.js).
 * @license AGPL-3.0-only
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const logger = require('../core/logger.service');

const ENABLED  = process.env.RUN_REGISTRY_ENABLED !== 'false';
const DB_PATH  = process.env.RUN_DB_PATH || path.join(process.cwd(), 'data', 'runs.db');

let _db = null;

function _getDb() {
  if (_db) return _db;
  let Database;
  try { Database = require('better-sqlite3'); } catch {
    logger.warn('run.registry: better-sqlite3 not available');
    return null;
  }
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id      TEXT NOT NULL UNIQUE,
      goal        TEXT,
      user_id     TEXT DEFAULT 'system',
      status      TEXT DEFAULT 'pending',
      model       TEXT,
      cost_usd    REAL DEFAULT 0,
      step_count  INTEGER DEFAULT 0,
      started_at  TEXT DEFAULT (datetime('now')),
      finished_at TEXT,
      error       TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS runs_fts USING fts5(
      run_id, goal, user_id, content='runs', content_rowid='id'
    );
    CREATE TRIGGER IF NOT EXISTS runs_ai AFTER INSERT ON runs BEGIN
      INSERT INTO runs_fts(rowid, run_id, goal, user_id) VALUES (new.id, new.run_id, new.goal, new.user_id);
    END;
    CREATE TRIGGER IF NOT EXISTS runs_ad AFTER DELETE ON runs BEGIN
      INSERT INTO runs_fts(runs_fts, rowid, run_id, goal, user_id) VALUES ('delete', old.id, old.run_id, old.goal, old.user_id);
    END;
  `);
  return _db;
}

function recordRun(run) {
  if (!ENABLED) return;
  const db = _getDb();
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO runs (run_id, goal, user_id, status, model, cost_usd, step_count, started_at, finished_at, error)
      VALUES (@runId, @goal, @userId, @status, @model, @costUsd, @stepCount, @startedAt, @finishedAt, @error)
      ON CONFLICT(run_id) DO UPDATE SET
        status = excluded.status,
        finished_at = excluded.finished_at,
        cost_usd = excluded.cost_usd,
        step_count = excluded.step_count,
        error = excluded.error
    `).run({
      runId:      run.runId || run.run_id,
      goal:       run.goal || null,
      userId:     run.userId || run.user_id || 'system',
      status:     run.status || 'completed',
      model:      run.model || null,
      costUsd:    run.costUsd || run.cost_usd || 0,
      stepCount:  run.stepCount || run.step_count || 0,
      startedAt:  run.startedAt || run.started_at || new Date().toISOString(),
      finishedAt: run.finishedAt || run.finished_at || null,
      error:      run.error || null
    });
  } catch (e) {
    logger.warn('run.registry.recordRun failed', { error: e.message });
  }
}

function getRunHistory(userId, limit = 50, offset = 0) {
  if (!ENABLED) return [];
  const db = _getDb();
  if (!db) return [];
  if (userId) {
    return db.prepare(`SELECT * FROM runs WHERE user_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(userId, limit, offset);
  }
  return db.prepare(`SELECT * FROM runs ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
}

function searchRuns(query, limit = 20) {
  if (!ENABLED) return [];
  const db = _getDb();
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT r.* FROM runs_fts f JOIN runs r ON r.id = f.rowid
      WHERE runs_fts MATCH ? ORDER BY r.started_at DESC LIMIT ?
    `).all(query, limit);
  } catch { return []; }
}

function getRunStats() {
  if (!ENABLED) return { total: 0, byStatus: {}, avgCostUsd: 0, totalSteps: 0 };
  const db = _getDb();
  if (!db) return { total: 0, byStatus: {}, avgCostUsd: 0, totalSteps: 0 };
  const total    = db.prepare(`SELECT COUNT(*) AS c FROM runs`).get().c;
  const byStatus = db.prepare(`SELECT status, COUNT(*) AS c FROM runs GROUP BY status`).all()
    .reduce((a, r) => { a[r.status] = r.c; return a; }, {});
  const avgCostUsd = db.prepare(`SELECT AVG(cost_usd) AS v FROM runs`).get().v || 0;
  const totalSteps = db.prepare(`SELECT SUM(step_count) AS v FROM runs`).get().v || 0;
  return { total, byStatus, avgCostUsd, totalSteps };
}

function getRunDetail(runId) {
  if (!ENABLED) return null;
  const db = _getDb();
  if (!db) return null;
  return db.prepare(`SELECT * FROM runs WHERE run_id = ?`).get(runId) || null;
}

function deleteRun(runId) {
  if (!ENABLED) return;
  const db = _getDb();
  if (!db) return;
  db.prepare(`DELETE FROM runs WHERE run_id = ?`).run(runId);
}

function pruneOldRuns(keepDays = 30) {
  if (!ENABLED) return { deleted: 0 };
  const db = _getDb();
  if (!db) return { deleted: 0 };
  const r = db.prepare(`DELETE FROM runs WHERE started_at < datetime('now', ?)`).run(`-${keepDays} days`);
  return { deleted: r.changes };
}

module.exports = { recordRun, getRunHistory, searchRuns, getRunStats, getRunDetail, deleteRun, pruneOldRuns };

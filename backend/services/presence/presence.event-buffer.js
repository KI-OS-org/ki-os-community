/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.PRESENCE_DB_PATH || path.join(process.cwd(), 'data', 'presence.db');
const dbDir = path.dirname(dbPath);

fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS presence_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    source     TEXT NOT NULL,
    payload    TEXT,
    confidence REAL DEFAULT 1.0,
    timestamp  TEXT NOT NULL
  )
`);

// SQL Statements
const insertStmt = db.prepare(`
  INSERT INTO presence_events (type, source, payload, confidence, timestamp)
  VALUES (?, ?, ?, ?, ?)
`);

const trimStmt = db.prepare(`
  DELETE FROM presence_events
  WHERE id NOT IN (
    SELECT id FROM presence_events
    ORDER BY id DESC
    LIMIT 1000
  )
`);

const recentStmt = db.prepare(`
  SELECT * FROM presence_events
  ORDER BY id DESC
  LIMIT ?
`);

const windowStmt = db.prepare(`
  SELECT * FROM presence_events
  WHERE timestamp >= ?
  ORDER BY id DESC
`);

const countStmt = db.prepare(`
  SELECT COUNT(*) as count FROM presence_events
  WHERE type = ? AND timestamp >= ?
`);

const clearStmt = db.prepare('DELETE FROM presence_events');

function push({ type, source, payload, confidence, timestamp }) {
  const info = insertStmt.run(
    type, source,
    JSON.stringify(payload),
    confidence ?? 1.0,
    timestamp
  );
  trimStmt.run();
  return { id: info.lastInsertRowid };
}

function getRecent(limit = 50) {
  const rows = recentStmt.all(limit);
  return rows.map(row => {
    try {
      row.payload = JSON.parse(row.payload);
    } catch {
      row.payload = null;
    }
    return row;
  });
}

function getWindow(windowMs = 300000) {
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const rows = windowStmt.all(cutoff);
  return rows.map(row => {
    try {
      row.payload = JSON.parse(row.payload);
    } catch {
      row.payload = null;
    }
    return row;
  });
}

function countByType(type, windowMs = 300000) {
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const row = countStmt.get(type, cutoff);
  return row.count;
}

function clear() {
  clearStmt.run();
}

module.exports = { push, getRecent, getWindow, countByType, clear };

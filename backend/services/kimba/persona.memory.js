/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../../data/kios.db');

let db;

function initDb() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS kimba_persona (
        userId TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        params TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.error('DB Init failed', e);
    throw e;
  }
}

try { initDb(); } catch (e) { console.error('[persona.memory] init failed, DB unavailable:', e.message); }

function getPersona(userId) {
  try {
    const stmt = db.prepare('SELECT role, params FROM kimba_persona WHERE userId = ?');
    const row = stmt.get(userId);
    if (!row) return { role: 'executive', params: null };
    return { role: row.role, params: row.params ? JSON.parse(row.params) : null };
  } catch (e) {
    throw e;
  }
}

function setPersona(userId, role, params) {
  try {
    const stmt = db.prepare(`
      INSERT INTO kimba_persona (userId, role, params, updatedAt)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(userId) DO UPDATE SET role = excluded.role, params = excluded.params, updatedAt = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, role, params != null ? JSON.stringify(params) : null);
  } catch (e) {
    throw e;
  }
}

function resetPersona(userId) {
  try {
    const stmt = db.prepare('DELETE FROM kimba_persona WHERE userId = ?');
    stmt.run(userId);
  } catch (e) {
    throw e;
  }
}

module.exports = { getPersona, setPersona, resetPersona };
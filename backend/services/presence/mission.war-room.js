/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.PRESENCE_DB_PATH || path.join(process.cwd(), 'data', 'presence.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const createTable = () => {
  // mission_seeds muss vor war_rooms existieren (FOREIGN KEY)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS mission_seeds (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      priority    TEXT NOT NULL,
      confidence  REAL NOT NULL,
      status      TEXT DEFAULT 'pending',
      payload     TEXT,
      detected_at TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS mission_war_rooms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id  INTEGER NOT NULL,
      title       TEXT NOT NULL,
      status      TEXT DEFAULT 'active',
      priority    TEXT NOT NULL,
      context     TEXT,
      decisions   TEXT DEFAULT '[]',
      next_steps  TEXT DEFAULT '[]',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      FOREIGN KEY (mission_id) REFERENCES mission_seeds(id)
    )
  `).run();
};

createTable();

const parseJsonFields = (warRoom) => {
  if (!warRoom) return null;

  try {
    warRoom.context = JSON.parse(warRoom.context || '{}');
    warRoom.decisions = JSON.parse(warRoom.decisions || '[]');
    warRoom.next_steps = JSON.parse(warRoom.next_steps || '[]');
  } catch (err) {
    throw new Error(`Failed to parse JSON fields: ${err.message}`);
  }

  return warRoom;
};

const stringifyJsonFields = (warRoom) => {
  if (!warRoom) return null;

  try {
    warRoom.context = JSON.stringify(warRoom.context || {});
    warRoom.decisions = JSON.stringify(warRoom.decisions || []);
    warRoom.next_steps = JSON.stringify(warRoom.next_steps || []);
  } catch (err) {
    throw new Error(`Failed to stringify JSON fields: ${err.message}`);
  }

  return warRoom;
};

const create = (missionSeed) => {
  if (!missionSeed || !missionSeed.id || !missionSeed.title || !missionSeed.priority) {
    throw new Error('Missing required fields: mission_id, title, or priority');
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO mission_war_rooms
    (mission_id, title, status, priority, context, decisions, next_steps, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    missionSeed.id,
    missionSeed.title,
    'active',
    missionSeed.priority,
    JSON.stringify(missionSeed.context || {}),
    '[]',
    '[]',
    now,
    now
  );

  return getById(result.lastInsertRowid);
};

const getById = (id) => {
  if (!id) throw new Error('ID is required');

  const stmt = db.prepare('SELECT * FROM mission_war_rooms WHERE id = ?');
  const warRoom = stmt.get(id);

  return parseJsonFields(warRoom);
};

const getAll = (filters = {}) => {
  let query = 'SELECT * FROM mission_war_rooms WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.priority) {
    query += ' AND priority = ?';
    params.push(filters.priority);
  }

  const stmt = db.prepare(query);
  const warRooms = stmt.all(...params);

  return warRooms.map(parseJsonFields);
};

const update = (id, changes) => {
  if (!id || !changes) throw new Error('ID and changes are required');

  const now = new Date().toISOString();
  const fields = [];
  const params = [];

  if (changes.title) {
    fields.push('title = ?');
    params.push(changes.title);
  }

  if (changes.status) {
    fields.push('status = ?');
    params.push(changes.status);
  }

  if (changes.priority) {
    fields.push('priority = ?');
    params.push(changes.priority);
  }

  if (changes.context) {
    fields.push('context = ?');
    params.push(JSON.stringify(changes.context));
  }

  if (changes.decisions) {
    fields.push('decisions = ?');
    params.push(JSON.stringify(changes.decisions));
  }

  if (changes.next_steps) {
    fields.push('next_steps = ?');
    params.push(JSON.stringify(changes.next_steps));
  }

  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }

  fields.push('updated_at = ?');
  params.push(now);

  params.push(id);

  const stmt = db.prepare(`
    UPDATE mission_war_rooms
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...params);

  return getById(id);
};

const addDecision = (warRoomId, decision) => {
  if (!warRoomId || !decision || !decision.text || !decision.author) {
    throw new Error('warRoomId, decision.text, and decision.author are required');
  }

  const warRoom = getById(warRoomId);
  if (!warRoom) throw new Error('War room not found');

  const now = new Date().toISOString();
  const fullDecision = {
    ...decision,
    timestamp: decision.timestamp || now
  };

  warRoom.decisions.push(fullDecision);

  return update(warRoomId, { decisions: warRoom.decisions });
};

const addNextStep = (warRoomId, step) => {
  if (!warRoomId || !step) {
    throw new Error('warRoomId and step are required');
  }

  const warRoom = getById(warRoomId);
  if (!warRoom) throw new Error('War room not found');

  warRoom.next_steps.push(step);

  return update(warRoomId, { next_steps: warRoom.next_steps });
};

const close = (warRoomId) => {
  if (!warRoomId) throw new Error('warRoomId is required');

  return update(warRoomId, { status: 'completed' });
};

const archive = (warRoomId) => {
  if (!warRoomId) throw new Error('warRoomId is required');

  return update(warRoomId, { status: 'archived' });
};

module.exports = {
  create,
  getById,
  getAll,
  update,
  addDecision,
  addNextStep,
  close,
  archive
};

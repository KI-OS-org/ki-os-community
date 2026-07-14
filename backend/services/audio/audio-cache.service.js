/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const crypto = require('crypto');
const path = require('path');

let lancedb = null;
try { lancedb = require('@lancedb/lancedb'); } catch {}

const { embed } = require('../memory/embedding.service');

const LANCEDB_PATH = path.join(process.cwd(), '.ki-os-audio-cache-lancedb');
const TABLE_NAME = 'audio_cache';

let _db = null;
let _table = null;
let _ready = false;

function _escape(value) {
  return String(value).replace(/'/g, "''");
}

function _hashText(text) {
  return crypto.createHash('sha1').update(String(text).trim()).digest('hex').slice(0, 12);
}

function _toRelativeFilePath(filePath) {
  if (!filePath) return '';
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  return path.relative(process.cwd(), absolutePath);
}

function _buildWhereClause(filters = {}) {
  const clauses = [];
  if (filters.mood) clauses.push(`mood = '${_escape(filters.mood)}'`);
  if (filters.lang) clauses.push(`lang = '${_escape(filters.lang)}'`);
  if (filters.character) clauses.push(`character = '${_escape(filters.character)}'`);
  return clauses.join(' AND ');
}

function _cosineSimilarity(a, b) {
  if (!a || !b || !a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function _scoreFromDistance(distance) {
  const score = 1 - Number(distance || 0);
  return Math.max(0, Math.min(1, score));
}

function _toResult(row) {
  return {
    id: row.id,
    text: row.text,
    filePath: row.file_path,
    score: typeof row.score === 'number' ? row.score : _scoreFromDistance(row._distance),
    mood: row.mood,
    voice: row.voice,
    provider: row.provider,
    character: row.character,
  };
}

async function _ensureReady() {
  if (_ready) return;
  if (!lancedb) throw new Error('LanceDB nicht installiert. npm install @lancedb/lancedb');

  _db = await lancedb.connect(LANCEDB_PATH);
  const tables = await _db.tableNames();

  if (tables.includes(TABLE_NAME)) {
    _table = await _db.openTable(TABLE_NAME);
  } else {
    const zeroVec = Array.from(await embed('init'));
    _table = await _db.createTable(TABLE_NAME, [{
      id: '_init',
      text: 'schema-init',
      mood: 'neutral',
      voice: 'Aoede',
      provider: 'gemini',
      lang: 'de',
      file_path: 'DEMO/audio/de/neutral/init.mp3',
      character: 'synthesizer',
      vector: zeroVec,
      play_count: 0,
      created_at: 0,
    }]);
    await _table.delete('id = "_init"');
  }

  _ready = true;
}

async function store({ text, mood, voice, provider, lang, filePath, character }) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) throw new Error('audio-cache.store: text darf nicht leer sein');

  await _ensureReady();

  const id = _hashText(normalizedText);
  const now = Date.now();
  let existing = null;

  try {
    const rows = await _table.query().where(`id = '${_escape(id)}'`).limit(1).toArray();
    if (rows.length) existing = rows[0];
  } catch {}

  if (existing) {
    try { await _table.delete(`id = '${_escape(id)}'`); } catch {}
  }

  const vector = Array.from(await embed(normalizedText));
  await _table.add([{
    id,
    text: normalizedText,
    mood: String(mood || existing?.mood || 'neutral'),
    voice: String(voice || existing?.voice || 'Aoede'),
    provider: String(provider || existing?.provider || 'gemini'),
    lang: String(lang || existing?.lang || 'de'),
    character: String(character || existing?.character || 'synthesizer'),
    file_path: _toRelativeFilePath(filePath || existing?.file_path || ''),
    vector,
    play_count: Number(existing?.play_count || 0),
    created_at: Number(existing?.created_at || now),
  }]);

  return { id, stored: true };
}

async function search(text, { mood, lang, character, limit = 1 } = {}) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) return null;

  await _ensureReady();

  const vector = Array.from(await embed(normalizedText));
  const where = _buildWhereClause({ mood, lang, character });
  let rows = [];

  try {
    let query = _table.vectorSearch(vector);
    if (where) query = query.where(where);
    rows = await query.limit(limit).toArray();
    if (rows.length) {
      return _toResult(rows[0]);
    }
  } catch {}

  let fallback = _table.query();
  if (where) fallback = fallback.where(where);
  rows = await fallback.limit(Math.max(limit * 10, 50)).toArray();
  if (!rows.length) return null;

  const ranked = rows
    .map((row) => {
      const similarity = _cosineSimilarity(vector, row.vector);
      return {
        ...row,
        score: Math.max(0, Math.min(1, similarity)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.length ? _toResult(ranked[0]) : null;
}

async function incrementPlayCount(id) {
  if (!id) return;
  await _ensureReady();

  const rows = await _table.query().where(`id = '${_escape(id)}'`).limit(1).toArray();
  if (!rows.length) return;

  const row = rows[0];
  try { await _table.delete(`id = '${_escape(id)}'`); } catch {}
  await _table.add([{
    ...row,
    play_count: Number(row.play_count || 0) + 1,
  }]);
}

async function getAll({ mood, lang, character } = {}) {
  await _ensureReady();

  let query = _table.query();
  const where = _buildWhereClause({ mood, lang, character });
  if (where) query = query.where(where);

  const rows = await query.limit(10000).toArray();
  return rows
    .sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0))
    .map((row) => ({
      id: row.id,
      text: row.text,
      mood: row.mood,
      voice: row.voice,
      provider: row.provider,
      lang: row.lang,
      character: row.character,
      filePath: row.file_path,
      playCount: Number(row.play_count || 0),
    }));
}

async function clear() {
  await _ensureReady();
  try {
    await _table.delete('id IS NOT NULL');
    return { cleared: true };
  } catch {
    // Fallback: einzeln löschen
    const rows = await _table.query().limit(10000).toArray();
    for (const row of rows) {
      try { await _table.delete(`id = '${_escape(row.id)}'`); } catch {}
    }
    return { cleared: true };
  }
}

function isReady() {
  return Boolean(_ready && _table);
}

module.exports = { store, search, incrementPlayCount, getAll, clear, isReady };

/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const axios = require('axios');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'kimba.db');

// Init DB
const ensureDir = () => {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  } catch (e) { /* ignore */ }
};

ensureDir();
let db;
try {
  db = new Database(DB_PATH);
  db.exec(`
  CREATE TABLE IF NOT EXISTS kimba_decisions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    createdAt TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_decisions_user ON kimba_decisions(userId);
`);
} catch (e) { console.error('[decision.history] DB init failed:', e.message); db = null; }

const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
};

const getEmbedding = async (text) => {
  try {
    const response = await axios.post(
      process.env.OPENAI_API_BASE + '/embeddings',
      { model: 'text-embedding-3-small', input: text },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 15000 }
    );
    return response.data.data[0].embedding;
  } catch (e) {
    throw new Error(`getEmbedding failed: ${e.message}`);
  }
};

const recordDecision = async (userId, content, category = 'general') => {
  try {
    const embedding = await getEmbedding(content);
    const id = crypto.randomUUID();
    const stmt = db.prepare('INSERT INTO kimba_decisions (id, userId, content, embedding, category) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, userId, content, JSON.stringify(embedding), category);
    return { success: true, id };
  } catch (e) {
    console.error('Memory Error:', e.message);
    return { success: false, error: e.message };
  }
};

const getRecentDecisions = (userId, limit = 20) => {
  const stmt = db.prepare('SELECT * FROM kimba_decisions WHERE userId = ? ORDER BY createdAt DESC LIMIT ?');
  return stmt.all(userId, limit);
};

const findSimilarDecisions = (userId, queryEmbedding, threshold = 0.70) => {
  const rows = getRecentDecisions(userId, 100);
  const results = [];
  for (const row of rows) {
    let emb;
    try { emb = JSON.parse(row.embedding); } catch { continue; }
    const sim = cosineSimilarity(queryEmbedding, emb);
    if (sim >= threshold) {
      results.push({ ...row, similarity: sim });
    }
  }
  return results.sort((a, b) => b.similarity - a.similarity);
};

module.exports = {
  recordDecision,
  getRecentDecisions,
  findSimilarDecisions,
  getEmbedding
};
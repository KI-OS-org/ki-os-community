/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only

const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { getRun } = require('../agentmesh/mesh.store');

// --- DB Setup ---
const DB_PATH = path.join(__dirname, '../../data/kimba_autopsies.db');
const DB_DIR = path.dirname(DB_PATH);

let db = null;

function initDB() {
  if (db) return db;

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS kimba_autopsies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        runId TEXT NOT NULL,
        userId TEXT NOT NULL,
        result TEXT NOT NULL,
        stats TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_autopsy_user ON kimba_autopsies(userId);
      CREATE INDEX IF NOT EXISTS idx_autopsy_run ON kimba_autopsies(runId);
    `);
  } catch (err) {
    console.error('DB Init Error:', err);
    throw err;
  }
  return db;
}

// --- LLM Logic ---
async function callLLM(stepsText) {
  const prompt = `
    Analyse diesen Run-Schrittverlauf und liefere ein JSON-Objekt mit folgenden Feldern:
    {
      "whatWorked": ["string", ...],
      "whatFailed": ["string", ...],
      "costDrivers": ["string", ...],
      "keyLearning": "string",
      "nextTimeDoThis": "string"
    }
    Schritte (max 2000 Zeichen):
    ${stepsText}
  `;

  const response = await axios.post(
    `${process.env.OPENAI_API_BASE || 'https://api.openai.com'}/v1/chat/completions`,
    {
      model: process.env.AUTOPSY_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a project autopsy assistant. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const content = response.data.choices[0].message.content;
  try {
    return JSON.parse(content);
  } catch (e) {
    // Fallback if LLM returns markdown or text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('LLM did not return valid JSON');
  }
}

// --- Service Functions ---

async function generateAutopsy(runId, userId) {
  const database = initDB();

  // 0. Cache-Check
  const cached = database.prepare('SELECT * FROM kimba_autopsies WHERE runId = ?').get(runId);
  if (cached) {
    return {
      runId,
      autopsy: JSON.parse(cached.result),
      stats: JSON.parse(cached.stats),
      createdAt: cached.createdAt
    };
  }

  // 1. Fetch Run
  const run = getRun(runId);
  if (!run) {
    throw new Error('Run not found');
  }

  // 2. Stats Calculation
  const durationSec = run.finishedAt ? Math.floor((run.finishedAt - run.createdAt) / 1000) : 0;
  const stepCount = run.steps?.length || 0;
  const failedSteps = run.steps?.filter(s => s.status === 'failed').length || 0;
  const statsObj = { durationSec, stepCount, failedSteps };

  // 3. Prepare Steps for LLM (Truncate to 2000 chars)
  const stepsRaw = run.steps?.map(s => `[${s.status}] ${s.tool}: ${s.content || ''}`).join('\n') || '';
  const stepsText = stepsRaw.slice(0, 2000);

  // 4. LLM Call
  const autopsyData = await callLLM(stepsText);

  // 5. Normalize Fields
  const normalized = {
    whatWorked: Array.isArray(autopsyData.whatWorked) ? autopsyData.whatWorked : [],
    whatFailed: Array.isArray(autopsyData.whatFailed) ? autopsyData.whatFailed : [],
    costDrivers: Array.isArray(autopsyData.costDrivers) ? autopsyData.costDrivers : [],
    keyLearning: String(autopsyData.keyLearning || ''),
    nextTimeDoThis: String(autopsyData.nextTimeDoThis || '')
  };

  // 6. INSERT
  database.prepare(
    'INSERT INTO kimba_autopsies (runId, userId, result, stats) VALUES (?, ?, ?, ?)'
  ).run(runId, userId, JSON.stringify(normalized), JSON.stringify(statsObj));

  return {
    runId,
    autopsy: normalized,
    stats: statsObj,
    createdAt: new Date().toISOString()
  };
}

function getAutopsies(userId, limit = 10) {
  const database = initDB();
  const rows = database.prepare(
    `SELECT * FROM kimba_autopsies WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`
  ).all(userId, limit);

  return rows.map(row => ({
    id: row.id,
    runId: row.runId,
    createdAt: row.createdAt,
    autopsy: JSON.parse(row.result),
    stats: JSON.parse(row.stats)
  }));
}

module.exports = { generateAutopsy, getAutopsies };
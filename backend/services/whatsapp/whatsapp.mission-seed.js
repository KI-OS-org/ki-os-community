/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const axios = require('axios');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.PRESENCE_DB_PATH || path.join(process.cwd(), 'data', 'kimba.db');
const db = new Database(dbPath);

db.exec(`CREATE TABLE IF NOT EXISTS kimba_mission_seeds (
  id TEXT PRIMARY KEY,
  from_number TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  priority TEXT DEFAULT 'medium',
  created_at TEXT NOT NULL
)`);

async function detectMissionSeed(parsedMessage) {
  if (parsedMessage.type !== 'text') return { isMission: false };

  try {
    const response = await axios.post(`http://localhost:${process.env.PORT || 3000}/api/chat`, {
      message: `Ist das eine Aufgabe, Entscheidung oder Mission? Antworte NUR mit JSON (kein Markdown):
                {"isMission": true/false, "title": "kurzer Titel max 60 Zeichen", "priority": "low|medium|high"}

                Nachricht: "${parsedMessage.content.slice(0, 500).replace(/"/g, "'")}"`,
      userId: 'whatsapp-system',
      stream: false
    });

    const result = JSON.parse(response.data.message || response.data.reply || '{}');

    if (result.isMission) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`INSERT INTO kimba_mission_seeds
        (id, from_number, content, type, title, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, parsedMessage.originalFrom, parsedMessage.content, parsedMessage.type, result.title, result.priority, now);

      return { isMission: true, id, title: result.title, priority: result.priority };
    }

    return { isMission: false };
  } catch (error) {
    console.error('Mission detection failed:', error);
    return { isMission: false };
  }
}

module.exports = { detectMissionSeed };

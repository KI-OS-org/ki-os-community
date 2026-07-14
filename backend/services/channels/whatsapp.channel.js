/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc WhatsApp-Kanal-Fassade (S4) — bewusst OHNE Auto-Reply, nur einheitliches Interface für CLI-Registrierung;
// echte Logik bleibt in services/whatsapp/

'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { sendReply } = require('../whatsapp/whatsapp.reply.js');

const name = 'whatsapp';

function isAvailable() {
  return !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
}

async function getStatus() {
  let pendingSeedsCount = 0;

  try {
    const dbPath = process.env.PRESENCE_DB_PATH || path.join(process.cwd(), 'data', 'kimba.db');
    if (fs.existsSync(dbPath)) {
      const db = new Database(dbPath);
      const result = db.prepare('SELECT COUNT(*) as count FROM kimba_mission_seeds').get();
      pendingSeedsCount = result ? result.count : 0;
    }
  } catch (error) {
    // Ignore if DB doesn't exist yet
  }

  return {
    available: isAvailable(),
    mode: 'webhook-seed-collector',
    autoReply: false,
    note: 'WhatsApp läuft webhook-basiert über den KI-OS-Server, kein separater Start nötig. Eingehende Nachrichten werden klassifiziert und als Mission-Seeds abgelegt (kein automatisches Reply — bewusste Design-Entscheidung wegen offener Absenderbasis).',
    pendingSeedsCount
  };
}

async function sendMessage(to, text) {
  return await sendReply(to, text);
}

async function start() {
  return {
    started: false,
    reason: 'WhatsApp ist webhook-basiert und läuft automatisch mit dem KI-OS-Server (POST /api/whatsapp/inbound) — kein separater Start-Prozess wie bei Telegram/Signal.'
  };
}

async function stop() {
  return {
    stopped: false,
    reason: 'Kein separater Prozess zum Stoppen (webhook-basiert).'
  };
}

module.exports = {
  name,
  isAvailable,
  getStatus,
  sendMessage,
  start,
  stop
};

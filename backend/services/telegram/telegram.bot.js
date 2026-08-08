/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const axios = require('axios');
const { existsSync, readFileSync, writeFileSync, unlinkSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');
const parser = require('../whatsapp/whatsapp.parser');
const seedDetector = require('../whatsapp/whatsapp.mission-seed');
const { runClaudeCode, runCodex, runQwen } = require('../claude-bridge.service');

const ROOT = join(__dirname, '..', '..', '..');
const PENDING_PATHS = [
  join(ROOT, '.tmp', 'german-shepherd-pending.json'),
];
const BRIEFING_STATE_PATH = join(ROOT, '.tmp', 'briefing-state.json');

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const POLL_INTERVAL = Number(process.env.TELEGRAM_POLL_MS || 3000);

const CLI_COMMANDS = [
  { prefix: '!claude ', label: 'KIMBA-Ant', runner: runClaudeCode },
  { prefix: '!codex ',  label: 'KIMBA-Codex', runner: runCodex },
  { prefix: '!qwen ',   label: 'KIMBA-Qwen',  runner: runQwen },
];

let _running = false;
let _offset = 0;

async function sendMessage(chatId, text) {
  try {
    const response = await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: text.slice(0, 4096)
    });
    return response.data.result;
  } catch (error) {
    console.error('Telegram sendMessage failed:', error.message);
  }
}

async function answerCallbackQuery(callbackQueryId, text) {
  try {
    await axios.post(`${BASE_URL}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text
    });
  } catch (error) {
    console.error('Telegram answerCallbackQuery failed:', error.message);
  }
}

function saveBriefingResponse(approved, changes) {
  try {
    const existing = existsSync(BRIEFING_STATE_PATH)
      ? JSON.parse(readFileSync(BRIEFING_STATE_PATH, 'utf8'))
      : {};
    writeFileSync(BRIEFING_STATE_PATH, JSON.stringify({
      ...existing,
      approved,
      changes: changes || existing.changes || '',
      pending: false,
      respondedAt: Date.now()
    }, null, 2));
  } catch (e) {
    console.error('saveBriefingResponse failed:', e.message);
  }
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data;
  const queryId = callbackQuery.id;

  if (data === 'briefing_ja') {
    saveBriefingResponse(true, '');
    await answerCallbackQuery(queryId, '✅ Freigegeben');
    await sendMessage(chatId, '✅ Plan freigegeben. KIMBA startet den Tag!');
  } else if (data === 'briefing_nein') {
    saveBriefingResponse(false, '');
    await answerCallbackQuery(queryId, '❌ Abgelehnt');
    await sendMessage(chatId, '❌ Plan abgelehnt. Kein Sprint heute.');
  }
}

function checkPendingApproval() {
  for (const p of PENDING_PATHS) {
    if (!existsSync(p)) continue;
    try {
      const pending = JSON.parse(readFileSync(p, 'utf8'));
      if (Date.now() > pending.expires) { unlinkSync(p); continue; }
      unlinkSync(p);
      return pending;
    } catch { /* ignore */ }
  }
  return null;
}

async function handleMessage(chatId, from, body) {
  // "nein" → Briefing ablehnen
  if (/^nein$/i.test(body.trim())) {
    saveBriefingResponse(false, '');
    await sendMessage(chatId, '❌ Briefing abgelehnt.');
    return;
  }

  // "ändern {was}" → Änderungswunsch speichern
  if (/^ändern\s+/i.test(body.trim())) {
    const changes = body.trim().replace(/^ändern\s+/i, '');
    saveBriefingResponse(null, changes);
    await sendMessage(chatId, `✏️ Änderungswunsch gespeichert: "${changes}"`);
    return;
  }

  // "ja" / "j" / "yes" → Pending-Approval prüfen
  if (/^(ja|j|yes|ok|approve)$/i.test(body.trim())) {
    const pending = checkPendingApproval();
    if (pending) {
      await sendMessage(chatId, `✅ Freigabe erhalten. Starte: ${pending.label}…`);
      try {
        const result = execSync(`/usr/local/bin/node ${pending.command.replace('node ', '')}`, {
          cwd: ROOT, timeout: 120000, encoding: 'utf8'
        });
        await sendMessage(chatId, `✅ ${pending.label} abgeschlossen:\n\n${result.slice(0, 3800)}`);
      } catch (e) {
        await sendMessage(chatId, `❌ ${pending.label} Fehler: ${(e.stdout || e.message).slice(0, 1000)}`);
      }
      return;
    }
  }

  // CLI-Befehle: !claude / !codex / !qwen
  const cliMatch = CLI_COMMANDS.find(c => body.startsWith(c.prefix));
  if (cliMatch) {
    const prompt = body.slice(cliMatch.prefix.length).trim();
    await sendMessage(chatId, `⚙️ ${cliMatch.label} läuft …`);
    try {
      const result = await cliMatch.runner(prompt);
      const out = (result.output || result.error || '(kein Output — exitCode: ' + result.exitCode + ')').slice(0, 3800);
      await sendMessage(chatId, `✅ ${cliMatch.label} fertig (${Math.round(result.duration / 1000)}s):\n\n${out}`);
    } catch (e) {
      await sendMessage(chatId, `❌ ${cliMatch.label} Fehler: ${e.message}`);
    }
    return;
  }

  // Mission Seed Detection
  try {
    const parsed = await parser.parseInbound({ from, body, mediaUrl: null, mediaType: null });
    const detection = await seedDetector.detectMissionSeed(parsed);
    if (detection.isMission) {
      await sendMessage(chatId, `✅ Mission erkannt: "${detection.title}" (${detection.priority})`);
    } else {
      await sendMessage(chatId, `📨 Empfangen. Keine Mission erkannt.`);
    }
  } catch (e) {
    console.error('Telegram mission detection failed:', e.message);
  }
}

async function pollUpdates() {
  if (!_running) return;

  try {
    const response = await axios.get(`${BASE_URL}/getUpdates`, {
      params: { offset: _offset, timeout: 30 }
    });

    for (const update of response.data.result) {
      _offset = update.update_id + 1;
      if (update.callback_query) {
        handleCallbackQuery(update.callback_query).catch(e =>
          console.error('Telegram handleCallbackQuery failed:', e.message)
        );
      } else if (update.message?.text) {
        const from = String(update.message.from.id);
        const body = update.message.text;
        const chatId = update.message.chat.id;
        // Nicht awaiten — parallel verarbeiten, Loop läuft weiter
        handleMessage(chatId, from, body).catch(e =>
          console.error('Telegram handleMessage failed:', e.message)
        );
      }
    }
  } catch (error) {
    console.error('Telegram polling failed:', error.message);
  }

  setTimeout(pollUpdates, POLL_INTERVAL);
}

function start() {
  _running = true;
  pollUpdates();
}

function stop() {
  _running = false;
}

module.exports = { start, stop, sendMessage };

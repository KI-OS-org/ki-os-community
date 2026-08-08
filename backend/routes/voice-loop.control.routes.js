/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Start/Stop-Steuerung fuer scripts/voice-loop.mjs, ausgeloest per Klick
// auf den Desktop-Avatar (S2 Killer-Demo, 2026-08-07). Haelt den Voice-Loop
// als Kindprozess des Servers, statt ihn manuell im Terminal starten zu muessen.
'use strict';

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const ROOT = path.join(__dirname, '../..');
const AVATAR_STATE_PATH = path.join(ROOT, 'backend/public/avatar/avatar-state.json');
let child = null;

function resetAvatarState() {
  try {
    fs.writeFileSync(AVATAR_STATE_PATH, JSON.stringify({ state: 'idle', updatedAt: new Date().toISOString() }));
  } catch (_) {}
}

const LOG_PATH = path.join(ROOT, 'runtime/local/.desktop/voice-loop.log');

router.post('/voice-loop/start', (req, res) => {
  if (child) return res.json({ running: true, alreadyRunning: true });
  // stdio nach Datei statt 'ignore' (Ingo-Fund 2026-08-07: Prozess war abgestuerzt,
  // ohne Log war die Ursache nicht diagnostizierbar).
  const logFd = fs.openSync(LOG_PATH, 'w'); // frisch pro Start, nicht endlos anhaengen
  child = spawn('node', [path.join(ROOT, 'scripts/voice-loop.mjs')], {
    cwd: ROOT,
    stdio: ['ignore', logFd, logFd],
    detached: false,
  });
  fs.closeSync(logFd);
  child.on('exit', (code, signal) => { child = null; resetAvatarState(); });
  child.on('error', () => { child = null; resetAvatarState(); });
  res.json({ running: true, logPath: LOG_PATH });
});

router.post('/voice-loop/stop', (req, res) => {
  if (!child) return res.json({ running: false, alreadyStopped: true });
  try { child.kill('SIGINT'); } catch (_) {}
  child = null;
  resetAvatarState();
  res.json({ running: false });
});

router.get('/voice-loop/status', (req, res) => {
  res.json({ running: !!child });
});

module.exports = router;

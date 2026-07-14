/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Signal-Kanal (S4) via signal-cli-Bridge — Single-User-Gate wie Telegram, fail-safe wenn signal-cli fehlt

const { spawnSync } = require('node:child_process');
const { triggerMissionAsync } = require('./channel.responder.js');

const name = 'signal';

let _running = false;
let _intervalHandle = null;

/**
 * Prüft, ob signal-cli verfügbar ist.
 * @returns {boolean} - true wenn signal-cli verfügbar ist, sonst false
 */
function isAvailable() {
  try {
    const result = spawnSync('signal-cli', ['--version'], { timeout: 5000, stdio: 'ignore' });
    return result.status === 0;
  } catch (err) {
    // ENOENT oder andere Fehler -> signal-cli nicht verfügbar
    return false;
  }
}

/**
 * Gibt den aktuellen Status des Signal-Kanals zurück.
 * @returns {Promise<Object>} - Status-Objekt
 */
async function getStatus() {
  return {
    available: isAvailable(),
    mode: 'signal-cli-bridge',
    configuredNumber: process.env.SIGNAL_CLI_NUMBER || null,
    allowedSender: process.env.SIGNAL_ALLOWED_NUMBER || null,
    running: _running,
    note: 'Signal-Anbindung über die externe signal-cli — ohne installierte+registrierte signal-cli ist der Kanal komplett deaktiviert.'
  };
}

/**
 * Sendet eine Nachricht über Signal.
 * @param {string} to - Empfängernummer
 * @param {string} text - Nachrichtentext
 * @returns {Promise<Object>} - Ergebnis der Nachrichtensendung
 */
async function sendMessage(to, text) {
  if (!isAvailable()) {
    return { sent: false, reason: 'signal-cli-unavailable' };
  }

  if (!process.env.SIGNAL_CLI_NUMBER) {
    return { sent: false, reason: 'signal-cli-number-not-configured' };
  }

  try {
    const result = spawnSync('signal-cli', [
      '-a', process.env.SIGNAL_CLI_NUMBER,
      'send',
      '-m', text,
      to
    ], { timeout: 15000, encoding: 'utf8' });

    if (result.status === 0) {
      return { sent: true };
    } else {
      return {
        sent: false,
        reason: 'signal-cli-send-failed',
        stderr: result.stderr
      };
    }
  } catch (err) {
    return {
      sent: false,
      reason: 'signal-cli-send-failed',
      stderr: err.message
    };
  }
}

/**
 * Startet den Signal-Polling-Loop.
 * @returns {Promise<Object>} - Ergebnis des Starts
 */
async function start() {
  if (!isAvailable()) {
    return { started: false, reason: 'signal-cli-unavailable' };
  }

  if (!process.env.SIGNAL_CLI_NUMBER) {
    return { started: false, reason: 'signal-cli-number-not-configured' };
  }

  if (_running) {
    return { started: false, reason: 'already-running' };
  }

  _running = true;
  _intervalHandle = setInterval(async () => {
    try {
      const result = spawnSync('signal-cli', [
        '-a', process.env.SIGNAL_CLI_NUMBER,
        'receive',
        '--json',
        '--timeout', '5'
      ], { timeout: 10000, encoding: 'utf8' });

      if (result.stdout) {
        const lines = result.stdout.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const envelope = JSON.parse(line);
            const sender = envelope.source || envelope.sourceNumber;
            const message = envelope.dataMessage?.message;

            if (!sender || !message) continue;

            // Nur Nachrichten von der erlaubten Nummer verarbeiten
            if (sender === process.env.SIGNAL_ALLOWED_NUMBER) {
              triggerMissionAsync(message)
                .then(ergebnisText => {
                  if (ergebnisText) {
                    sendMessage(sender, ergebnisText).catch(() => {});
                  }
                })
                .catch(() => {});
            } else {
              console.log(`Signal-Nachricht von nicht erlaubter Nummer ${sender} ignoriert`);
            }
          } catch (parseErr) {
            // Ignorieren, falls die Zeile kein gültiges JSON ist
          }
        }
      }
    } catch (err) {
      // Fehler beim spawnSync ignorieren, nächster Intervall-Tick versucht es erneut
    }
  }, 10000);

  return { started: true };
}

/**
 * Stoppt den Signal-Polling-Loop.
 * @returns {Promise<Object>} - Ergebnis des Stops
 */
async function stop() {
  const wasRunning = _running;
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
  _running = false;
  return { stopped: wasRunning };
}

module.exports = {
  name,
  isAvailable,
  getStatus,
  sendMessage,
  start,
  stop
};

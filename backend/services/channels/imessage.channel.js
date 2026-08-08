/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc iMessage-Kanal (S4) — macOS-nativ via osascript+chat.db, Single-User-Gate, Injection-sicher via argv-Übergabe

const { execFile } = require('node:child_process');
const { accessSync, constants } = require('node:fs');
const { join } = require('node:path');
const { homedir } = require('node:os');
const Database = require('better-sqlite3');

const name = 'imessage';

let _running = false;
let _intervalHandle = null;
let _lastRowId = 0;

const dbPath = join(homedir(), 'Library/Messages/chat.db');
const scriptTemplate = `
on run argv
  set toHandle to item 1 of argv
  set msgText to item 2 of argv
  tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy toHandle of targetService
    send msgText to targetBuddy
  end tell
end run
`;

/**
 * Prüft, ob iMessage auf diesem System verfügbar ist.
 * @returns {boolean} - true wenn macOS und chat.db lesbar ist
 */
function isAvailable() {
  if (process.platform !== 'darwin') return false;
  try {
    accessSync(dbPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gibt den aktuellen Status des iMessage-Kanals zurück.
 * @returns {Promise<Object>} - Status-Objekt
 */
async function getStatus() {
  const available = isAvailable();
  return {
    available,
    platform: process.platform,
    chatDbReadable: available,
    allowedHandle: process.env.IMESSAGE_ALLOWED_HANDLE || null,
    running: _running,
    note: 'iMessage-Anbindung nur auf macOS mit lesbarer Messages-Datenbank (Systemeinstellungen → Datenschutz → Vollzugriff auf Festplatte für das ausführende Programm/Terminal nötig).'
  };
}

/**
 * Sendet eine iMessage über osascript.
 * @param {string} to - Empfänger-Handle (Telefonnummer oder E-Mail)
 * @param {string} text - Nachrichtentext
 * @returns {Promise<Object>} - Ergebnis der Nachrichtensendung
 */
async function sendMessage(to, text) {
  if (!isAvailable()) {
    return { sent: false, reason: 'imessage-unavailable' };
  }

  return new Promise((resolve) => {
    execFile('osascript', ['-e', scriptTemplate, to, text], { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          sent: false,
          reason: 'osascript-failed',
          stderr: stderr || error.message
        });
      } else {
        resolve({ sent: true });
      }
    });
  });
}

/**
 * Startet den iMessage-Polling-Loop.
 * @returns {Promise<Object>} - Ergebnis des Starts
 */
async function start() {
  if (!isAvailable()) {
    return { started: false, reason: 'imessage-unavailable' };
  }

  if (!process.env.IMESSAGE_ALLOWED_HANDLE) {
    return { started: false, reason: 'imessage-allowed-handle-not-configured' };
  }

  if (_running) {
    return { started: false, reason: 'already-running' };
  }

  _running = true;
  _intervalHandle = setInterval(async () => {
    let db;
    try {
      db = new Database(dbPath, { readonly: true, fileMustExist: true });
      const rows = db.prepare(`
        SELECT message.ROWID as rowid, message.text as text, handle.id as sender 
        FROM message 
        JOIN handle ON message.handle_id = handle.ROWID 
        WHERE message.ROWID > ? AND message.is_from_me = 0 
        ORDER BY message.ROWID ASC
      `).all(_lastRowId);

      for (const row of rows) {
        _lastRowId = Math.max(_lastRowId, row.rowid);
        if (!row.text) continue;
        if (row.sender !== process.env.IMESSAGE_ALLOWED_HANDLE) {
          console.log(`iMessage von nicht erlaubtem Handle ${row.sender} ignoriert`);
          continue;
        }

        // Fire-and-forget Mission-Trigger
        require('./channel.responder.js').triggerMissionAsync(row.text)
          .then(ergebnisText => {
            if (ergebnisText) {
              sendMessage(row.sender, ergebnisText).catch(() => {});
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      // Fehler beim Lesen der DB ignorieren, nächster Tick probiert es erneut
    } finally {
      if (db) db.close();
    }
  }, 10000);

  return { started: true };
}

/**
 * Stoppt den iMessage-Polling-Loop.
 * @returns {Promise<Object>} - Ergebnis des Stops
 */
async function stop() {
  const wasRunning = _running;
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
  _running = false;
  _lastRowId = 0;
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

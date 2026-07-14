/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Gemeinsame Antwort-Logik für Messaging-Kanäle (S4) — async, nicht-blockierend für Webhook-Kanäle, injection-sicher via execFile

const { execFile } = require('node:child_process');
const path = require('node:path');

const KIOS_ROOT = path.resolve(__dirname, '../../..');

/**
 * Bereinigt die CLI-Ausgabe von Banner-Zeilen
 * @param {string} text - Rohausgabe der CLI
 * @returns {string} Bereinigte Ausgabe
 */
function cleanMissionOutput(text) {
    return text
        .split('\n')
        .filter(line => !line.includes('█') &&
                       !line.includes('░') &&
                       !line.includes('KI-OS Console') &&
                       !line.includes('Business Edition'))
        .join('\n')
        .trim();
}

/**
 * Prüft, ob der Text ein Command ist
 * @param {string} text - Eingabetext
 * @returns {boolean} true, wenn es sich um einen Command handelt
 */
function isCommand(text) {
    const trimmed = text.trim();
    return trimmed.startsWith('/') ||
           ['status', 'hilfe', 'help'].includes(trimmed.toLowerCase());
}

/**
 * Startet eine KIMBA-Mission asynchron
 * @param {string} text - Missionsbeschreibung
 * @param {Object} [options] - Optionen
 * @param {number} [options.budget=0.25] - Budget für die Mission
 * @param {number} [options.timeoutMs=180000] - Timeout in Millisekunden
 * @returns {Promise<string>} Bereinigte Mission-Ausgabe oder Fehlermeldung
 */
function triggerMissionAsync(text, { budget = 0.25, timeoutMs = 180000 } = {}) {
    return new Promise((resolve) => {
        execFile(
            'node',
            [
                path.join(KIOS_ROOT, 'cli/dist/cli/index.js'),
                'mission',
                'start',
                text,
                '--budget',
                String(budget)
            ],
            {
                timeout: timeoutMs,
                encoding: 'utf8'
            },
            (error, stdout, stderr) => {
                if (error) {
                    let errorMessage = 'Die Anfrage konnte nicht verarbeitet werden: ';
                    if (error.killed && error.signal === 'SIGTERM') {
                        // Node setzt bei execFile-Timeout error.code NICHT auf 'ETIMEDOUT',
                        // sondern killed:true + signal:'SIGTERM' (live verifiziert)
                        errorMessage += 'Timeout (Mission dauerte zu lange)';
                    } else if (error.code === 'ENOENT') {
                        errorMessage += 'KI-OS CLI nicht gefunden';
                    } else {
                        errorMessage += stderr ? stderr.trim() : error.message;
                    }
                    resolve(errorMessage);
                    return;
                }

                resolve(cleanMissionOutput(stdout));
            }
        );
    });
}

module.exports = {
    triggerMissionAsync,
    cleanMissionOutput,
    isCommand,
    KIOS_ROOT
};

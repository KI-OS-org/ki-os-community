/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only

/**
 * Session Recorder — zeichnet Agenten-Läufe auf und speichert sie als JSON
 */

const fs = require('fs');
const path = require('path');

const RECORDER_PATH = process.env.SESSION_RECORDER_PATH || '.ki-os-sessions';

// Verzeichnis anlegen wenn nötig
function ensureDir() {
  fs.mkdirSync(RECORDER_PATH, { recursive: true });
}

/**
 * Startet eine neue Session-Aufzeichnung
 * @param {string} runId - Eindeutige ID des Laufs
 * @param {string} goal - Ziel der Session
 * @returns {object} Der erstellte Session-Eintrag
 */
function startRecording(runId, goal) {
  ensureDir();
  const session = {
    runId,
    goal,
    startedAt: new Date().toISOString(),
    steps: [],
    finalAnswer: null,
    reflectionScore: null,
    costUsd: 0,
    status: 'recording'
  };
  // Temporär speichern während der Aufnahme
  const filePath = path.join(RECORDER_PATH, `${runId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  return session;
}

/**
 * Zeichnet einen Schritt auf
 * @param {string} runId - ID des Laufs
 * @param {object} step - Schritt-Daten { role, input, output, durationMs }
 */
function recordStep(runId, step) {
  ensureDir();
  const filePath = path.join(RECORDER_PATH, `${runId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Session ${runId} nicht gefunden`);
  }
  const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  session.steps.push({
    role: step.role,
    input: step.input,
    output: step.output,
    durationMs: step.durationMs
  });
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
}

/**
 * Finalisiert eine Session-Aufzeichnung
 * @param {string} runId - ID des Laufs
 * @param {object} data - Finale Daten { finalAnswer, reflectionScore, costUsd, status }
 */
function finalizeRecording(runId, { finalAnswer, reflectionScore, costUsd, status }) {
  ensureDir();
  const filePath = path.join(RECORDER_PATH, `${runId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Session ${runId} nicht gefunden`);
  }
  const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  session.finalAnswer = finalAnswer ?? null;
  session.reflectionScore = reflectionScore ?? null;
  session.costUsd = costUsd ?? 0;
  session.status = status ?? 'completed';
  session.completedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  return session;
}

/**
 * Liest eine Session-Aufzeichnung
 * @param {string} runId - ID des Laufs
 * @returns {object|null} Session-Daten oder null wenn nicht gefunden
 */
function getRecording(runId) {
  ensureDir();
  const filePath = path.join(RECORDER_PATH, `${runId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Listet alle Session-Aufzeichnungen auf
 * @param {number} limit - Maximale Anzahl zurückzugebender Einträge (default: 20)
 * @returns {array} Array von Session-Daten, sortiert nach startedAt (neueste zuerst)
 */
function listRecordings(limit = 20) {
  ensureDir();
  const files = fs.readdirSync(RECORDER_PATH)
    .filter(f => f.endsWith('.json'));
  
  const sessions = files.map(f => {
    const filePath = path.join(RECORDER_PATH, f);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  });
  
  // Sortieren nach startedAt (neueste zuerst)
  sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  
  return sessions.slice(0, limit);
}

/**
 * Löscht eine Session-Aufzeichnung
 * @param {string} runId - ID des Laufs
 * @returns {boolean} true wenn erfolgreich gelöscht, false wenn nicht gefunden
 */
function deleteRecording(runId) {
  ensureDir();
  const filePath = path.join(RECORDER_PATH, `${runId}.json`);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  fs.unlinkSync(filePath);
  return true;
}

module.exports = {
  startRecording,
  recordStep,
  finalizeRecording,
  getRecording,
  listRecordings,
  deleteRecording
};

/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Timeline NDJSON-Speicher (S6, vD4) — ungecappte Langzeit-Historie im Unterschied zum 200-Zeilen-Cap in kimba-screen-watch.mjs

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const TIMELINE_PATH = path.join(os.homedir(), '.kios', 'timeline.ndjson');

/**
 * Normalisiert einen Timeline-Eintrag.
 * @param {Object} entry - Der zu normalisierende Eintrag
 * @returns {Object} Normalisierter Eintrag
 */
function normalizeEntry(entry) {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    app: entry.app || '',
    windowTitle: entry.windowTitle || '',
    content: entry.content || '',
    change: entry.change || '',
    message: entry.message || '',
    urgency: entry.urgency || 'low'
  };
}

/**
 * Liest alle Einträge aus der Timeline-Datei.
 * @returns {Array} Array mit allen Einträgen
 */
function readAllEntries() {
  try {
    if (!fs.existsSync(TIMELINE_PATH)) return [];
    const content = fs.readFileSync(TIMELINE_PATH, 'utf8');
    return content.split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(entry => entry !== null);
  } catch {
    return [];
  }
}

/**
 * Schreibt alle Einträge in die Timeline-Datei.
 * @param {Array} entries - Die zu schreibenden Einträge
 */
function writeAllEntries(entries) {
  const dir = path.dirname(TIMELINE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
  fs.writeFileSync(TIMELINE_PATH, content, 'utf8');
}

module.exports = {
  TIMELINE_PATH,

  /**
   * Fügt einen neuen Eintrag zur Timeline hinzu.
   * @param {Object} entry - Der hinzuzufügende Eintrag
   * @returns {Object} Der normalisierte Eintrag
   */
  append(entry) {
    const dir = path.dirname(TIMELINE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const normalized = normalizeEntry(entry);
    fs.appendFileSync(TIMELINE_PATH, JSON.stringify(normalized) + '\n', 'utf8');
    return normalized;
  },

  /**
   * Liest die neuesten Einträge aus der Timeline.
   * @param {number} [limit=50] - Maximale Anzahl Einträge
   * @returns {Array} Die neuesten Einträge (neueste zuerst)
   */
  readRecent(limit = 50) {
    const entries = readAllEntries();
    return entries.slice(-limit).reverse();
  },

  /**
   * Liest Einträge in einem bestimmten Zeitbereich.
   * @param {string} fromISO - Startzeitpunkt (ISO-8601)
   * @param {string} toISO - Endzeitpunkt (ISO-8601)
   * @returns {Array} Einträge im Zeitbereich (chronologisch)
   */
  readRange(fromISO, toISO) {
    return readAllEntries().filter(entry =>
      entry.timestamp >= fromISO && entry.timestamp <= toISO
    );
  },

  /**
   * Löscht Einträge in einem bestimmten Zeitbereich.
   * @param {string} fromISO - Startzeitpunkt (ISO-8601)
   * @param {string} toISO - Endzeitpunkt (ISO-8601)
   * @returns {Object} { deletedCount: Anzahl gelöschter Einträge }
   */
  deleteRange(fromISO, toISO) {
    const allEntries = readAllEntries();
    if (allEntries.length === 0) {
      return { deletedCount: 0 };
    }
    const keptEntries = allEntries.filter(entry =>
      entry.timestamp < fromISO || entry.timestamp > toISO
    );
    writeAllEntries(keptEntries);
    return { deletedCount: allEntries.length - keptEntries.length };
  },

  /**
   * Zählt die Gesamtzahl der Einträge in der Timeline.
   * @returns {number} Anzahl Einträge
   */
  count() {
    return readAllEntries().length;
  }
};

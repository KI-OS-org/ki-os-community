/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Timeline semantischer Such-Index (S6, vD4) via LanceDB — optionale Dependency, fail-safe ohne Installation

'use strict';

const LANCEDB_PATH = process.env.LANCEDB_PATH || './.ki-os-lancedb';
const TABLE_NAME   = 'kios_timeline';

let lancedb = null;
try {
  lancedb = require('@lancedb/lancedb');
} catch {
  // optionalDependency — Community Edition läuft ohne LanceDB
}

const { embed } = require('../memory/embedding.service');

let _db    = null;
let _table = null;
let _ready = false;

async function _ensureReady() {
  if (_ready) return;

  _db = await lancedb.connect(LANCEDB_PATH);
  const tables = await _db.tableNames();

  if (tables.includes(TABLE_NAME)) {
    _table = await _db.openTable(TABLE_NAME);
  } else {
    // Schema via erstem Dummy-Record anlegen
    const zeroVec = await embed('init');
    _table = await _db.createTable(TABLE_NAME, [{
      id: '_init',
      timestamp: new Date(0).toISOString(),
      app: 'system',
      windowTitle: 'schema-init',
      content: 'init',
      change: 'none',
      message: 'init',
      urgency: 'low',
      vector: Array.from(zeroVec),
      createdAt: Date.now(),
    }]);
    await _table.delete("id = '_init'");
  }

  _ready = true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Prüft, ob LanceDB verfügbar ist.
 * @returns {boolean}
 */
function isAvailable() {
  return lancedb !== null;
}

/**
 * Indexiert einen Timeline-Eintrag.
 * @param {Object} entry - Timeline-Eintrag
 * @returns {Promise<Object>} Ergebnis des Indexvorgangs
 */
async function indexEntry(entry) {
  if (!isAvailable()) {
    return { indexed: false, reason: 'lancedb-unavailable' };
  }

  try {
    await _ensureReady();

    const searchText = [entry.app, entry.windowTitle, entry.content, entry.change, entry.message]
      .filter(Boolean)
      .join(' — ');

    const vector = Array.from(await embed(searchText));

    await _table.add([{
      id: entry.id,
      timestamp: entry.timestamp,
      app: entry.app || '',
      windowTitle: entry.windowTitle || '',
      content: entry.content || '',
      change: entry.change || '',
      message: entry.message || '',
      urgency: entry.urgency || 'low',
      vector,
      createdAt: Date.now(),
    }]);

    return { indexed: true, id: entry.id };
  } catch (err) {
    return { indexed: false, reason: 'index-error', error: err.message };
  }
}

/**
 * Durchsucht die Timeline semantisch.
 * @param {string} query - Suchanfrage
 * @param {number} limit - Maximale Ergebnisse
 * @returns {Promise<Object>} Suchergebnisse
 */
async function search(query, limit = 10) {
  if (!isAvailable()) {
    return { results: [], reason: 'lancedb-unavailable' };
  }

  try {
    await _ensureReady();

    const vector = Array.from(await embed(query));
    const rows = await _table.vectorSearch(vector).limit(limit).toArray();

    return {
      results: rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        app: row.app,
        windowTitle: row.windowTitle,
        content: row.content,
        change: row.change,
        message: row.message,
        urgency: row.urgency,
      }))
    };
  } catch (err) {
    return { results: [], reason: 'search-error', error: err.message };
  }
}

/**
 * Löscht Timeline-Einträge im Zeitbereich.
 * @param {string} fromISO - Startzeitpunkt (ISO)
 * @param {string} toISO - Endzeitpunkt (ISO)
 * @returns {Promise<Object>} Löschstatus
 */
async function deleteRange(fromISO, toISO) {
  if (!isAvailable()) {
    return { deletedCount: 0, reason: 'lancedb-unavailable' };
  }

  try {
    await _ensureReady();

    await _table.delete(
      `timestamp >= '${fromISO.replace(/'/g,"''")}' AND timestamp <= '${toISO.replace(/'/g,"''")}'`
    );

    return { deletedCount: true }; // LanceDB liefert keine genaue Anzahl zurück
  } catch (err) {
    return { deletedCount: 0, reason: 'delete-error', error: err.message };
  }
}

/**
 * Prüft den Zustand des LanceDB-Adapters.
 * @returns {Promise<Object>} Gesundheitsstatus
 */
async function health() {
  try {
    if (!isAvailable()) {
      return { ok: false, adapter: 'timeline-lancedb', error: 'nicht installiert', path: LANCEDB_PATH };
    }
    await _ensureReady();
    return { ok: true, adapter: 'timeline-lancedb', path: LANCEDB_PATH };
  } catch (err) {
    return { ok: false, adapter: 'timeline-lancedb', error: err.message, path: LANCEDB_PATH };
  }
}

module.exports = { isAvailable, indexEntry, search, deleteRange, health };

/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Skill Manifest — verwaltet installed.json für externe Skills
'use strict';
const fs   = require('fs');
const path = require('path');

// readManifest(manifestPath) → Array (leer wenn Datei fehlt)
function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return [];
  try { return JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { return []; }
}

// writeManifest(manifestPath, entries) → void; erstellt Verzeichnis falls nötig
function writeManifest(manifestPath, entries) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2), 'utf8');
}

// addEntry(manifestPath, entry) → void; entry = { name, source, installedAt }; doppelte name werden gefiltert
function addEntry(manifestPath, entry) {
  const entries = readManifest(manifestPath);
  const filtered = entries.filter(e => e.name !== entry.name);
  filtered.push(entry);
  writeManifest(manifestPath, filtered);
}

// removeEntry(manifestPath, name) → void
function removeEntry(manifestPath, name) {
  const entries = readManifest(manifestPath);
  writeManifest(manifestPath, entries.filter(e => e.name !== name));
}

module.exports = { readManifest, writeManifest, addEntry, removeEntry };

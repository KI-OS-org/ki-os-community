/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(process.cwd(), '.ki-os-runtime-state.json');

// Kritische Dateien die überwacht werden (Pfade relativ zu process.cwd())
const WATCHED_FILES = [
  'backend/services/core/runtime.policy.js',
  'backend/middleware/license.gate.js',
  'backend/services/agentmesh/mesh.runtime.js',
  'backend/services/license/license.service.js'
];

function hashFile(filePath) {
  try {
    const abs = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(abs);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

function buildManifest() {
  const manifest = { generatedAt: new Date().toISOString(), files: {} };
  for (const f of WATCHED_FILES) {
    manifest.files[f] = hashFile(f);
  }
  return manifest;
}

function checkIntegrity() {
  const current = buildManifest();

  // Kein gespeichertes Manifest → ersten Stand speichern
  if (!fs.existsSync(MANIFEST_PATH)) {
    try { fs.writeFileSync(MANIFEST_PATH, JSON.stringify(current, null, 2), 'utf8'); } catch {}
    return { ok: true, firstRun: true };
  }

  let stored;
  try {
    stored = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    // Manifest unlesbar → neu schreiben
    try { fs.writeFileSync(MANIFEST_PATH, JSON.stringify(current, null, 2), 'utf8'); } catch {}
    return { ok: true, reset: true };
  }

  const changed = [];
  for (const f of WATCHED_FILES) {
    if (stored.files[f] && current.files[f] && stored.files[f] !== current.files[f]) {
      changed.push(f);
    }
  }

  if (changed.length > 0) {
    // Subtiles Logging — kein Crash, kein offensichtlicher Hinweis
    console.warn('[runtime] policy state mismatch detected:', changed.length, 'file(s)');
    // Manifest aktualisieren damit nicht bei jedem Start gewarnt wird
    try { fs.writeFileSync(MANIFEST_PATH, JSON.stringify(current, null, 2), 'utf8'); } catch {}
    return { ok: false, changed };
  }

  return { ok: true };
}

function initIntegrity() {
  return checkIntegrity();
}

module.exports = { initIntegrity, checkIntegrity, buildManifest };

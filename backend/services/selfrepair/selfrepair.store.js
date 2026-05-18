/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
/**
 * KI-OS SelfRepair Store
 * Persistenz für Incidents: .ki-os-incidents.json im Root.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const STORE_PATH = path.join(__dirname, '../../../.ki-os-incidents.json');

function load() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { incidents: [], version: 1 };
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { incidents: [], version: 1 };
  }
}

function save(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Incident CRUD
// ---------------------------------------------------------------------------
function createIncident({ level, source, error, stack, context }) {
  const store = load();
  const now   = new Date().toISOString();

  // Deduplizierung: gleicher Fehler in den letzten 10 Min → Occurrences hochzählen
  const recent = store.incidents.find(i =>
    i.error === error &&
    i.source === source &&
    i.status !== 'resolved' &&
    (Date.now() - new Date(i.createdAt).getTime()) < 10 * 60 * 1000
  );
  if (recent) {
    recent.occurrences = (recent.occurrences || 1) + 1;
    recent.updatedAt   = now;
    // Level eskalieren wenn Fehler häufig auftritt
    if (recent.occurrences >= 5 && recent.level > 1) {
      recent.level = recent.level - 1;
      recent.escalatedAt = now;
    }
    save(store);
    return recent;
  }

  const incident = {
    id:             randomUUID(),
    level,          // 1 = kritisch, 2 = night-slot, 3 = nächstes Release
    source,         // service / path
    error,          // Fehlermeldung
    stack:          stack || '',
    context:        context || {},
    status:         'open',   // open | analyzing | fix_ready | approved | applied | resolved | deferred
    occurrences:    1,
    aiAnalysis:     null,
    suggestedFix:   null,
    confidence:     null,
    affectedFile:   null,
    adminNotified:  false,
    notes:          '',
    createdAt:      now,
    updatedAt:      now,
    scheduledFor:   null,
    resolvedAt:     null,
  };

  store.incidents.unshift(incident);
  // Keep max 500 incidents
  if (store.incidents.length > 500) store.incidents = store.incidents.slice(0, 500);
  save(store);
  return incident;
}

function updateIncident(id, patch) {
  const store = load();
  const idx   = store.incidents.findIndex(i => i.id === id);
  if (idx === -1) return null;
  Object.assign(store.incidents[idx], patch, { updatedAt: new Date().toISOString() });
  save(store);
  return store.incidents[idx];
}

function getIncident(id) {
  return load().incidents.find(i => i.id === id) || null;
}

function listIncidents({ level, status, limit = 100, offset = 0 } = {}) {
  let { incidents } = load();
  if (level  !== undefined) incidents = incidents.filter(i => i.level  === Number(level));
  if (status !== undefined) incidents = incidents.filter(i => i.status === status);
  return { incidents: incidents.slice(offset, offset + limit), total: incidents.length };
}

function getStats() {
  const { incidents } = load();
  const open = incidents.filter(i => i.status !== 'resolved' && i.status !== 'deferred');
  return {
    total:      incidents.length,
    open:       open.length,
    l1_open:    open.filter(i => i.level === 1).length,
    l2_open:    open.filter(i => i.level === 2).length,
    l3_open:    open.filter(i => i.level === 3).length,
    fix_ready:  open.filter(i => i.status === 'fix_ready').length,
    resolved:   incidents.filter(i => i.status === 'resolved').length,
  };
}

module.exports = { createIncident, updateIncident, getIncident, listIncidents, getStats };

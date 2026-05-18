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
 * KI-OS SelfRepair Service — Haupt-Einstiegspunkt
 * Wird von core/app.js und runtime/local/server.js verwendet.
 *
 * Verwendung:
 *   const { captureError, startSelfRepair } = require('./services/selfrepair/selfrepair.service');
 *
 *   // Im Error-Handler:
 *   captureError({ error: e.message, stack: e.stack, source: path });
 *
 *   // Beim Server-Start:
 *   startSelfRepair();
 */
'use strict';

const store      = require('./selfrepair.store');
const classifier = require('./selfrepair.classifier');
const notifier   = require('./selfrepair.notifier');
const scheduler  = require('./selfrepair.scheduler');

let _started = false;

// ---------------------------------------------------------------------------
// Fehler erfassen, klassifizieren, persistieren und reagieren
// ---------------------------------------------------------------------------
async function captureError({ error, stack, source, context = {} }) {
  // Eigene SelfRepair-Fehler nicht rekursiv erfassen
  if (source && String(source).includes('selfrepair')) return null;

  const level       = classifier.classify({ error, stack, source, context });
  const affectedFile = classifier.extractAffectedFile(stack);

  // Incident anlegen (mit Dedup-Schutz)
  const incident = store.createIncident({ level, source, error, stack, context });
  if (affectedFile && !incident.affectedFile) {
    store.updateIncident(incident.id, { affectedFile });
    incident.affectedFile = affectedFile;
  }

  // Admin sofort über UI informieren (non-blocking)
  notifier.notifyUI(incident);

  // L1: sofortige AI-Analyse + Email
  if (level === 1 && incident.occurrences === 1) {
    // Fire-and-forget — kein await, damit der Error-Handler nicht blockiert
    scheduler.triggerImmediateAnalysis(incident).catch(() => {});
  }

  // L2/L3: nur UI-Notification, Night-Slot oder Backlog
  if (level === 2 && incident.occurrences === 1) {
    const nextSlot = new Date();
    nextSlot.setHours(Number(process.env.SELFREPAIR_NIGHT_HOUR || 2), 0, 0, 0);
    if (nextSlot <= new Date()) nextSlot.setDate(nextSlot.getDate() + 1);
    store.updateIncident(incident.id, { scheduledFor: nextSlot.toISOString() });
    // Email bei L2 erst nach Night-Slot (notifier sendet dann)
  }

  return incident;
}

// ---------------------------------------------------------------------------
// Unhandled Exceptions + Unhandled Rejections abfangen
// ---------------------------------------------------------------------------
function setupProcessHandlers() {
  process.on('uncaughtException', (err) => {
    captureError({
      error:  err.message || String(err),
      stack:  err.stack   || '',
      source: 'process.uncaughtException',
      context: { fatal: true },
    }).catch(() => {});
    // Nach kurzer Pause normal weiter — KI-OS läuft weiter
    // (kein process.exit — das überlassen wir dem Admin)
  });

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    captureError({
      error:  err.message,
      stack:  err.stack || '',
      source: 'process.unhandledRejection',
    }).catch(() => {});
  });
}

// ---------------------------------------------------------------------------
// SelfRepair starten (aufgerufen beim Server-Start)
// ---------------------------------------------------------------------------
function startSelfRepair() {
  if (_started) return;
  _started = true;

  setupProcessHandlers();
  scheduler.startScheduler();

  try {
    const logger = require('../core/logger.service');
    logger.info('[SelfRepair] System aktiv', {
      nightSlot: `${process.env.SELFREPAIR_NIGHT_HOUR || 2}:00`,
      adminEmail: process.env.ADMIN_EMAIL || '(nicht konfiguriert)',
    });
  } catch {}
}

module.exports = { captureError, startSelfRepair };

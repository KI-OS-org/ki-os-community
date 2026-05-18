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
 * KI-OS SelfRepair Scheduler
 * Night-Slot für L2 Incidents (Standard: 02:00 Uhr).
 * Startet automatisch beim Server-Start.
 */
'use strict';

const NIGHT_SLOT_HOUR   = Number(process.env.SELFREPAIR_NIGHT_HOUR   || 2);   // 02:00
const NIGHT_SLOT_MINUTE = Number(process.env.SELFREPAIR_NIGHT_MINUTE || 0);

let _timer = null;

function msUntilNextSlot() {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(NIGHT_SLOT_HOUR, NIGHT_SLOT_MINUTE, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

// ---------------------------------------------------------------------------
// Night-Slot Job: analysiert alle offenen L2 Incidents
// ---------------------------------------------------------------------------
async function runNightSlot() {
  const { listIncidents, updateIncident } = require('./selfrepair.store');
  const { analyzeAndRepair }              = require('./selfrepair.repair');
  const { notify, notifyDailySummary }    = require('./selfrepair.notifier');
  const logger = require('../core/logger.service');

  logger.info('[SelfRepair] Night-Slot gestartet', { hour: NIGHT_SLOT_HOUR });

  const { incidents } = listIncidents({ status: 'open' });
  const l2 = incidents.filter(i => i.level === 2);
  const l3 = incidents.filter(i => i.level === 3);

  for (const incident of l2) {
    try {
      logger.info('[SelfRepair] Analysiere L2 Incident', { id: incident.id });
      updateIncident(incident.id, { status: 'analyzing', scheduledFor: new Date().toISOString() });
      const analysis = await analyzeAndRepair(incident);
      const updated  = updateIncident(incident.id, {
        status:       'fix_ready',
        aiAnalysis:   analysis,
        suggestedFix: analysis.suggestedFix,
        confidence:   analysis.confidence,
      });
      await notify(updated, { sendEmail: true });
    } catch (e) {
      logger.error('[SelfRepair] Night-Slot Analyse fehlgeschlagen', { id: incident.id, error: e.message });
      updateIncident(incident.id, { notes: `Analyse fehlgeschlagen: ${e.message}` });
    }
  }

  // Tagesübersicht (L2 processed + L3 Backlog)
  const { incidents: refreshed } = listIncidents({ status: 'fix_ready' });
  await notifyDailySummary([...refreshed.filter(i => i.level === 2), ...l3]);

  logger.info('[SelfRepair] Night-Slot abgeschlossen', { l2Processed: l2.length, l3Listed: l3.length });
}

// ---------------------------------------------------------------------------
// L1 Sofort-Analyse (wird direkt nach Incident-Erstellung aufgerufen)
// ---------------------------------------------------------------------------
async function triggerImmediateAnalysis(incident) {
  const { analyzeAndRepair }           = require('./selfrepair.repair');
  const { updateIncident }             = require('./selfrepair.store');
  const { notify }                     = require('./selfrepair.notifier');
  const logger = require('../core/logger.service');

  try {
    logger.warn('[SelfRepair] L1 Sofort-Analyse gestartet', { id: incident.id });
    updateIncident(incident.id, { status: 'analyzing' });
    const analysis = await analyzeAndRepair(incident);
    const updated  = updateIncident(incident.id, {
      status:       'fix_ready',
      aiAnalysis:   analysis,
      suggestedFix: analysis.suggestedFix,
      confidence:   analysis.confidence,
      affectedFile: incident.affectedFile || analysis.affectedFile || null,
    });
    await notify(updated, { sendEmail: true });
    logger.warn('[SelfRepair] L1 Fix bereit', {
      id:         updated.id,
      confidence: analysis.confidence,
      hasFix:     !!analysis.suggestedFix,
    });
  } catch (e) {
    logger.error('[SelfRepair] L1 Analyse fehlgeschlagen', { id: incident.id, error: e.message });
    const updated = updateIncident(incident.id, {
      status: 'open',
      notes:  `Automatische Analyse fehlgeschlagen: ${e.message}`,
    });
    await notify(updated, { sendEmail: true });
  }
}

// ---------------------------------------------------------------------------
// Scheduler starten
// ---------------------------------------------------------------------------
function startScheduler() {
  if (_timer) return;

  const delay = msUntilNextSlot();
  const hours = Math.floor(delay / 3600000);
  const mins  = Math.floor((delay % 3600000) / 60000);

  try {
    const logger = require('../core/logger.service');
    logger.info(`[SelfRepair] Night-Slot Scheduler aktiv`, {
      nextRun: `${NIGHT_SLOT_HOUR}:${String(NIGHT_SLOT_MINUTE).padStart(2, '0')} Uhr`,
      inMs:    delay,
      inTime:  `${hours}h ${mins}m`,
    });
  } catch {}

  _timer = setTimeout(async function tick() {
    await runNightSlot().catch(() => {});
    // Nächsten Tag planen
    _timer = setTimeout(tick, msUntilNextSlot());
  }, delay);
}

function stopScheduler() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
}

module.exports = { startScheduler, stopScheduler, runNightSlot, triggerImmediateAnalysis };

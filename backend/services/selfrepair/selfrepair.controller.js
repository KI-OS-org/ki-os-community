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
 * KI-OS SelfRepair Controller
 * HTTP-Endpunkte für das Admin-Dashboard.
 *
 * Routen (alle unter /selfrepair):
 *   GET  /selfrepair              — Incident-Liste + Stats
 *   GET  /selfrepair/stats        — nur Stats
 *   GET  /selfrepair/:id          — Incident-Detail
 *   PUT  /selfrepair/:id          — Status/Notes aktualisieren
 *   POST /selfrepair/:id/analyze  — AI-Analyse manuell anstoßen
 *   POST /selfrepair/:id/resolve  — Als gelöst markieren
 *   POST /selfrepair/:id/defer    — Zurückstellen
 *   POST /selfrepair/trigger      — Test-Incident manuell auslösen (Admin)
 */
'use strict';

const store     = require('./selfrepair.store');
const notifier  = require('./selfrepair.notifier');
const scheduler = require('./selfrepair.scheduler');

async function handleSelfRepairRequest(path, method, body = {}, ctx = {}) {

  // GET /selfrepair/stats
  if (path === '/selfrepair/stats' && method === 'GET') {
    return { statusCode: 200, body: store.getStats() };
  }

  // GET /selfrepair
  if (path === '/selfrepair' && method === 'GET') {
    const { level, status, limit, offset } = body;
    const result = store.listIncidents({
      level:  level  !== undefined ? Number(level)  : undefined,
      status: status || undefined,
      limit:  limit  ? Number(limit)  : 50,
      offset: offset ? Number(offset) : 0,
    });
    return { statusCode: 200, body: { ...result, stats: store.getStats() } };
  }

  // POST /selfrepair/trigger — manueller Test-Incident
  if (path === '/selfrepair/trigger' && method === 'POST') {
    const { assertRole } = require('../ui/ui.auth');
    try { assertRole(ctx, ['admin']); } catch {
      return { statusCode: 403, body: { error: 'admin required' } };
    }
    const { captureError } = require('./selfrepair.service');
    const incident = await captureError({
      error:   body.error   || 'Test-Fehler vom Admin',
      stack:   body.stack   || 'TestError: Manuell ausgelöst\n  at adminTrigger (/selfrepair/test)',
      source:  body.source  || '/selfrepair/trigger',
      context: { manual: true, triggeredBy: ctx.pki?.userId || 'admin', ...(body.context || {}) },
    });
    return { statusCode: 201, body: incident };
  }

  // GET /selfrepair/:id
  const matchGet = path.match(/^\/selfrepair\/([^/]+)$/);
  if (matchGet && method === 'GET') {
    const incident = store.getIncident(matchGet[1]);
    if (!incident) return { statusCode: 404, body: { error: 'not found' } };
    return { statusCode: 200, body: incident };
  }

  // PUT /selfrepair/:id — Notes / Status manuell setzen
  const matchPut = path.match(/^\/selfrepair\/([^/]+)$/);
  if (matchPut && method === 'PUT') {
    const allowed = ['notes', 'status'];
    const patch   = {};
    allowed.forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
    const updated = store.updateIncident(matchPut[1], patch);
    if (!updated) return { statusCode: 404, body: { error: 'not found' } };
    return { statusCode: 200, body: updated };
  }

  // POST /selfrepair/:id/analyze — manuelle AI-Analyse
  const matchAnalyze = path.match(/^\/selfrepair\/([^/]+)\/analyze$/);
  if (matchAnalyze && method === 'POST') {
    const incident = store.getIncident(matchAnalyze[1]);
    if (!incident) return { statusCode: 404, body: { error: 'not found' } };
    if (incident.status === 'analyzing') {
      return { statusCode: 409, body: { error: 'Analyse läuft bereits' } };
    }
    // Async starten, sofort antworten
    scheduler.triggerImmediateAnalysis(incident).catch(() => {});
    return { statusCode: 202, body: { message: 'Analyse gestartet', incidentId: incident.id } };
  }

  // POST /selfrepair/:id/resolve
  const matchResolve = path.match(/^\/selfrepair\/([^/]+)\/resolve$/);
  if (matchResolve && method === 'POST') {
    const updated = store.updateIncident(matchResolve[1], {
      status:     'resolved',
      resolvedAt: new Date().toISOString(),
      notes:      body.notes || '',
    });
    if (!updated) return { statusCode: 404, body: { error: 'not found' } };
    notifier.notifyUI({ ...updated, status: 'resolved' });
    return { statusCode: 200, body: updated };
  }

  // POST /selfrepair/:id/defer
  const matchDefer = path.match(/^\/selfrepair\/([^/]+)\/defer$/);
  if (matchDefer && method === 'POST') {
    const updated = store.updateIncident(matchDefer[1], {
      status: 'deferred',
      notes:  body.notes || '',
    });
    if (!updated) return { statusCode: 404, body: { error: 'not found' } };
    return { statusCode: 200, body: updated };
  }

  return { statusCode: 404, body: { error: 'not found' } };
}

module.exports = { handleSelfRepairRequest };

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
 * KI-OS — Efficiency Agent Controller
 * HTTP-Handler für alle /efficiency/* Routen
 */
'use strict';

const { runAnalysis, getStatus } = require('./efficiency.service');
const store = require('./efficiency.store');
const logger = require('../core/logger.service');

async function handleRequest(req, res) {
  const url    = req.url || '';
  const method = req.method || 'GET';
  const path   = url.replace(/\?.*$/, '').replace(/^\/efficiency/, '');

  try {
    // GET /efficiency/status
    if (method === 'GET' && path === '/status') {
      return res.json({ ok: true, ...getStatus() });
    }

    // GET /efficiency/reports
    if (method === 'GET' && (path === '/reports' || path === '' || path === '/')) {
      const limit = parseInt(new URL(url, 'http://x').searchParams.get('limit') || '10');
      const reports = store.getReports({ limit });
      return res.json({ ok: true, reports, total: reports.length });
    }

    // GET /efficiency/reports/latest
    if (method === 'GET' && path === '/reports/latest') {
      const report = store.getLatest();
      return res.json({ ok: true, report });
    }

    // GET /efficiency/reports/:id
    const reportMatch = path.match(/^\/reports\/([^/]+)$/);
    if (method === 'GET' && reportMatch) {
      const report = store.getReport(reportMatch[1]);
      if (!report) return res.status(404).json({ ok: false, error: 'Report nicht gefunden' });
      return res.json({ ok: true, report });
    }

    // POST /efficiency/trigger — manueller Lauf
    if (method === 'POST' && path === '/trigger') {
      // Async starten, sofort antworten
      runAnalysis({ source: 'api' }).catch(e =>
        logger.error('efficiency.controller.trigger_failed', { message: e.message })
      );
      return res.json({ ok: true, message: 'Analyse gestartet', status: getStatus() });
    }

    return res.status(404).json({ ok: false, error: 'Route nicht gefunden' });
  } catch (e) {
    logger.error('efficiency.controller.error', { message: e.message, stack: e.stack });
    return res.status(500).json({ ok: false, error: e.message });
  }
}

module.exports = { handleRequest };

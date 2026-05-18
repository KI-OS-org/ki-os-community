/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v1.23.0) by Ingo Schaffer und Kimba
 * Datei: server.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
try { require('dotenv').config(); } catch {}
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createApp } = require('../../core/app');
const { assertProductionPki } = require('../../backend/services/pki/pki.runtime.guard');
const { bus } = require('../../backend/services/ui/ui.eventbus');
const { assertRole } = require('../../backend/services/ui/ui.auth');
const { assertRateLimit } = require('../../backend/services/core/rate-limit.service');
const { isEnterprise, getInfo } = require('../../backend/services/blauer-elefant/edition.guard');

// Runtime state check (unauffällig)
try {
  const { initIntegrity } = require('../../backend/services/core/integrity.service');
  initIntegrity();
} catch {}

function createServer() {
  assertProductionPki();
  const app = express();
  const core = createApp();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', version: require('../../package.json').version }));

  // n8n Sidecar — inbound webhooks + management
  app.use('/', require('../../backend/services/n8n/n8n.inbound.controller'));

  // MCP Gateway — SSE transport + status (vor app.all catch-all)
  app.use('/mcp/gateway', require('../../backend/routes/mcp.routes'));

  // Replay Service — P2 Re-Run aus LangGraph-Checkpoint
  app.use('/api/replay', require('../../backend/routes/replay.routes'));

  // Compliance / Evidence — P2 Audit-Reports aus OTel-Traces
  app.use('/api/compliance', require('../../backend/routes/compliance.routes'));
  app.use('/api/swarm', require('../../backend/routes/swarm.routes'));
  app.use('/api/auth', require('../../backend/routes/auth.routes'));
  app.use('/api/sessions', require('../../backend/routes/sessions.routes'));
  app.use('/api/roles', require('../../backend/routes/roles.routes'));
  app.use('/api/governance', require('../../backend/routes/governance.routes'));
  app.use('/api/handoff', require('../../backend/routes/handoff.routes'));
  app.use('/api/scorecard', require('../../backend/routes/scorecard.routes'));
  app.use('/api/intelligence', require('../../backend/routes/intelligence.routes'));
  app.use('/api/license', require('../../backend/routes/license.routes'));
  app.use('/api/tower', require('../../backend/routes/tower.routes'));
  app.use('/api/hierarchical', require('../../backend/services/hierarchical/hierarchical.routes'));
  app.use('/api/analytics', require('../../backend/routes/analytics.routes'));
  app.use('/api/voice', require('../../backend/routes/mobile.voice.routes'));
  app.use('/', require('../../backend/routes/mobile.voice.routes'));
  app.use('/api/mobile/fs', require('../../backend/routes/mobile.fs.routes'));
  app.use('/api/mobile', require('../../backend/routes/mobile.ask.routes'));

  // Decision Theater — Snapshots, Share-Links, Gallery
  app.use('/api/theater', require('../../backend/routes/theater.routes'));

  // Twin Playground — Szenarien, Simulator, Community-Marketplace
  app.use('/api/playground', require('../../backend/routes/playground.routes'));

  // A2A Protocol — Google Agent-to-Agent Standard
  app.use('/', require('../../backend/routes/a2a.routes'));

  // Ghost Control — Autonomous Planning + Execution
  app.use('/api/ghost', require('../../backend/routes/ghost.routes'));

  // MD Viewer — Markdown Viewer mit Explorer + Edit
  app.use('/api/md-viewer', require('../../backend/routes/md-viewer.routes'));

  // Ambient Sales Intelligence — CRM Service
  app.use('/api/sales', require('../../backend/routes/sales.routes'));

  app.get('/ui/stream', async (req, res) => {
    const allowHeaderRole = process.env.NODE_ENV === 'test' && String(process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE || 'true').toLowerCase() === 'true';
    const testContext = {
      pki: {
        authenticated: Boolean(req.headers['x-user-id']),
        userId: req.headers['x-user-id'] || 'guest',
        role: allowHeaderRole ? String(req.headers['x-role'] || 'guest').toLowerCase() : (req.headers['x-user-id'] ? 'user' : 'guest')
      }
    };
    const allowMobileBypass =
      process.env.KI_OS_ALLOW_REMOTE === 'true' &&
      req.headers['x-mobile-token'] === 'KIMBA_MOBILE';
    const allowLocalDev = process.env.LOCAL_DEV_MODE === 'true';
    if (!allowMobileBypass && !allowLocalDev) {
      try {
        assertRole(testContext, ['admin', 'operator', 'viewer', 'auditor', 'user']);
        assertRateLimit({ path: '/ui/stream', method: 'GET', headers: req.headers, ctx: testContext });
      } catch (error) {
        if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
        return res.status(error.statusCode || 401).json({ success: false, error: error.message });
      }
    }
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write('data: {"connected":true}\n\n');
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    }, Number(process.env.SSE_HEARTBEAT_MS || 15000));
    const handler = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    bus.on('event', handler);
    req.on('close', () => {
      clearInterval(heartbeat);
      bus.off('event', handler);
    });
  });

  app.use('/ui/mobile', express.static(path.join(__dirname, '../../backend/ui/mobile')));
  app.use('/ui/cdeck', express.static(path.join(__dirname, '../../c-deck')));

  app.all('*', async (req, res) => {
    try {
      const result = await core.handleHttp({
        runtime: 'local',
        path: req.path,
        method: req.method,
        headers: req.headers,
        query: req.query,
        body: req.body
      });
      const body = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
      const headers = Object.assign({ 'content-type': 'application/json; charset=utf-8' }, result.headers || {});
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      res.status(result.statusCode || 200).send(body);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return app;
}

// ---------------------------------------------------------------------------
// Community Edition Guard
// ---------------------------------------------------------------------------
function assertCommunityLocalhost() {
  if (isEnterprise()) return; // gültige Enterprise-Lizenz: keine Einschränkung

  const os = require('os');
  const hostname = os.hostname().toLowerCase();
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' ||
    hostname.startsWith('localhost.') ||
    // Windows: hostname is typically the machine name — check env override
    process.env.KI_OS_ALLOW_REMOTE === 'true';

  // Stricter: also check if HOSTNAME env is explicitly remote
  const envHostname = (process.env.HOSTNAME || '').toLowerCase();
  const isRemoteEnv = envHostname && envHostname !== 'localhost' && envHostname !== '127.0.0.1' &&
    !envHostname.includes('localhost');

  if (isRemoteEnv && process.env.KI_OS_ALLOW_REMOTE !== 'true') {
    console.error('');
    console.error('┌─────────────────────────────────────────────────────────┐');
    console.error('│  KI-OS Community Edition — LOKALER BETRIEB ERFORDERLICH  │');
    console.error('│                                                           │');
    console.error('│  Diese Edition darf nur auf localhost laufen.            │');
    console.error('│  Cloud- oder Server-Deployment erfordert die             │');
    console.error('│  Enterprise Edition.                                      │');
    console.error('│                                                           │');
    console.error('│  Kontakt: enterprise@ki-os.org                           │');
    console.error('└─────────────────────────────────────────────────────────┘');
    console.error('');
    process.exit(1);
  }
}

function start() {
  const port    = Number(process.env.PORT || 3000);
  const edition = (process.env.KI_OS_EDITION || 'community').toLowerCase();

  // SelfRepair starten (Scheduler + Process-Handler)
  try {
    const { startSelfRepair } = require('../../backend/services/selfrepair/selfrepair.service');
    startSelfRepair();
  } catch (e) {
    console.error('[SelfRepair] Konnte nicht gestartet werden:', e.message);
  }

  // Efficiency Agent starten (Wöchentlicher Competitive-Intelligence-Lauf)
  try {
    const { startEfficiencyAgent } = require('../../backend/services/efficiency/efficiency.service');
    startEfficiencyAgent();
  } catch (e) {
    console.error('[Efficiency] Konnte nicht gestartet werden:', e.message);
  }

  // Community Edition: refuse to start if remote, bind only to loopback
  assertCommunityLocalhost();
  const enterprise = isEnterprise();
  const bindHost   = enterprise ? '0.0.0.0' : (process.env.BIND_HOST || '127.0.0.1');

  const app = createServer();
  app.listen(port, bindHost, () => {
    const lic          = getInfo();
    const editionLabel = enterprise
      ? `ENTERPRISE (${lic.customer || 'lizenziert'}, läuft bis ${lic.expires})`
      : 'COMMUNITY (lokal)';
    console.log(`KI-OS V6 ONLINE — ${editionLabel} — Port ${port} @ ${bindHost}`);

    // Update-Check + Ping (Community)
    if (!enterprise) {
      try { require('../../backend/services/system-view/system-view.service').startTelemetry(); } catch {}
    }
  });
}

module.exports = { createServer, start };

if (require.main === module) {
  start();
}

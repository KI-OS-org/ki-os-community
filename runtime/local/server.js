/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: server.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
try { require('dotenv').config(); } catch {}
const express = require('express');
const cors = require('cors');
const { createApp } = require('../../core/app');
const { assertProductionPki } = require('../../backend/services/pki/pki.runtime.guard');
const { bus } = require('../../backend/services/ui/ui.eventbus');
const { assertRole } = require('../../backend/services/ui/ui.auth');
const { assertRateLimit } = require('../../backend/services/core/rate-limit.service');
const { isEnterprise, getInfo } = require('../../backend/services/blauer-elefant/edition.guard');

function createServer() {
  assertProductionPki();
  const app = express();
  const core = createApp();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/ui/stream', async (req, res) => {
    const allowHeaderRole = process.env.NODE_ENV === 'test' && String(process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE || 'true').toLowerCase() === 'true';
    const testContext = {
      pki: {
        authenticated: Boolean(req.headers['x-user-id']),
        userId: req.headers['x-user-id'] || 'guest',
        role: allowHeaderRole ? String(req.headers['x-role'] || 'guest').toLowerCase() : (req.headers['x-user-id'] ? 'user' : 'guest')
      }
    };
    try {
      assertRole(testContext, ['admin', 'operator', 'viewer', 'auditor', 'user']);
      assertRateLimit({ path: '/ui/stream', method: 'GET', headers: req.headers, ctx: testContext });
    } catch (error) {
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      return res.status(error.statusCode || 401).json({ success: false, error: error.message });
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
  const bindHost   = enterprise ? '0.0.0.0' : '127.0.0.1';

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

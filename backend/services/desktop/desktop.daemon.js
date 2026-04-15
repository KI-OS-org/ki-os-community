/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const logger = require('../core/logger.service');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const engine = require('./desktop.engine');
const companion = require('./desktop.companion');

const host = String(process.env.DESKTOP_DAEMON_HOST || '127.0.0.1');
const port = Number(process.env.DESKTOP_DAEMON_PORT || 47833);
const token = String(process.env.DESKTOP_DAEMON_TOKEN || 'ki-os-desktop-daemon');
const readyPath = path.join(companion.baseDir(), 'desktop-daemon.ready.json');

function respond(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { return {}; }
}

function authorized(req) {
  return req.headers['x-desktop-daemon-token'] === token;
}

async function route(req, res) {
  if (!authorized(req)) return respond(res, 401, { success: false, error: 'unauthorized_desktop_daemon' });
  if (req.url === '/health' && req.method === 'GET') {
    return respond(res, 200, { ok: true, pid: process.pid, port, daemon: true });
  }
  const body = await readBody(req);
  try {
    if (req.url === '/status' && req.method === 'GET') return respond(res, 200, await engine.getDesktopStatus());
    if (req.url === '/state' && req.method === 'GET') return respond(res, 200, await engine.getCompanionState());
    if (req.url == '/observe' && req.method === 'POST') return respond(res, 200, await engine.observeDesktop(body || {}));
    if (req.url == '/screenshot' && req.method === 'POST') return respond(res, 200, await engine.captureScreenshot(body || {}));
    if (req.url == '/action' && req.method === 'POST') return respond(res, 200, await engine.performDesktopAction(body.params || {}, body.ctx || {}));
    if (req.url == '/stop' && req.method === 'POST') return respond(res, 200, await engine.stopDesktopActions(body.reason || 'manual_stop'));
    if (req.url == '/clear-stop' && req.method === 'POST') return respond(res, 200, await engine.clearStopFlag());
    if (req.url == '/lock' && req.method === 'POST') return respond(res, 200, await engine.lockDesktopSession(body || {}));
    if (req.url == '/unlock' && req.method === 'POST') return respond(res, 200, await engine.unlockDesktopSession(body || {}));
    if (req.url == '/shutdown' && req.method === 'POST') {
      respond(res, 200, { success: true, stopped: true, pid: process.pid });
      setTimeout(() => process.exit(0), 50);
      return;
    }
    return respond(res, 404, { success: false, error: 'unsupported_desktop_daemon_route', path: req.url, method: req.method });
  } catch (e) {
    return respond(res, 500, { success: false, error: e.message || 'desktop_daemon_internal_error' });
  }
}

async function main() {
  await companion.ensureDir();
  const server = http.createServer((req, res) => { route(req, res); });
  server.listen(port, host, async () => {
    await fs.writeFile(readyPath, JSON.stringify({ pid: process.pid, port, host, startedAt: new Date().toISOString() }, null, 2), 'utf8');
  });
  const shutdown = async () => {
    try { await fs.rm(readyPath, { force: true }); } catch {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  logger.error('desktop.daemon.fatal', { message: e.message, stack: e.stack });
  process.exit(1);
});

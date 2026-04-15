/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const companion = require('./desktop.companion');

function daemonEnabled() {
  return String(process.env.DESKTOP_DAEMON_ENABLED || 'true') === 'true';
}
function daemonPort() { return Number(process.env.DESKTOP_DAEMON_PORT || 47833); }
function daemonHost() { return String(process.env.DESKTOP_DAEMON_HOST || '127.0.0.1'); }
function daemonToken() { return String(process.env.DESKTOP_DAEMON_TOKEN || 'ki-os-desktop-daemon'); }
function daemonPidPath() { return path.join(companion.baseDir(), 'desktop-daemon.pid'); }
function daemonLogPath() { return path.join(companion.baseDir(), 'desktop-daemon.log'); }
function daemonReadyPath() { return path.join(companion.baseDir(), 'desktop-daemon.ready.json'); }
function daemonScriptPath() { return path.join(__dirname, 'desktop.daemon.js'); }

async function request(method, reqPath, body, timeoutMs = Number(process.env.DESKTOP_DAEMON_TIMEOUT_MS || 30000)) {
  const payload = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8');
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: daemonHost(),
      port: daemonPort(),
      path: reqPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload ? String(payload.length) : '0',
        'X-Desktop-Daemon-Token': daemonToken()
      },
      timeout: timeoutMs
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed;
        try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { success: false, error: 'invalid_daemon_response', raw }; }
        if (res.statusCode >= 400) {
          const err = new Error(parsed.error || `daemon_http_${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.body = parsed;
          reject(err);
          return;
        }
        resolve(parsed);
      });
    });
    req.on('timeout', () => req.destroy(new Error('daemon_request_timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function isHealthy() {
  try {
    const res = await request('GET', '/health', null, 1500);
    return !!res?.ok;
  } catch {
    return false;
  }
}

async function ensureDaemon() {
  if (!daemonEnabled()) return false;
  await companion.ensureDir();
  if (await isHealthy()) return true;
  const out = await fs.open(daemonLogPath(), 'a');
  const child = spawn(process.execPath, [daemonScriptPath()], {
    detached: true,
    stdio: ['ignore', out.fd, out.fd],
    env: { ...process.env, DESKTOP_DAEMON_CHILD: 'true' }
  });
  child.unref();
  await fs.writeFile(daemonPidPath(), String(child.pid), 'utf8');
  const until = Date.now() + Number(process.env.DESKTOP_DAEMON_START_TIMEOUT_MS || 8000);
  while (Date.now() < until) {
    if (await isHealthy()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function call(method, reqPath, body) {
  const ok = await ensureDaemon();
  if (!ok) return { success: false, error: 'desktop_daemon_unavailable' };
  try {
    return await request(method, reqPath, body);
  } catch (e) {
    return e.body || { success: false, error: e.message || 'desktop_daemon_error' };
  }
}

async function shutdownDaemon() {
  try {
    return await request('POST', '/shutdown', { reason: 'test_shutdown' }, 2000);
  } catch (e) {
    return e.body || { success: false, error: e.message };
  }
}

module.exports = {
  daemonEnabled,
  daemonPort,
  daemonHost,
  daemonToken,
  daemonPidPath,
  daemonLogPath,
  daemonReadyPath,
  isHealthy,
  ensureDaemon,
  call,
  shutdownDaemon
};

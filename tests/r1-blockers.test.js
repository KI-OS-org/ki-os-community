/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { createApp } = require('../core/app');
const { resetRateLimits } = require('../backend/services/core/rate-limit.service');
const { getConsoleAsset } = require('../backend/services/ui/ui.routes');
const { applyTrustPolicy } = require('../backend/policy/trust.policy');
const { createServer } = require('../runtime/local/server');

const savedNodeEnv = process.env.NODE_ENV;
const savedTestOverride = process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE;
const savedRateWindow = process.env.RATE_LIMIT_WINDOW_MS;
const savedRateUi = process.env.RATE_LIMIT_UI_MAX;
const savedRateStream = process.env.RATE_LIMIT_STREAM_MAX;
const savedHeartbeat = process.env.SSE_HEARTBEAT_MS;

test.beforeEach(() => {
  resetRateLimits();
  process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE = 'true';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_UI_MAX = '180';
  process.env.RATE_LIMIT_STREAM_MAX = '20';
  process.env.SSE_HEARTBEAT_MS = '25';
});

test.after(() => {
  process.env.NODE_ENV = savedNodeEnv;
  process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE = savedTestOverride;
  process.env.RATE_LIMIT_WINDOW_MS = savedRateWindow;
  process.env.RATE_LIMIT_UI_MAX = savedRateUi;
  process.env.RATE_LIMIT_STREAM_MAX = savedRateStream;
  process.env.SSE_HEARTBEAT_MS = savedHeartbeat;
  resetRateLimits();
});

test('test auth override is disabled outside NODE_ENV=test', async () => {
  process.env.NODE_ENV = 'production';
  const app = createApp();
  const res = await app.handleHttp({
    runtime: 'test',
    path: '/admin/automation/webhook/test',
    method: 'GET',
    headers: { 'x-user-id': 'qa-user', 'x-role': 'admin' },
    body: { id: 'hub_test', data: { ping: true } }
  });
  assert.equal(res.statusCode, 403);
});

test('console asset loader rejects traversal-like asset names', () => {
  assert.throws(() => getConsoleAsset('../../backend/core/kernel.js'), /Invalid console asset/);
});

test('trust policy uses research threshold when sources are present', () => {
  const out = applyTrustPolicy({ trust_score: 60 }, { intent: 'general' }, { sources: [{ url: 'https://example.com' }] });
  assert.equal(out.required, Number(process.env.TRUST_SCORE_RESEARCH_MIN || 70));
  assert.equal(out.action, 'revise');
});

test('rate limiting returns 429 after configured UI threshold', async () => {
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_UI_MAX = '2';
  const app = createApp();
  const headers = { 'x-user-id': 'qa-user', 'x-role': 'admin' };
  const first = await app.handleHttp({ runtime: 'test', path: '/ui/config', method: 'GET', headers, query: {} });
  const second = await app.handleHttp({ runtime: 'test', path: '/ui/config', method: 'GET', headers, query: {} });
  const third = await app.handleHttp({ runtime: 'test', path: '/ui/config', method: 'GET', headers, query: {} });
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
});

test('SSE stream sends heartbeat comments', async () => {
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_STREAM_MAX = '5';
  process.env.SSE_HEARTBEAT_MS = '20';
  const app = createServer();
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();

  await new Promise((resolve, reject) => {
    let done = false;
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: '/ui/stream',
      method: 'GET',
      headers: { 'x-user-id': 'qa-user', 'x-role': 'admin' }
    }, (res) => {
      assert.equal(res.statusCode, 200);
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
        if (!done && data.includes(': heartbeat')) {
          done = true;
          req.destroy();
          if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
          server.close(() => resolve());
        }
      });
      res.on('error', (error) => {
        if (!done) reject(error);
      });
    });
    req.on('error', (error) => {
      if (!done && error.code !== 'ECONNRESET') {
        server.close(() => reject(error));
      }
    });
    req.end();
    setTimeout(() => {
      if (!done) {
        done = true;
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
        server.close(() => reject(new Error('heartbeat timeout')));
      }
    }, 1000);
  });
});

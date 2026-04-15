/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createApp } = require('../core/app');
const { resetStore } = require('../backend/services/ui/runtime.store');
const { reset, classifyError } = require('../backend/services/core/observability.service');

const authHeaders = { 'x-user-id': 'qa-user', 'x-role': 'admin' };
const kernelPath = path.resolve(__dirname, '../backend/core/kernel.js');
const chatControllerPath = path.resolve(__dirname, '../backend/services/chat.controller.js');
const uiRoutesPath = path.resolve(__dirname, '../backend/services/ui/ui.routes.js');

test.beforeEach(() => {
  resetStore();
  reset();
});

test('GET /status exposes observability snapshot and taxonomy', async () => {
  const app = createApp();
  await app.handleHttp({ runtime: 'test', path: '/health', method: 'GET' });
  const res = await app.handleHttp({ runtime: 'test', path: '/status', method: 'GET' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.observability.requestsTotal >= 2);
  assert.equal(res.body.observability.taxonomyVersion, 'v1');
  assert.ok(res.body.observability.eventTypes['http.request.completed']);
});

test('GET /metrics shows classified errors after failed request', async () => {
  const app = createApp();
  const resFail = await app.handleHttp({ runtime: 'test', path: '/ui/config', method: 'GET', headers: {} });
  assert.equal(resFail.statusCode, 401);
  assert.equal(resFail.body.errorClass, 'auth');
  const metrics = await app.handleHttp({ runtime: 'test', path: '/metrics', method: 'GET' });
  assert.equal(metrics.statusCode, 200);
  assert.ok(metrics.body.errorsByClass.auth >= 1);
  assert.ok(metrics.body.statusCodes['401'] >= 1);
});

test('chat request updates run-aware observability counters', async () => {
  require.cache[kernelPath] = {
    id: kernelPath,
    filename: kernelPath,
    loaded: true,
    exports: { executeRequest: async (body) => ({ success: true, content: `Echo:${body.input_text || body.message}` }) }
  };
  delete require.cache[chatControllerPath];
  delete require.cache[uiRoutesPath];
  const app = createApp();
  const chat = await app.handleHttp({ runtime: 'test', path: '/v1/chat', method: 'POST', headers: authHeaders, body: { input_text: 'Hallo Observability' } });
  assert.equal(chat.statusCode, 200);
  const status = await app.handleHttp({ runtime: 'test', path: '/status', method: 'GET' });
  assert.ok(status.body.observability.eventsByType['chat.started'] >= 1);
  assert.ok(status.body.observability.eventsByType['runtime.run.created'] >= 1);
  assert.ok(status.body.runtime.completedRuns >= 1);
  delete require.cache[kernelPath];
  delete require.cache[chatControllerPath];
  delete require.cache[uiRoutesPath];
});

test('error classifier maps common classes deterministically', () => {
  assert.equal(classifyError(new Error('Too Many Requests')), 'rate_limit');
  assert.equal(classifyError(new Error('Unauthorized access')), 'auth');
  assert.equal(classifyError(new Error('policy blocked')), 'policy');
  assert.equal(classifyError(new Error('socket timeout')), 'timeout');
});

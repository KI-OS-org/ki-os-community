/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app');
const { reset } = require('../backend/services/ui/ui.eventbus');
const { resetAudit } = require('../backend/services/ui/ui.audit');
const { resetStore } = require('../backend/services/ui/runtime.store');

const authHeaders = { 'x-user-id': 'qa-user', 'x-role': 'admin' };

test.beforeEach(() => {
  reset();
  resetAudit();
  resetStore();
});

test('GET /ui/config returns control console config for authenticated user', async () => {
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/ui/config', method: 'GET', headers: authHeaders, query: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.controlConsole, true);
  assert.equal(res.body.cockpitStartscreen, true);
});

test('GET /console returns HTML shell for authenticated user', async () => {
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/console', method: 'GET', headers: authHeaders, query: {} });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /KI-OS Control Console/);
});

test('GET /ui/config rejects guest', async () => {
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/ui/config', method: 'GET', headers: {}, query: {} });
  assert.equal(res.statusCode, 401);
});

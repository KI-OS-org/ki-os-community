/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: health-ready.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app');

test('GET /health returns ok', async () => {
  const app = createApp();
  const res = await app.handleHttp({ path: '/health', method: 'GET', runtime: 'test' });
  assert.equal(res.statusCode, 200);
  assert.match(res.body.os_level, /^\d+\.\d+\.\d+/);
});

test('GET /ready returns ready', async () => {
  const app = createApp();
  const res = await app.handleHttp({ path: '/ready', method: 'GET', runtime: 'test' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ready, true);
});

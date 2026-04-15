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

const authHeaders = { 'x-user-id': 'qa-user', 'x-role': 'admin' };
const kernelPath = path.resolve(__dirname, '../backend/core/kernel.js');
const chatControllerPath = path.resolve(__dirname, '../backend/services/chat.controller.js');
const uiRoutesPath = path.resolve(__dirname, '../backend/services/ui/ui.routes.js');

test.beforeEach(() => {
  resetStore();
});

test('chat run is persisted and visible via /ui/runs', async () => {
  require.cache[kernelPath] = {
    id: kernelPath,
    filename: kernelPath,
    loaded: true,
    exports: { executeRequest: async (body) => ({ success: true, echo: body.input_text || body.message }) }
  };
  delete require.cache[chatControllerPath];
  delete require.cache[uiRoutesPath];
  const app = createApp();
  const chat = await app.handleHttp({ runtime: 'test', path: '/v1/chat', method: 'POST', headers: authHeaders, body: { input_text: 'Hallo' } });
  assert.equal(chat.statusCode, 200);
  const runId = chat.body.meta?.runId;
  assert.ok(runId);
  const runs = await app.handleHttp({ runtime: 'test', path: '/ui/runs', method: 'GET', headers: authHeaders, query: {} });
  assert.equal(runs.statusCode, 200);
  assert.ok(runs.body.items.some((item) => item.runId === runId));
  const run = await app.handleHttp({ runtime: 'test', path: `/ui/runs/${encodeURIComponent(runId)}`, method: 'GET', headers: authHeaders, query: {} });
  assert.equal(run.statusCode, 200);
  assert.equal(run.body.item.runId, runId);
  delete require.cache[kernelPath];
  delete require.cache[chatControllerPath];
  delete require.cache[uiRoutesPath];
});

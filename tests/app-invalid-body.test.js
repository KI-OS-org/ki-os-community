/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const kernelPath = path.resolve(__dirname, '../backend/core/kernel.js');
const chatControllerPath = path.resolve(__dirname, '../backend/services/chat.controller.js');
const { createApp } = require('../core/app');

test('invalid json body falls back to empty object for chat route and returns validation error', async () => {
  require.cache[kernelPath] = { id: kernelPath, filename: kernelPath, loaded: true, exports: { executeRequest: async () => ({ success: true, content: 'ok' }) } };
  delete require.cache[chatControllerPath];
  const app = createApp();
  // Test mit Auth-Header — der eigentliche Test ist die Body-Validierung, nicht Auth
  const res = await app.handleHttp({ runtime: 'test', path: '/v1/chat', method: 'POST', headers: { 'x-user-id': 'test-user', 'x-role': 'user' }, body: '{not-json' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  delete require.cache[kernelPath];
  delete require.cache[chatControllerPath];
});

/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: chat-controller.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const kernelPath = path.resolve(__dirname, '../backend/core/kernel.js');
const chatControllerPath = path.resolve(__dirname, '../backend/services/chat.controller.js');

test('chat controller returns kernel response on happy path', async () => {
  require.cache[kernelPath] = {
    id: kernelPath,
    filename: kernelPath,
    loaded: true,
    exports: { executeRequest: async (body) => ({ success: true, echo: body.message }) }
  };
  delete require.cache[chatControllerPath];
  const { handleChat } = require(chatControllerPath);
  const res = await handleChat({ message: 'Ping' }, {});
  assert.equal(res.success, true);
  assert.equal(res.echo, 'Ping');
  assert.ok(res.meta?.runId);
  delete require.cache[kernelPath];
  delete require.cache[chatControllerPath];
});

test('chat controller returns clean error payload on failure', async () => {
  require.cache[kernelPath] = {
    id: kernelPath,
    filename: kernelPath,
    loaded: true,
    exports: { executeRequest: async () => { throw new Error('boom'); } }
  };
  delete require.cache[chatControllerPath];
  const { handleChat } = require(chatControllerPath);
  const res = await handleChat({ message: 'Ping' }, {});
  assert.equal(res.success, false);
  assert.equal(res.error, 'boom');
  delete require.cache[kernelPath];
  delete require.cache[chatControllerPath];
});

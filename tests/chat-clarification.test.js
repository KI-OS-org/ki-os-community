/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: chat-clarification.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const chat = require('../backend/services/chat.controller');

test('handleChat returns clarification mode when critical data is missing', async () => {
  process.env.AGENT_INTAKE_ENABLED = 'true';
  process.env.AGENT_LAYER_ENABLED = 'false';
  const res = await chat.handleChat({ message: 'Mein Thema für meine Promotion ist KI im Retail' }, {});
  assert.equal(res.success, true);
  assert.equal(res.mode, 'clarification');
  assert.ok(Array.isArray(res.clarification.questions));
  process.env.AGENT_INTAKE_ENABLED = 'false';
});

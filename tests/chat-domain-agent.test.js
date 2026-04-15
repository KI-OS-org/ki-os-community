/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: chat-domain-agent.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const chat = require('../backend/services/chat.controller');

test('chat clarification includes framed domain when domain agents are enabled', async () => {
  process.env.AGENT_INTAKE_ENABLED = 'true';
  process.env.DOMAIN_AGENTS_ENABLED = 'true';
  process.env.AGENT_LAYER_ENABLED = 'false';
  const res = await chat.handleChat({ message: 'Mein Thema für meine Promotion ist generative KI im Retail' }, {});
  assert.equal(res.mode, 'clarification');
  assert.equal(res.clarification.domain, 'academic');
  process.env.AGENT_INTAKE_ENABLED = 'false';
  process.env.DOMAIN_AGENTS_ENABLED = 'false';
});

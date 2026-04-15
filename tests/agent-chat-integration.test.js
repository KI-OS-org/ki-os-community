/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: agent-chat-integration.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const chatControllerPath = path.resolve(__dirname, '../backend/services/chat.controller.js');
const kernelPath = path.resolve(__dirname, '../backend/core/kernel.js');
const verifierPath = path.resolve(__dirname, '../backend/services/verifier.service.js');
const agentLayerPath = path.resolve(__dirname, '../backend/services/agent/agent.layer.js');

test('chat controller uses agent mesh when enabled', async () => {
  process.env.AGENT_LAYER_ENABLED = 'true';
  require.cache[agentLayerPath] = { id: agentLayerPath, filename: agentLayerPath, loaded: true, exports: { getAgentLayer: () => ({ processQuery: async () => ({ agentic: true, success: true, answer: { reply: 'Mesh reply' }, plan: { steps: [] }, execution: { result: {} }, mesh: { enabled: true } }) }) } };
  require.cache[verifierPath] = { id: verifierPath, filename: verifierPath, loaded: true, exports: { verifyAnswer: async () => ({ verdict: 'approve', trust_score: 90 }) } };
  require.cache[kernelPath] = { id: kernelPath, filename: kernelPath, loaded: true, exports: { executeRequest: async () => ({ success: true, content: 'kernel' }) } };
  delete require.cache[chatControllerPath];
  const { handleChat } = require(chatControllerPath);
  const res = await handleChat({ message: 'Suche News und speichere sie' }, {});
  assert.equal(res.success, true);
  assert.equal(res.content, 'Mesh reply');
  process.env.AGENT_LAYER_ENABLED = 'false';
  delete require.cache[agentLayerPath]; delete require.cache[verifierPath]; delete require.cache[kernelPath]; delete require.cache[chatControllerPath];
});

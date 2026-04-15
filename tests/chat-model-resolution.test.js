/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: chat-model-resolution.test.js
 * Diese Datei validiert, dass der Chat-Controller die AgentMesh-Modelle aus der Discovery-/Registry-Schicht übernimmt.
 * So wird sichergestellt, dass KI-OS im Agent-Modus nicht mehr auf alte Default-Modelle zurückfällt.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const chatControllerPath = path.resolve(__dirname, '../backend/services/chat.controller.js');
const kernelPath = path.resolve(__dirname, '../backend/core/kernel.js');
const verifierPath = path.resolve(__dirname, '../backend/services/verifier.service.js');
const agentLayerPath = path.resolve(__dirname, '../backend/services/agent/agent.layer.js');
const modelsPath = path.resolve(__dirname, '../backend/services/providers/models-services.js');

let capturedOptions = null;

test('chat controller resolves planner and synthesizer models from registry', async () => {
  process.env.AGENT_LAYER_ENABLED = 'true';
  require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: { resolveAgentRuntimeModels: async () => ({ plannerModel: 'claude-opus-4-6-20260115', synthesizerModel: 'gpt-5.4' }) } };
  require.cache[agentLayerPath] = { id: agentLayerPath, filename: agentLayerPath, loaded: true, exports: { getAgentLayer: (opts) => { capturedOptions = opts; return { processQuery: async () => ({ agentic: true, success: true, answer: { reply: 'Mesh reply' }, plan: { steps: [] }, execution: { result: {} }, mesh: { enabled: true } }) }; } } };
  require.cache[verifierPath] = { id: verifierPath, filename: verifierPath, loaded: true, exports: { verifyAnswer: async () => ({ verdict: 'approve', trust_score: 90 }) } };
  require.cache[kernelPath] = { id: kernelPath, filename: kernelPath, loaded: true, exports: { executeRequest: async () => ({ success: true, content: 'kernel' }) } };
  delete require.cache[chatControllerPath];
  const { handleChat } = require(chatControllerPath);
  const res = await handleChat({ message: 'Suche News und speichere sie' }, {});
  assert.equal(res.success, true);
  assert.equal(capturedOptions.plannerModel, 'claude-opus-4-6-20260115');
  assert.equal(capturedOptions.synthesizerModel, 'gpt-5.4');
  process.env.AGENT_LAYER_ENABLED = 'false';
  delete require.cache[modelsPath];
  delete require.cache[agentLayerPath];
  delete require.cache[verifierPath];
  delete require.cache[kernelPath];
  delete require.cache[chatControllerPath];
});

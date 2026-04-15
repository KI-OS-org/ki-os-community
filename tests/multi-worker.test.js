/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: multi-worker.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const workerToolsPath = path.resolve(__dirname, '../backend/services/core/worker.tools.js');
const websearchPath = path.resolve(__dirname, '../backend/services/websearch.service.js');
const openaiPath = path.resolve(__dirname, '../backend/services/providers/openai.provider.js');
const anthropicPath = path.resolve(__dirname, '../backend/services/providers/anthropic.provider.js');
const geminiPath = path.resolve(__dirname, '../backend/services/providers/gemini.provider.js');
const deepseekPath = path.resolve(__dirname, '../backend/services/providers/deepseek.provider.js');
const openrouterPath = path.resolve(__dirname, '../backend/services/providers/openrouter.provider.js');
const orchestratorPath = path.resolve(__dirname, '../backend/services/core/worker.orchestrator.js');

test('multi worker returns structured success for empty orchestration plan', async () => {
  require.cache[workerToolsPath] = { id: workerToolsPath, filename: workerToolsPath, loaded: true, exports: {} };
  require.cache[websearchPath] = { id: websearchPath, filename: websearchPath, loaded: true, exports: { search: async () => ({ sources: [] }) } };
  const providerStub = { chat: async () => ({ text: '{"answer":"ok"}' }) };
  for (const p of [openaiPath, anthropicPath, geminiPath, deepseekPath, openrouterPath]) {
    require.cache[p] = { id: p, filename: p, loaded: true, exports: providerStub };
  }
  delete require.cache[orchestratorPath];
  const orchestrator = require(orchestratorPath);
  const res = await orchestrator.executeTask({ worker_type: 'multi', model: 'gpt-4o', input_data: { orchestration_plan: [] } });
  assert.equal(res.status, 'success');
  assert.equal(res.output_type, 'multi');
  delete require.cache[workerToolsPath];
  delete require.cache[websearchPath];
  for (const p of [openaiPath, anthropicPath, geminiPath, deepseekPath, openrouterPath, orchestratorPath]) delete require.cache[p];
});

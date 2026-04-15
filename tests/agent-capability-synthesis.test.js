/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: agent-capability-synthesis.test.js
 * Diese Datei prüft, dass der Agent-Layer den Capability Router für die Antwort-Synthese verwendet.
 * So wird sichergestellt, dass KI-OS Antworten nicht mehr hart auf OpenAI festnagelt.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const agentLayerPath = path.resolve(__dirname, '../backend/services/agent/agent.layer.js');
const routerPath = path.resolve(__dirname, '../backend/services/providers/capability-router.service.js');
const openaiPath = path.resolve(__dirname, '../backend/services/providers/openai.provider.js');
const anthropicPath = path.resolve(__dirname, '../backend/services/providers/anthropic.provider.js');
const geminiPath = path.resolve(__dirname, '../backend/services/providers/gemini.provider.js');
const deepseekPath = path.resolve(__dirname, '../backend/services/providers/deepseek.provider.js');
const openrouterPath = path.resolve(__dirname, '../backend/services/providers/openrouter.provider.js');
const planningPath = path.resolve(__dirname, '../backend/services/agent/planning.engine.js');
const executionPath = path.resolve(__dirname, '../backend/services/agent/execution.engine.js');

function cleanup() {
  for (const p of [agentLayerPath, routerPath, openaiPath, anthropicPath, geminiPath, deepseekPath, openrouterPath, planningPath, executionPath]) {
    delete require.cache[p];
  }
}

test('agent layer synthesizer uses routed provider instead of hardcoded OpenAI', async () => {
  cleanup();
  require.cache[routerPath] = { id: routerPath, filename: routerPath, loaded: true, exports: { resolveCapabilityRoute: async () => ({ provider: 'anthropic', model: 'claude-opus-4-6-20260115' }), inferRoleFromTask: () => 'code' } };
  require.cache[planningPath] = { id: planningPath, filename: planningPath, loaded: true, exports: { PlanningEngine: class { async createPlan() { return { steps: [{ id: 'step_1', tool: 'web_search', description: 'x', agent_role: 'researcher' }] }; } } } };
  require.cache[executionPath] = { id: executionPath, filename: executionPath, loaded: true, exports: { ExecutionEngine: class { async executePlan() { return { result: { step_1: { ok: true } } }; } } } };
  require.cache[anthropicPath] = { id: anthropicPath, filename: anthropicPath, loaded: true, exports: { chat: async () => ({ text: 'anthropic summary' }) } };
  require.cache[openaiPath] = { id: openaiPath, filename: openaiPath, loaded: true, exports: { callOpenAI: async () => { throw new Error('openai should not be used'); } } };
  require.cache[geminiPath] = { id: geminiPath, filename: geminiPath, loaded: true, exports: { chat: async () => ({ text: 'gemini summary' }) } };
  require.cache[deepseekPath] = { id: deepseekPath, filename: deepseekPath, loaded: true, exports: { chat: async () => ({ text: 'deepseek summary' }) } };
  require.cache[openrouterPath] = { id: openrouterPath, filename: openrouterPath, loaded: true, exports: { chat: async () => ({ text: 'openrouter summary' }) } };

  const { AgentLayer } = require(agentLayerPath);
  const layer = new AgentLayer({ enabled: true, agenticThreshold: 0 });
  const result = await layer.processQuery('Bitte analysiere und verbessere den Code');
  assert.equal(result.success, true);
  assert.equal(result.answer.reply, 'anthropic summary');
  assert.equal(result.answer.provider, 'anthropic');
  cleanup();
});

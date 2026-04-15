/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: agent-layer.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const openaiPath = path.resolve(__dirname, '../backend/services/providers/openai.provider.js');
const websearchPath = path.resolve(__dirname, '../backend/services/websearch.service.js');
const agentLayerPath = path.resolve(__dirname, '../backend/services/agent/agent.layer.js');

test('agent layer returns non-agentic for simple short query', async () => {
  require.cache[websearchPath] = { id: websearchPath, filename: websearchPath, loaded: true, exports: { search: async () => ({ sources: [] }) } };
  require.cache[openaiPath] = { id: openaiPath, filename: openaiPath, loaded: true, exports: { callOpenAI: async () => ({ text: 'noop' }) } };
  delete require.cache[agentLayerPath];
  const { AgentLayer } = require(agentLayerPath);
  const agent = new AgentLayer({ enabled: true, agenticThreshold: 0.9 });
  const res = await agent.processQuery('Hallo', { userId: 'u1' });
  assert.equal(res.agentic, false);
  delete require.cache[websearchPath];
  delete require.cache[openaiPath];
  delete require.cache[agentLayerPath];
});

test('agent layer builds plan and synthesis for agentic query', async () => {
  require.cache[websearchPath] = { id: websearchPath, filename: websearchPath, loaded: true, exports: { search: async () => ({ sources: [] }) } };
  require.cache[openaiPath] = {
    id: openaiPath, filename: openaiPath, loaded: true,
    exports: { callOpenAI: async ({ messages }) => {
      const prompt = messages?.[0]?.content || '';
      if (prompt.includes('Erstelle NUR JSON')) return { text: '{"reasoning":"test","steps":[{"id":"step_1","tool":"analyze_query_intent","parameters":{"query":"Suche KI-News und speichere sie"},"description":"Intent prüfen","depends_on":[],"agent_role":"planner"}]}' };
      return { text: 'Synthese fertig' };
    }}
  };
  delete require.cache[agentLayerPath];
  const { AgentLayer } = require(agentLayerPath);
  const agent = new AgentLayer({ enabled: true, agenticThreshold: 0.2 });
  const res = await agent.processQuery('Suche KI-News und speichere sie', { userId: 'u1' });
  assert.equal(res.success, true);
  assert.equal(res.agentic, true);
  assert.ok(res.plan.steps.length >= 1);
  assert.ok(Array.isArray(res.mesh.active_roles));
  delete require.cache[openaiPath];
  delete require.cache[websearchPath];
  delete require.cache[agentLayerPath];
});

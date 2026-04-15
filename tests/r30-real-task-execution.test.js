/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-r30-'));
process.env.DAG_REGISTRY_PATH = path.join(tempDir, 'dag-registry.json');
process.env.RUNTIME_STORE_PATH = path.join(tempDir, 'runtime-store.json');
process.env.RUNTIME_STORE_BACKEND = 'file';
process.env.KI_OS_TEST_MODE = 'true';
process.env.OPENAI_API_KEY = 'test-key';

const openaiProvider = require('../backend/services/providers/openai.provider');
const originalCall = openaiProvider.callOpenAI;
const originalChat = openaiProvider.chat;
const mockedCall = async ({ messages, model }) => ({
  text: JSON.stringify({ answer: `mocked:${messages?.[0]?.content || messages?.[messages.length - 1]?.content || 'ok'}` }),
  meta: { provider: 'openai', model: model || 'gpt-5.4', mocked: true }
});
openaiProvider.callOpenAI = mockedCall;
openaiProvider.chat = mockedCall;

delete require.cache[require.resolve('../backend/services/dag/dag.runtime.service')];
const dagRuntime = require('../backend/services/dag/dag.runtime.service');

test.after(async () => {
  openaiProvider.callOpenAI = originalCall;
  openaiProvider.chat = originalChat;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('R30 executes task nodes through worker-orchestrator when provider credentials are present', async () => {
  dagRuntime.resetDagRegistry();
  dagRuntime.saveDagDefinition({
    dagId: 'r30-live',
    name: 'R30 Live DAG',
    nodes: [
      { id: 'start', type: 'task', workerType: 'chat', model: 'gpt-5.4', input_data: { query: 'hello from r30' } }
    ],
    edges: []
  });
  const result = await dagRuntime.executeDag({
    dagId: 'r30-live',
    payload: { query: 'hello from r30' }
  }, { userId: 'qa-user', tenantId: 'tenant-r30', role: 'admin' });

  assert.equal(result.success, true);
  assert.equal(result.results.start.delegateMode, 'worker-orchestrator');
  assert.match(String(result.results.start.output.text), /mocked:/);
  assert.equal(result.results.start.output.meta.provider, 'openai');
});

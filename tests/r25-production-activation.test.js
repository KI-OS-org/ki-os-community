/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runtimeStore = require('../backend/services/ui/runtime.store');
const { createApp } = require('../core/app');
const { evaluateToolPolicy } = require('../backend/services/governance/policy.engine');
const economic = require('../backend/services/economic/economic.service');
const memoryController = require('../backend/services/memory.controller');

const econStore = path.join(process.cwd(), '.test-r25-economic.json');
const memoryStore = path.join(process.cwd(), '.test-r25-memory.json');

test.beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE = 'true';
  process.env.MOCK_MODEL_CATALOG = 'true';
  process.env.ECONOMIC_OPTIMIZER_STORE_PATH = econStore;
  process.env.LOCAL_MEMORY_FILE = memoryStore;
  process.env.KI_OS_KILL_SWITCH_LLM = 'false';
  for (const file of [econStore, memoryStore]) { try { fs.unlinkSync(file); } catch {} }
  runtimeStore.resetStore();
  economic.resetEconomicStore();
});

test('economic decision target models are allowed by governance after normalization', () => {
  let decision = economic.evaluateEconomicDecision({
    profileId: 'balanced-default',
    provider: 'openai',
    model: 'gpt-5.4',
    budgetCents: 320,
    trustScore: 92,
    outcomeCoverage: 0.9,
    latencyMs: 800,
    roiSignal: 0.1
  });
  let policy = evaluateToolPolicy({
    tool: 'llm_invoke',
    action: 'chat',
    ctx: { role: 'admin' },
    payload: { model: decision.targetModel, provider: decision.targetProvider, residency: 'eu', budgetCents: 320 }
  });
  assert.equal(policy.decision, 'allow');

  decision = economic.evaluateEconomicDecision({
    profileId: 'roi-first',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    budgetCents: 120,
    trustScore: 70,
    outcomeCoverage: 0.4,
    latencyMs: 1000,
    roiSignal: 0.95
  });
  policy = evaluateToolPolicy({
    tool: 'llm_invoke',
    action: 'chat',
    ctx: { role: 'admin' },
    payload: { model: decision.targetModel, provider: decision.targetProvider, residency: 'eu', budgetCents: 120 }
  });
  assert.equal(policy.decision, 'allow');
});

test('kernel applies economic optimization in main execution path', async () => {
  const app = createApp();
  const res = await app.handleHttp({
    runtime: 'test',
    path: '/chat',
    method: 'POST',
    headers: { 'x-user-id': 'ingo', 'x-role': 'admin' },
    body: {
      message: 'Bitte gib mir einen kurzen Projektstatus.',
      economicProfileId: 'roi-first',
      estimatedBudgetCents: 350,
      trustScore: 82,
      outcomeCoverage: 0.42,
      latencyMs: 850,
      roiSignal: 0.95
    }
  });
  assert.ok([200, 403].includes(res.statusCode));
  const decisions = economic.listDecisions(10);
  assert.ok(decisions.length >= 1);
  assert.ok(decisions[0].targetModel || decisions[0].targetProvider);
  const snapshot = runtimeStore.getMetrics();
  assert.ok(Number.isFinite(snapshot.outcomeCoverage));
});

test('semantic memory retrieval is isolated by tenant', async () => {
  const userId = `same-user-${Date.now()}`;
  await memoryController.handleMemory('POST', { tenantId: 'tenant-a', userId, category: 'chat', text: 'Tenant A keeps Project Alpha secret.' }, {});
  await memoryController.handleMemory('POST', { tenantId: 'tenant-b', userId, category: 'chat', text: 'Tenant B keeps Project Beta private.' }, {});

  const resA = await memoryController.handleMemory('POST', { action: 'retrieve', tenantId: 'tenant-a', userId, query: 'Beta', limit: 10 }, {});
  const resB = await memoryController.handleMemory('POST', { action: 'retrieve', tenantId: 'tenant-b', userId, query: 'Alpha', limit: 10 }, {});
  assert.equal(resA.items.length, 0);
  assert.equal(resB.items.length, 0);

  const listA = await memoryController.handleMemory('GET', {}, { search: new URLSearchParams(`tenantId=tenant-a&userId=${userId}`) });
  const listB = await memoryController.handleMemory('GET', {}, { search: new URLSearchParams(`tenantId=tenant-b&userId=${userId}`) });
  assert.equal(listA.items.length, 1);
  assert.equal(listB.items.length, 1);
  assert.equal(listA.items[0].tenantId, 'tenant-a');
  assert.equal(listB.items[0].tenantId, 'tenant-b');
});

test('runtime store exports file-backed backend metadata', () => {
  const run = runtimeStore.createRun({ runId: 'runtime-backend-1', task: 'health', userId: 'qa-user', tenantId: 'default' });
  runtimeStore.transitionRun(run.runId, 'EXECUTING', { stepName: 'exec' });
  const exported = runtimeStore.exportState();
  assert.equal(exported.backend.mode, 'file');
  assert.ok(exported.backend.path);
  assert.ok(Array.isArray(exported.store.runs));
});

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

const { createApp } = require('../core/app');
const runtimeStore = require('../backend/services/ui/runtime.store');
const Observability = require('../backend/services/core/observability.service');
const semantic = require('../backend/services/memory/semantic-memory.service');
const routing = require('../backend/services/routing/dynamic-routing.service');
const supervisor = require('../backend/services/supervisor/supervisor.service');
const governance = require('../backend/services/governance/policy.engine');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };
const operatorHeaders = { 'x-user-id': 'qa-operator', 'x-role': 'operator' };
const servicePath = require.resolve('../backend/services/providers/models-services');
const discoveryPath = require.resolve('../backend/services/providers/model.discovery.service');

function loadFreshModels(stubbedDiscovery) {
  delete require.cache[servicePath];
  require.cache[discoveryPath] = {
    id: discoveryPath,
    filename: discoveryPath,
    loaded: true,
    exports: stubbedDiscovery || { discoverAllProviders: async () => ({ roles: {}, providers: {} }) }
  };
  return require(servicePath);
}

test.beforeEach(() => {
  runtimeStore.resetStore();
  Observability.reset();
  routing.resetRoutingDecisionLog();
  supervisor.resetEscalations();
  process.env.OUTCOME_ROUTING_ENABLED = 'true';
  process.env.OUTCOME_ROUTING_WEIGHT = '0.08';
  process.env.NODE_ENV = 'test';
  process.env.MOCK_MODEL_CATALOG = 'true';
});

test.after(() => {
  delete require.cache[servicePath];
  delete require.cache[discoveryPath];
});

test('chat fallback path finalizes runtime run even when kernel is stubbed', async () => {
  const kernelPath = require.resolve('../backend/core/kernel');
  const chatControllerPath = require.resolve('../backend/services/chat.controller');
  require.cache[kernelPath] = {
    id: kernelPath,
    filename: kernelPath,
    loaded: true,
    exports: { executeRequest: async () => ({ success: true, content: 'stubbed ok', meta: {} }) }
  };
  delete require.cache[chatControllerPath];

  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/v1/chat', method: 'POST', headers: adminHeaders, body: { input_text: 'runtime hardening' } });
  assert.equal(res.statusCode, 200);
  const run = runtimeStore.getRun(res.body.meta.runId);
  assert.ok(run);
  assert.equal(run.status, 'COMPLETED');

  delete require.cache[kernelPath];
  delete require.cache[chatControllerPath];
});

test('routing adds outcome influence when enabled', async () => {
  const baseline = await routing.resolveDynamicRoute({ query: 'Bitte analysiere Architektur' }, { outcomeCoverage: 0 });
  const boosted = await routing.resolveDynamicRoute({ query: 'Bitte analysiere Architektur' }, { outcomeCoverage: 1 });
  const candidateBase = baseline.considered.find((item) => item.model === baseline.selected.model);
  const candidateBoost = boosted.considered.find((item) => item.model === boosted.selected.model);
  assert.ok(candidateBoost.score >= candidateBase.score);
  assert.ok(boosted.considered.some((item) => item.outcomeScore >= 1));
});

test('semantic retrieval prioritizes text and outcome markers over metadata noise', () => {
  const items = [
    semantic.annotateItem({
      memoryId: 'm1',
      userId: 'ingo',
      timestamp: new Date().toISOString(),
      category: 'chat',
      text: 'Projekt KI-OS verbessert Conversion deutlich.',
      metadata: { observedOutcomeKey: 'conversion', signalSource: 'kernel.standard_flow' }
    }),
    semantic.annotateItem({
      memoryId: 'm2',
      userId: 'ingo',
      timestamp: '2024-01-01T00:00:00Z',
      category: 'chat',
      text: 'Allgemeine Notiz ohne Suchbegriff.',
      metadata: { schemaVersionNoise: 'conversion' }
    })
  ];
  const result = semantic.retrieve(items, 'conversion', { limit: 2 });
  assert.ok(result.total >= 1);
  assert.equal(result.items[0].memoryId, 'm1');
  assert.ok(result.items[0].retrievalScore > 0.6);
});

test('governance constraints deny forbidden provider and escalate oversized budget', () => {
  const deny = governance.evaluateToolPolicy({
    tool: 'provider_call',
    action: 'invoke',
    ctx: { role: 'admin' },
    payload: { provider: 'forbidden-provider' }
  });
  assert.equal(deny.decision, 'deny');
  assert.equal(deny.reason, 'provider_denied');

  const escalate = governance.evaluateToolPolicy({
    tool: 'llm_invoke',
    action: 'invoke',
    ctx: { role: 'admin' },
    payload: { provider: 'openai', budgetCents: 7500 }
  });
  assert.equal(escalate.decision, 'escalate');
  assert.equal(escalate.reason, 'budget_guard_exceeded');
});

test('loadModelCatalog in test mode avoids DDB warning path and returns minimum cleanly', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  process.env.NODE_ENV = 'test';
  process.env.MOCK_MODEL_CATALOG = 'false';
  const svc = loadFreshModels({ discoverAllProviders: async () => ({ roles: {}, providers: {} }) });
  const doc = await svc.loadModelCatalog(true, { env: process.env });
  console.warn = originalWarn;
  assert.ok(doc.roles.default.model);
  assert.equal(warnings.some((line) => line.includes('DDB models.json nicht gefunden')), false);
  svc.clearModelCatalogCache();
  delete require.cache[servicePath];
  delete require.cache[discoveryPath];
});

/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app');
const runtimeStore = require('../backend/services/ui/runtime.store');
const tenantService = require('../backend/services/tenant/tenant.service');
const routing = require('../backend/services/routing/dynamic-routing.service');
const OTel = require('../backend/services/core/otel-lite.service');
const eventbus = require('../backend/services/ui/ui.eventbus');
const audit = require('../backend/services/ui/ui.audit');
const Observability = require('../backend/services/core/observability.service');

const authHeaders = { 'x-user-id': 'qa-user', 'x-role': 'admin', 'x-tenant-id': 'tenant-r28' };

test.beforeEach(() => {
  runtimeStore.resetStore();
  tenantService.resetTenantStore();
  eventbus.reset();
  audit.resetAudit();
  OTel.reset();
  Observability.reset();
  process.env.KI_OS_TEST_MODE = 'true';
  tenantService.upsertTenant({
    tenantId: 'tenant-r28',
    name: 'R28 Tenant',
    residency: 'eu',
    policyOverrides: { allowProviders: ['openai', 'anthropic'], maxBudgetCents: 500, allowResidencies: ['eu'] }
  });
  runtimeStore.createRun({ runId: 'run-r28-chat', type: 'chat', userId: 'qa-user', tenantId: 'tenant-r28', task: 'control plane test' });
  runtimeStore.transitionRun('run-r28-chat', 'EXECUTING', { stepName: 'execute', worker: 'chat', model: 'gpt-5.4' });
  runtimeStore.transitionRun('run-r28-chat', 'COMPLETED', { stepName: 'complete', worker: 'chat', model: 'gpt-5.4' });
  runtimeStore.createRun({ runId: 'run-r28-dag', type: 'dag', userId: 'qa-user', tenantId: 'tenant-r28', task: 'retail-decision' });
  runtimeStore.transitionRun('run-r28-dag', 'EXECUTING', { stepName: 'dag_execute', worker: 'dag', model: 'gpt-5.4' });
  runtimeStore.recordEvent('run-r28-dag', { type: 'dag.node.completed', nodeId: 'kpiRetrieval' });
  routing.recordRouteOutcome({ provider: 'openai', model: 'gpt-5.4', success: true, latencyMs: 420, trustScore: 91, outcomeCoverage: 1, runId: 'run-r28-chat', traceId: 'trace-r28' });
});

test('R28 visible control plane endpoint exposes command center payload', async () => {
  const app = createApp();
  await app.handleHttp({ path: '/health', method: 'GET', runtime: 'test', headers: authHeaders });
  const res = await app.handleHttp({ path: '/ui/control-plane/visible', method: 'GET', runtime: 'test', headers: authHeaders });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.ui, 'r28-visible-control-plane');
  assert.ok(res.body.topMetrics.providersOnline);
  assert.ok(Array.isArray(res.body.routing.scorecards));
  assert.ok(Array.isArray(res.body.governance.explain));
  assert.ok(Array.isArray(res.body.dag.definitions));
});

test('R28 policy explain endpoint returns tenant-aware explainability', async () => {
  const app = createApp();
  const res = await app.handleHttp({ path: '/ui/policy/explain', method: 'GET', runtime: 'test', headers: authHeaders });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.governance.tenantView.tenantId, 'tenant-r28');
  assert.ok(res.body.governance.explain.some((item) => item.tenantId === 'tenant-r28'));
});

test('R28 console shell contains visible control plane navigation', async () => {
  const app = createApp();
  const res = await app.handleHttp({ path: '/console', method: 'GET', runtime: 'test', headers: authHeaders });
  assert.equal(res.statusCode, 200);
  assert.match(String(res.body), /Command Center/);
  assert.match(String(res.body), /Routing/);
  assert.match(String(res.body), /Governance/);
  assert.match(String(res.body), /DAG Runtime/);
});

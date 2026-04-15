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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-r27-'));
process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE = 'true';
process.env.MOCK_MODEL_CATALOG = 'true';
process.env.KI_OS_DYNAMODB_EMULATION_FILE = path.join(tempDir, 'dynamodb-emulation.json');
process.env.RUNTIME_STORE_PATH = path.join(tempDir, 'runtime-file.json');
process.env.CIRCUIT_BREAKER_STATE_PATH = path.join(tempDir, 'cb-file.json');
process.env.DLQ_STORE_PATH = path.join(tempDir, 'dlq-file.json');
process.env.TENANT_STORE_PATH = path.join(tempDir, 'tenants-file.json');
process.env.ECONOMIC_OPTIMIZER_STORE_PATH = path.join(tempDir, 'economic-file.json');
process.env.LOCAL_MEMORY_FILE = path.join(tempDir, 'memory-file.json');

const { createApp } = require('../core/app');
const runtimeStore = require('../backend/services/ui/runtime.store');
const circuitBreaker = require('../backend/services/resilience/circuit-breaker.service');
const dlq = require('../backend/services/resilience/dlq.service');
const tenantService = require('../backend/services/tenant/tenant.service');
const economic = require('../backend/services/economic/economic.service');
const OTel = require('../backend/services/core/otel-lite.service');
const { evaluateToolPolicy } = require('../backend/services/governance/policy.engine');
const { assertProductionPki } = require('../backend/services/pki/pki.runtime.guard');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin', 'x-tenant-id': 'default' };

function resetAll() {
  for (const file of [process.env.KI_OS_DYNAMODB_EMULATION_FILE, process.env.RUNTIME_STORE_PATH, process.env.CIRCUIT_BREAKER_STATE_PATH, process.env.DLQ_STORE_PATH, process.env.TENANT_STORE_PATH, process.env.ECONOMIC_OPTIMIZER_STORE_PATH, process.env.LOCAL_MEMORY_FILE]) {
    try { fs.rmSync(file, { force: true }); } catch {}
  }
  runtimeStore.resetStore();
  circuitBreaker.reset();
  dlq.reset();
  tenantService.resetTenantStore();
  economic.resetEconomicStore();
  OTel.reset();
}

test.beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.PKI_ENABLED = 'false';
  process.env.RUNTIME_STORE_BACKEND = 'file';
  process.env.CB_STORE_BACKEND = 'file';
  process.env.DLQ_STORE_BACKEND = 'file';
  process.env.TENANT_STORE_BACKEND = 'file';
  process.env.ECONOMIC_STORE_BACKEND = 'file';
  resetAll();
});

test.after(() => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('R27 critical stores expose backend adapters and support dynamodb mode', () => {
  process.env.RUNTIME_STORE_BACKEND = 'dynamodb';
  process.env.CB_STORE_BACKEND = 'dynamodb';
  process.env.DLQ_STORE_BACKEND = 'dynamodb';
  process.env.TENANT_STORE_BACKEND = 'dynamodb';
  process.env.ECONOMIC_STORE_BACKEND = 'dynamodb';

  delete require.cache[require.resolve('../backend/services/ui/runtime.store')];
  delete require.cache[require.resolve('../backend/services/resilience/circuit-breaker.service')];
  delete require.cache[require.resolve('../backend/services/resilience/dlq.service')];
  delete require.cache[require.resolve('../backend/services/tenant/tenant.service')];
  delete require.cache[require.resolve('../backend/services/economic/economic.service')];

  const rts = require('../backend/services/ui/runtime.store');
  const cb = require('../backend/services/resilience/circuit-breaker.service');
  const dead = require('../backend/services/resilience/dlq.service');
  const tenants = require('../backend/services/tenant/tenant.service');
  const econ = require('../backend/services/economic/economic.service');

  rts.createRun({ runId: 'ddb-run-1', task: 'ddb runtime' });
  cb.recordFailure('provider.openai', new Error('boom'));
  dead.enqueue({ type: 'provider', error: 'boom' });
  tenants.upsertTenant({ tenantId: 'tenant-ddb', name: 'Tenant DDB' });
  econ.evaluateEconomicDecision({ profileId: 'balanced-default', provider: 'openai', model: 'gpt-5.4', budgetCents: 100, trustScore: 80, outcomeCoverage: 0.7, latencyMs: 800 });

  assert.equal(rts.getBackendInfo().mode, 'dynamodb');
  assert.equal(cb.getSnapshot().backend.mode, 'dynamodb');
  assert.equal(dead.getSnapshot().backend.mode, 'dynamodb');
  assert.equal(tenants.getProductCorePayload().backend.mode, 'dynamodb');
  assert.equal(econ.getEconomicPayload().backend.mode, 'dynamodb');
  const emu = JSON.parse(fs.readFileSync(process.env.KI_OS_DYNAMODB_EMULATION_FILE, 'utf8'));
  assert.ok(Object.keys(emu.tables).length >= 5);
});

test('R27 production PKI guard blocks production without identity and allows with PKI', () => {
  const oldEnv = process.env.NODE_ENV;
  const oldPki = process.env.PKI_ENABLED;
  process.env.NODE_ENV = 'production';
  process.env.PKI_ENABLED = 'false';
  assert.throws(() => assertProductionPki(), /production_pki_required/);
  process.env.PKI_ENABLED = 'true';
  assert.equal(assertProductionPki().ok, true);
  process.env.NODE_ENV = oldEnv;
  process.env.PKI_ENABLED = oldPki;
});

test('R27 tenant policy override changes governance decisions operationally', async () => {
  const app = createApp();
  await app.handleHttp({ runtime: 'test', path: '/tenants', method: 'POST', headers: adminHeaders, body: { tenantId: 'tenant-a', name: 'Tenant A', policies: ['tenant-base'] } });
  const override = await app.handleHttp({ runtime: 'test', path: '/tenants/tenant-a/policies/override', method: 'POST', headers: { ...adminHeaders, 'x-tenant-id': 'tenant-a' }, body: { overrides: { allowProviders: ['gemini'], maxBudgetCents: 50, allowResidencies: ['eu'] } } });
  assert.equal(override.statusCode, 200);

  const effective = await app.handleHttp({ runtime: 'test', path: '/tenants/tenant-a/policies/effective', method: 'GET', headers: { ...adminHeaders, 'x-tenant-id': 'tenant-a' } });
  assert.equal(effective.statusCode, 200);
  assert.deepEqual(effective.body.item.overrides.allowProviders, ['gemini']);

  const denied = evaluateToolPolicy({ tool: 'llm_invoke', action: 'chat', ctx: { pki: { tenantId: 'tenant-a', role: 'admin' } }, payload: { provider: 'openai', model: 'gpt-5.4', budgetCents: 10, residency: 'eu' } });
  assert.equal(denied.decision, 'deny');
  assert.equal(denied.reason, 'tenant_provider_not_allowed');

  const escalated = evaluateToolPolicy({ tool: 'llm_invoke', action: 'chat', ctx: { pki: { tenantId: 'tenant-a', role: 'admin' } }, payload: { provider: 'gemini', model: 'gemini-2.0-flash', budgetCents: 120, residency: 'eu' } });
  assert.equal(escalated.decision, 'escalate');
  assert.equal(escalated.reason, 'tenant_budget_guard_exceeded');
});

test('R27 OTel exporter path is externally testable', async () => {
  const app = createApp();
  const list = await app.handleHttp({ runtime: 'test', path: '/otel/exporters', method: 'GET', headers: adminHeaders });
  assert.equal(list.statusCode, 200);
  assert.ok(Array.isArray(list.body.items));

  const send = await app.handleHttp({ runtime: 'test', path: '/otel/export/test', method: 'POST', headers: adminHeaders, body: { type: 'integration_proof', traceId: 'trace-r27' } });
  assert.equal(send.statusCode, 200);
  assert.equal(send.body.success, true);
  assert.ok(OTel.getSnapshot().otel.exportEvents.length >= 1);
});

test('R27 DAG registry exposes seeded example DAGs and executes split join flow', async () => {
  const app = createApp();
  const list = await app.handleHttp({ runtime: 'test', path: '/dag', method: 'GET', headers: adminHeaders });
  assert.equal(list.statusCode, 200);
  assert.ok(list.body.items.find((item) => item.dagId === 'research-split-join'));
  assert.ok(list.body.items.find((item) => item.dagId === 'retail-decision'));

  const execRes = await app.handleHttp({ runtime: 'test', path: '/dag/execute', method: 'POST', headers: adminHeaders, body: { dagId: 'research-split-join', payload: { query: 'R27 deep research proof' } } });
  assert.equal(execRes.statusCode, 200);
  assert.equal(execRes.body.success, true);
  assert.ok(execRes.body.runId);
  const latestState = await app.handleHttp({ runtime: 'test', path: '/state/runtime', method: 'GET', headers: adminHeaders });
  const run = latestState.body.store.runs.find((item) => item.runId === execRes.body.runId);
  assert.ok(run);
  assert.equal(run.status, 'COMPLETED');
});

test('R27 state backend endpoints surface multi-instance backend health', async () => {
  const app = createApp();
  const backends = await app.handleHttp({ runtime: 'test', path: '/state/backends', method: 'GET', headers: adminHeaders });
  assert.equal(backends.statusCode, 200);
  assert.ok(backends.body.items.runtime);
  assert.ok(backends.body.items.circuitBreaker);
  assert.ok(backends.body.items.dlq);
  assert.ok(backends.body.items.tenants);
  assert.ok(backends.body.items.economic);

  const health = await app.handleHttp({ runtime: 'test', path: '/state/backends/health', method: 'GET', headers: adminHeaders });
  assert.equal(health.statusCode, 200);
  assert.equal(health.body.healthy, true);
});

test('R27 runtime store persists in dynamodb mode across module reload', () => {
  process.env.RUNTIME_STORE_BACKEND = 'dynamodb';
  delete require.cache[require.resolve('../backend/services/ui/runtime.store')];
  let store = require('../backend/services/ui/runtime.store');
  store.createRun({ runId: 'persist-ddb-run', task: 'ddb persist' });
  store.transitionRun('persist-ddb-run', 'EXECUTING', { stepName: 'run' });
  delete require.cache[require.resolve('../backend/services/ui/runtime.store')];
  store = require('../backend/services/ui/runtime.store');
  const loaded = store.getRun('persist-ddb-run');
  assert.ok(loaded);
  assert.equal(loaded.status, 'EXECUTING');
  assert.equal(store.getBackendInfo().mode, 'dynamodb');
});

test('R27 circuit breaker opens and blocks, supervisor fallback proof primitive stays visible', () => {
  circuitBreaker.recordFailure('provider.openai', new Error('boom-1'));
  circuitBreaker.recordFailure('provider.openai', new Error('boom-2'));
  circuitBreaker.recordFailure('provider.openai', new Error('boom-3'));
  assert.throws(() => circuitBreaker.canExecute('provider.openai'), /circuit_breaker_open/);
  const snap = circuitBreaker.getSnapshot();
  assert.equal(snap.items['provider.openai'].state, 'open');
});

test('R27 DLQ captures failures and exposes backend metadata', () => {
  const item = dlq.enqueue({ type: 'provider_failure', error: 'simulated', payload: { provider: 'openai' } });
  assert.ok(item.id);
  const snap = dlq.getSnapshot();
  assert.equal(snap.total, 1);
  assert.ok(snap.backend.mode);
});

test('R27 retail decision DAG runs policy + retail brain + economic path end-to-end', async () => {
  const app = createApp();
  const res = await app.handleHttp({
    runtime: 'test',
    path: '/dag/execute',
    method: 'POST',
    headers: adminHeaders,
    body: {
      dagId: 'retail-decision',
      payload: { provider: 'openai', model: 'gpt-5.4', budgetCents: 75, residency: 'eu', taskClass: 'pricing', category: 'food', metrics: { margin_rate: 0.18, out_of_stock_rate: 0.06 } }
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.results.policyCheck.output.decision);
  assert.ok(res.body.results.retailBrain.output.recommendation);
  assert.ok(res.body.results.economicOptimization.output.action);
});

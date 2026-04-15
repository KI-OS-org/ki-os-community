/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * (c) 2026 KI-OS.org — AgentMesh Hardening Tests
 *
 * Tests: store operations, persistence, models, controller endpoints,
 *        execution strategy config, orphan recovery.
 *
 * No new npm packages — uses node:test + node:assert only.
 * LLM-dependent paths are not invoked; controller and runtime
 * internals are tested without live API calls.
 */
process.env.NODE_ENV = 'test';
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Load a fresh copy of a module by deleting it from the require cache first. */
function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

const STORE_MODULE    = path.resolve(__dirname, '../backend/services/agentmesh/mesh.store.js');
const MODELS_MODULE   = path.resolve(__dirname, '../backend/services/agentmesh/mesh.models.js');
const RUNTIME_MODULE  = path.resolve(__dirname, '../backend/services/agentmesh/mesh.runtime.js');
const CTRL_MODULE     = path.resolve(__dirname, '../backend/services/agentmesh/mesh.runtime.controller.js');

// ─── TASK 1: Store tests ──────────────────────────────────────────────────────

test('store: createRun → getRun returns the same run', () => {
  const store = freshRequire(STORE_MODULE);
  const run = store.createRun({ runId: 'test-run-1', taskDescription: 'hello', userId: 'u1', tenantId: 't1', status: 'PENDING', createdAt: new Date().toISOString(), steps: [] });
  const fetched = store.getRun('test-run-1');
  assert.ok(fetched, 'getRun should return the run');
  assert.equal(fetched.runId, 'test-run-1');
  assert.equal(fetched.taskDescription, 'hello');
});

test('store: updateRun → partial updates applied correctly', () => {
  const store = freshRequire(STORE_MODULE);
  store.createRun({ runId: 'test-run-2', taskDescription: 'update-test', userId: 'u1', tenantId: 't1', status: 'PENDING', createdAt: new Date().toISOString(), steps: [] });
  const updated = store.updateRun('test-run-2', { status: 'EXECUTING', startedAt: '2026-01-01T00:00:00.000Z' });
  assert.ok(updated);
  assert.equal(updated.status, 'EXECUTING');
  assert.equal(updated.startedAt, '2026-01-01T00:00:00.000Z');
  // runId must not be overwritten
  assert.equal(updated.runId, 'test-run-2');
});

test('store: addStep → step appears in run.steps', () => {
  const store = freshRequire(STORE_MODULE);
  store.createRun({ runId: 'test-run-3', taskDescription: 'step-test', userId: 'u1', tenantId: 't1', status: 'PENDING', createdAt: new Date().toISOString(), steps: [] });
  const result = store.addStep('test-run-3', { stepId: 'step-1', runId: 'test-run-3', agentId: 'supervisor-v1', role: 'supervisor', description: 'test step', status: 'RUNNING' });
  assert.ok(result);
  const run = store.getRun('test-run-3');
  assert.equal(run.steps.length, 1);
  assert.equal(run.steps[0].stepId, 'step-1');
});

test('store: listRuns with status filter', () => {
  const store = freshRequire(STORE_MODULE);
  store.createRun({ runId: 'run-status-a', taskDescription: 'a', userId: 'u1', tenantId: 't1', status: 'COMPLETED', createdAt: new Date().toISOString(), steps: [] });
  store.createRun({ runId: 'run-status-b', taskDescription: 'b', userId: 'u1', tenantId: 't1', status: 'FAILED',    createdAt: new Date().toISOString(), steps: [] });
  store.updateRun('run-status-a', { status: 'COMPLETED' });
  store.updateRun('run-status-b', { status: 'FAILED' });
  const { runs: completed } = store.listRuns({ status: 'COMPLETED' });
  const { runs: failed }    = store.listRuns({ status: 'FAILED' });
  assert.ok(completed.some(r => r.runId === 'run-status-a'), 'COMPLETED filter should include run-status-a');
  assert.ok(failed.some(r => r.runId === 'run-status-b'),    'FAILED filter should include run-status-b');
  assert.ok(!completed.some(r => r.runId === 'run-status-b'), 'COMPLETED filter should not include run-status-b');
});

test('store: eviction at MAX_RUNS (small cap)', () => {
  // Set a tiny cap, create enough runs to force eviction.
  // Use a fresh isolated store file so previous test runs don't pollute the count.
  const savedMax  = process.env.MESH_MAX_RUNS;
  const savedFile = process.env.MESH_STORE_FILE;
  process.env.MESH_MAX_RUNS  = '3';
  process.env.MESH_STORE_FILE = require('node:path').join(require('node:os').tmpdir(), '.ki-os-evict-test-' + Date.now() + '.json');
  // Fresh require with new env
  delete require.cache[STORE_MODULE];
  const store = require(STORE_MODULE);
  store.createRun({ runId: 'evict-1', taskDescription: 'e1', userId: 'u', tenantId: 't', status: 'COMPLETED', createdAt: new Date().toISOString(), steps: [] });
  store.createRun({ runId: 'evict-2', taskDescription: 'e2', userId: 'u', tenantId: 't', status: 'COMPLETED', createdAt: new Date().toISOString(), steps: [] });
  store.createRun({ runId: 'evict-3', taskDescription: 'e3', userId: 'u', tenantId: 't', status: 'COMPLETED', createdAt: new Date().toISOString(), steps: [] });
  store.createRun({ runId: 'evict-4', taskDescription: 'e4', userId: 'u', tenantId: 't', status: 'COMPLETED', createdAt: new Date().toISOString(), steps: [] });
  // evict-1 should have been evicted
  assert.equal(store.getRun('evict-1'), null, 'Oldest run should have been evicted');
  assert.ok(store.getRun('evict-4'), 'Newest run should still exist');
  // Restore
  if (savedMax === undefined) delete process.env.MESH_MAX_RUNS;
  else process.env.MESH_MAX_RUNS = savedMax;
  if (savedFile === undefined) delete process.env.MESH_STORE_FILE;
  else process.env.MESH_STORE_FILE = savedFile;
  delete require.cache[STORE_MODULE];
});

test('store: persistence — save to temp file, reload and verify', () => {
  const tmpFile = path.join(process.cwd(), '.tmp-agentmesh-test-' + Date.now() + '.json');

  const cleanup = () => {
    try {
      const dir  = path.dirname(tmpFile);
      const base = path.basename(tmpFile);
      fs.readdirSync(dir)
        .filter(f => f === base || f.startsWith(base + '.'))
        .forEach(f => { try { fs.rmSync(path.join(dir, f), { force: true }); } catch {} });
    } catch {}
    delete process.env.MESH_STORE_FILE;
    delete require.cache[STORE_MODULE];
  };

  process.env.MESH_STORE_FILE = tmpFile;
  delete require.cache[STORE_MODULE];
  const store1 = require(STORE_MODULE);

  store1.createRun({ runId: 'persist-1', taskDescription: 'persist-test', userId: 'ua', tenantId: 'ta', status: 'PENDING', createdAt: new Date().toISOString(), steps: [] });
  store1.addStep('persist-1', { stepId: 'ps-1', runId: 'persist-1', agentId: 'supervisor-v1', role: 'supervisor', description: 'test', status: 'COMPLETED' });

  // Wait a brief moment for the debounce to fire
  const waitForFlush = () => new Promise(resolve => setTimeout(resolve, 200));

  return waitForFlush().then(() => {
    // Issue 1: .tmp file must NOT persist after atomic write (it was renamed to the real file)
    assert.ok(!fs.existsSync(tmpFile + '.tmp'), '.tmp file should not exist after a successful flush');

    // Reload store from same file
    delete require.cache[STORE_MODULE];
    const store2 = require(STORE_MODULE);
    const loaded = store2.getRun('persist-1');
    assert.ok(loaded, 'Run should be loaded from disk');
    assert.equal(loaded.taskDescription, 'persist-test');
    assert.equal(loaded.steps.length, 1);
    assert.equal(loaded.steps[0].stepId, 'ps-1');

    // Issue 2: corrupt file → a .corrupt-* backup must be created
    fs.writeFileSync(tmpFile, 'THIS IS NOT VALID JSON', 'utf8');
    delete require.cache[STORE_MODULE];
    require(STORE_MODULE); // triggers loadFromDisk on the corrupt file

    const dir   = path.dirname(tmpFile);
    const base  = path.basename(tmpFile);
    const files = fs.readdirSync(dir);
    const backupExists = files.some(f => f.startsWith(base + '.corrupt-'));
    assert.ok(backupExists, 'A .corrupt-* backup file should be created when the store file contains invalid JSON');
  }).finally(cleanup);
});

// ─── TASK 2 Part A & B: Models tests ─────────────────────────────────────────

test('mesh.models: createMeshRun fields present', () => {
  const { createMeshRun } = require(MODELS_MODULE);
  const run = createMeshRun({ runId: 'r-1', taskDescription: 'test task', userId: 'u1', tenantId: 't1', traceId: 'tr1', mode: 'runtime' });
  assert.equal(run.runId, 'r-1');
  assert.equal(run.taskDescription, 'test task');
  assert.equal(run.userId, 'u1');
  assert.equal(run.tenantId, 't1');
  assert.equal(run.traceId, 'tr1');
  assert.equal(run.mode, 'runtime');
  assert.equal(run.status, 'PENDING');
  assert.ok(run.createdAt, 'createdAt should be set');
  assert.equal(run.startedAt, null);
  assert.equal(run.completedAt, null);
  assert.deepEqual(run.steps, []);
  assert.equal(run.result, null);
  assert.equal(run.error, null);
  assert.equal(run.durationMs, null);
});

test('mesh.models: createMeshStep fields present', () => {
  const { createMeshStep } = require(MODELS_MODULE);
  const step = createMeshStep({ runId: 'r-1', stepId: 's-1', agentId: 'supervisor-v1', role: 'supervisor', description: 'Assess task', inputs: { task: 'hello' } });
  assert.equal(step.stepId, 's-1');
  assert.equal(step.runId, 'r-1');
  assert.equal(step.agentId, 'supervisor-v1');
  assert.equal(step.role, 'supervisor');
  assert.equal(step.description, 'Assess task');
  assert.deepEqual(step.inputs, { task: 'hello' });
  assert.equal(step.outputs, null);
  assert.equal(step.status, 'PENDING');
  assert.equal(step.startedAt, null);
  assert.equal(step.completedAt, null);
  assert.equal(step.error, null);
  assert.deepEqual(step.toolCalls, []);
  assert.equal(step.policyDecision, null);
  assert.equal(step.reviewDecision, null);
});

// ─── TASK 2 Part C: Controller tests ─────────────────────────────────────────

test('controller: cancelRun on COMPLETED run → 409', () => {
  // Set up store and controller freshly
  delete require.cache[STORE_MODULE];
  delete require.cache[CTRL_MODULE];
  delete require.cache[RUNTIME_MODULE];

  const store      = require(STORE_MODULE);
  const { createMeshRun } = require(MODELS_MODULE);

  // Pre-populate a completed run
  store.createRun(Object.assign(createMeshRun({ runId: 'ctrl-cancel-1', taskDescription: 'done', userId: 'u', tenantId: 't' }), { status: 'COMPLETED' }));

  // We test the controller logic directly — cancelRun is not exported but
  // handleMeshRuntimeRequest dispatches to it
  const { handleMeshRuntimeRequest } = require(CTRL_MODULE);

  return handleMeshRuntimeRequest('/agentmesh/runs/ctrl-cancel-1/cancel', 'POST', {}, {}).then(res => {
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('terminal'), 'Error should mention terminal state');
  });
});

test('controller: retryRun on FAILED run → new runId returned', () => {
  delete require.cache[STORE_MODULE];
  delete require.cache[CTRL_MODULE];
  delete require.cache[RUNTIME_MODULE];

  const store = require(STORE_MODULE);
  const { createMeshRun } = require(MODELS_MODULE);

  // Pre-populate a failed run
  store.createRun(Object.assign(createMeshRun({ runId: 'ctrl-retry-1', taskDescription: 'retry-task', userId: 'u2', tenantId: 't2' }), { status: 'FAILED' }));

  const { handleMeshRuntimeRequest } = require(CTRL_MODULE);

  return handleMeshRuntimeRequest('/agentmesh/runs/ctrl-retry-1/retry', 'POST', {}, {}).then(res => {
    assert.equal(res.statusCode, 202, 'Should return 202 Accepted');
    assert.equal(res.body.success, true);
    assert.ok(res.body.runId, 'New runId should be returned');
    assert.notEqual(res.body.runId, 'ctrl-retry-1', 'New runId must differ from original');
    assert.equal(res.body.retryOf, 'ctrl-retry-1', 'retryOf should reference original runId');
    assert.equal(res.body.status, 'PENDING');
    // Verify the new run exists in store
    const newRun = store.getRun(res.body.runId);
    assert.ok(newRun, 'New run should exist in store');
    assert.equal(newRun.taskDescription, 'retry-task');
  });
});

// ─── TASK 3 Part A: Execution strategy config ─────────────────────────────────

test('getExecutionConfig with STRATEGY=minimal → runResearch=false, runMemory=false, runReviewer=false', () => {
  const savedStrategy = process.env.MESH_EXECUTION_STRATEGY;
  process.env.MESH_EXECUTION_STRATEGY = 'minimal';
  delete require.cache[RUNTIME_MODULE];
  const { getExecutionConfig } = require(RUNTIME_MODULE);
  const cfg = getExecutionConfig({ requiresResearch: true, requiresMemory: true, complexity: 'high' });
  assert.equal(cfg.runResearch, false,  'minimal: runResearch should be false');
  assert.equal(cfg.runMemory,   false,  'minimal: runMemory should be false');
  assert.equal(cfg.runReviewer, false,  'minimal: runReviewer should be false');
  assert.ok(cfg.model, 'minimal: model should be set');
  // Restore
  if (savedStrategy === undefined) delete process.env.MESH_EXECUTION_STRATEGY;
  else process.env.MESH_EXECUTION_STRATEGY = savedStrategy;
  delete require.cache[RUNTIME_MODULE];
});

test('getExecutionConfig with STRATEGY=reduced and low complexity → runReviewer=false', () => {
  const savedStrategy = process.env.MESH_EXECUTION_STRATEGY;
  process.env.MESH_EXECUTION_STRATEGY = 'reduced';
  delete require.cache[RUNTIME_MODULE];
  const { getExecutionConfig } = require(RUNTIME_MODULE);
  const cfg = getExecutionConfig({ requiresResearch: false, requiresMemory: false, complexity: 'low' });
  assert.equal(cfg.runReviewer, false, 'reduced + low complexity: runReviewer should be false');
  assert.equal(cfg.runResearch, false, 'reduced: runResearch matches supervisor output');
  assert.equal(cfg.runMemory,   false, 'reduced: runMemory matches supervisor output');
  // Restore
  if (savedStrategy === undefined) delete process.env.MESH_EXECUTION_STRATEGY;
  else process.env.MESH_EXECUTION_STRATEGY = savedStrategy;
  delete require.cache[RUNTIME_MODULE];
});

// ─── TASK 2 Part B: Orphan recovery ──────────────────────────────────────────

test('recoverOrphanRuns → stuck runs marked FAILED', () => {
  // Set a very short timeout so all "old" runs will be recovered
  const savedTimeout = process.env.MESH_RUN_TIMEOUT_MS;
  process.env.MESH_RUN_TIMEOUT_MS = '1'; // 1ms — any run started before "now" is an orphan
  delete require.cache[STORE_MODULE];
  delete require.cache[RUNTIME_MODULE];

  const store = require(STORE_MODULE);
  const { createMeshRun } = require(MODELS_MODULE);

  // Create stuck runs directly in store
  const stuckRun = Object.assign(
    createMeshRun({ runId: 'orphan-1', taskDescription: 'stuck', userId: 'u', tenantId: 't' }),
    { status: 'EXECUTING', startedAt: new Date(Date.now() - 10000).toISOString() }
  );
  store.createRun(stuckRun);

  const { recoverOrphanRuns } = require(RUNTIME_MODULE);
  recoverOrphanRuns();

  const recovered = store.getRun('orphan-1');
  assert.ok(recovered, 'Run should still exist in store');
  assert.equal(recovered.status, 'FAILED', 'Orphan run should be marked FAILED');
  assert.equal(recovered.error, 'orphan_recovered_on_restart');

  // Restore
  if (savedTimeout === undefined) delete process.env.MESH_RUN_TIMEOUT_MS;
  else process.env.MESH_RUN_TIMEOUT_MS = savedTimeout;
  delete require.cache[STORE_MODULE];
  delete require.cache[RUNTIME_MODULE];
});

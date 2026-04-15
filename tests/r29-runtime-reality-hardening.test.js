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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-r29-'));
process.env.DAG_REGISTRY_PATH = path.join(tempDir, 'dag-registry.json');
process.env.RUNTIME_STORE_PATH = path.join(tempDir, 'runtime-store.json');
process.env.RUNTIME_STORE_BACKEND = 'file';
process.env.KI_OS_TEST_MODE = 'true';

delete require.cache[require.resolve('../core/app')];
delete require.cache[require.resolve('../backend/services/dag/dag.runtime.service')];
delete require.cache[require.resolve('../backend/services/ui/runtime.store')];
const { createApp } = require('../core/app');
const dagRuntime = require('../backend/services/dag/dag.runtime.service');
const runtimeStore = require('../backend/services/ui/runtime.store');
const authHeaders = { 'x-user-id': 'qa-user', 'x-role': 'admin', 'x-tenant-id': 'tenant-r29' };

test.beforeEach(() => {
  try { fs.rmSync(process.env.DAG_REGISTRY_PATH, { force: true }); } catch {}
  dagRuntime.resetDagRegistry();
  runtimeStore.resetStore();
});

test.after(() => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('R29 persists DAG definitions to registry file', async () => {
  const app = createApp();
  const create = await app.handleHttp({ path: '/dag', method: 'POST', runtime: 'test', headers: authHeaders, body: { dagId: 'persisted-r29', name: 'Persisted DAG', nodes: [{ id: 'start', type: 'task', workerType: 'chat' }], edges: [] } });
  assert.equal(create.statusCode, 200);
  const raw = JSON.parse(fs.readFileSync(process.env.DAG_REGISTRY_PATH, 'utf8'));
  assert.ok(raw.dags.find((x) => x.dagId === 'persisted-r29'));
});

test('R29 task nodes default to worker-orchestrator mode and fall back safely when credentials are unavailable', async () => {
  delete process.env.OPENAI_API_KEY;
  const app = createApp();
  const res = await app.handleHttp({ path: '/dag/execute', method: 'POST', runtime: 'test', headers: authHeaders, body: { dagId: 'research-split-join', payload: { query: 'delegation proof' } } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.results.input.delegated, true);
  assert.ok(['worker-orchestrator', 'worker-orchestrator-fallback'].includes(res.body.results.input.delegateMode));
  assert.match(String(res.body.results.input.summary || res.body.results.input.output.summary || ''), /delegated|fallback/i);
});

test('R29 state backend payload includes dag registry backend info', async () => {
  const app = createApp();
  const res = await app.handleHttp({ path: '/state/backends', method: 'GET', runtime: 'test', headers: authHeaders });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.dagRegistry.persisted, true);
  assert.ok(res.body.items.dagRegistry.path);
});

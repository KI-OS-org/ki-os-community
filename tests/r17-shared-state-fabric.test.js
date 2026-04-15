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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-r17-'));
process.env.RUNTIME_STORE_PATH = path.join(tempDir, 'runtime-store.json');
process.env.RATE_LIMIT_PERSIST_PATH = path.join(tempDir, 'rate-limit.json');
process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE = 'true';

const { createApp } = require('../core/app');
const runtimeStore = require('../backend/services/ui/runtime.store');
const rateLimit = require('../backend/services/core/rate-limit.service');
const Observability = require('../backend/services/core/observability.service');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };

test.beforeEach(() => {
  Observability.reset();
  runtimeStore.resetStore();
  rateLimit.resetRateLimits();
});

test.after(() => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('R17 state fabric reports runtime and rate limit backends', async () => {
  const app = createApp();
  const run = runtimeStore.createRun({ runId: 'run-r17', type: 'chat', userId: 'qa-admin' });
  runtimeStore.transitionRun(run.runId, 'EXECUTING');
  const rate = rateLimit.assertRateLimit({ path: '/chat', method: 'POST', headers: adminHeaders, ctx: { pki: { userId: 'qa-admin' } } });
  assert.ok(rate.remaining >= 0);

  const res = await app.handleHttp({ runtime: 'test', path: '/state/fabric', method: 'GET', headers: adminHeaders });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.runtime.backend.kind, 'file');
  assert.equal(res.body.rateLimit.backend.kind, 'file');
  assert.equal(res.body.runtime.runs, 1);
  assert.ok(res.body.rateLimit.totalBuckets >= 1);
});

test('R17 export and import roundtrip restores runtime and rate limit state', async () => {
  const app = createApp();
  const run = runtimeStore.createRun({ runId: 'run-roundtrip', task: 'alpha', userId: 'qa-admin' });
  runtimeStore.transitionRun(run.runId, 'ROUTED');
  rateLimit.assertRateLimit({ path: '/ui/config', method: 'GET', headers: adminHeaders, ctx: { pki: { userId: 'qa-admin' } } });

  const exported = await app.handleHttp({ runtime: 'test', path: '/state/export', method: 'GET', headers: adminHeaders });
  assert.equal(exported.statusCode, 200);
  assert.equal(exported.body.runtime.store.runs.length, 1);
  assert.ok(exported.body.rateLimit.totalBuckets >= 1);

  runtimeStore.resetStore();
  rateLimit.resetRateLimits();

  const imported = await app.handleHttp({ runtime: 'test', path: '/state/import', method: 'POST', headers: adminHeaders, body: exported.body });
  assert.equal(imported.statusCode, 200);

  const runtimeRes = await app.handleHttp({ runtime: 'test', path: '/state/runtime', method: 'GET', headers: adminHeaders });
  assert.equal(runtimeRes.statusCode, 200);
  assert.equal(runtimeRes.body.store.runs[0].runId, 'run-roundtrip');

  const rateRes = await app.handleHttp({ runtime: 'test', path: '/state/rate-limit', method: 'GET', headers: adminHeaders });
  assert.equal(rateRes.statusCode, 200);
  assert.ok(rateRes.body.totalBuckets >= 1);
});

test('R17 rate limit file backend persists buckets to disk', async () => {
  rateLimit.assertRateLimit({ path: '/admin/test', method: 'POST', headers: adminHeaders, ctx: { pki: { userId: 'qa-admin' } } });
  const persistedPath = process.env.RATE_LIMIT_PERSIST_PATH;
  assert.ok(fs.existsSync(persistedPath));
  const parsed = JSON.parse(fs.readFileSync(persistedPath, 'utf8'));
  assert.ok(Array.isArray(parsed.items));
  assert.equal(parsed.items.length, 1);
});

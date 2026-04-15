/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app');
const eventbus = require('../backend/services/ui/ui.eventbus');
const runtimeStore = require('../backend/services/ui/runtime.store');
const audit = require('../backend/services/ui/ui.audit');
const OTel = require('../backend/services/core/otel-lite.service');
const Observability = require('../backend/services/core/observability.service');

const authHeaders = { 'x-user-id': 'qa-user', 'x-role': 'admin' };

test.beforeEach(() => {
  eventbus.reset();
  runtimeStore.resetStore();
  audit.resetAudit();
  OTel.reset();
  Observability.reset();
  process.env.KI_OS_TEST_MODE = 'true';
});

test('R11 control plane exposes cockpit incidents security and traces', async () => {
  const app = createApp();
  eventbus.push('security.event', { traceId: 'trace-sec', runId: 'run-sec' });
  eventbus.push('supervisor.escalated', { traceId: 'trace-esc', runId: 'run-esc' });
  runtimeStore.createRun({ runId: 'run-sec', type: 'chat', userId: 'qa-user' });

  await app.handleHttp({ path: '/health', method: 'GET', runtime: 'test', headers: authHeaders });
  const controlPlane = await app.handleHttp({ path: '/ui/control-plane', method: 'GET', runtime: 'test', headers: authHeaders });
  assert.equal(controlPlane.statusCode, 200);
  assert.equal(controlPlane.body.success, true);
  assert.ok(Array.isArray(controlPlane.body.incidents));
  assert.ok(Array.isArray(controlPlane.body.security));
  assert.ok(Array.isArray(controlPlane.body.traces));
  assert.equal(controlPlane.body.telemetry.enabled, true);

  const incidents = await app.handleHttp({ path: '/ui/incidents', method: 'GET', runtime: 'test', headers: authHeaders });
  assert.equal(incidents.statusCode, 200);
  assert.ok(incidents.body.items.some((item) => String(item.type).includes('supervisor.escalated')));

  const security = await app.handleHttp({ path: '/ui/security', method: 'GET', runtime: 'test', headers: authHeaders });
  assert.equal(security.statusCode, 200);
  assert.ok(security.body.items.some((item) => String(item.type).includes('security.event')));

  const traces = await app.handleHttp({ path: '/ui/traces', method: 'GET', runtime: 'test', headers: authHeaders });
  assert.equal(traces.statusCode, 200);
  assert.ok(Array.isArray(traces.body.items));
  assert.ok(traces.body.telemetry.spansStored >= 1);
});

test('R11 task drilldown alias returns run payload', async () => {
  const app = createApp();
  runtimeStore.createRun({ runId: 'run-r11', type: 'chat', userId: 'qa-user' });
  runtimeStore.transitionRun('run-r11', 'EXECUTING', { stepName: 'execute', worker: 'chat', model: 'gpt-5.4' });
  const res = await app.handleHttp({ path: '/ui/tasks/run-r11', method: 'GET', runtime: 'test', headers: authHeaders });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.item.runId, 'run-r11');
  assert.equal(res.body.item.status, 'EXECUTING');
});

test('R11 otel trace endpoint returns request spans', async () => {
  const app = createApp();
  await app.handleHttp({ path: '/status', method: 'GET', runtime: 'test', headers: authHeaders });
  const res = await app.handleHttp({ path: '/otel/tracez', method: 'GET', runtime: 'test', headers: authHeaders, query: { limit: '5' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.items));
  assert.ok(res.body.items.some((item) => item.name === 'http.request'));
});

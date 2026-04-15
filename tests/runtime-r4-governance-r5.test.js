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
const { reset } = require('../backend/services/core/observability.service');
const { resetAudit } = require('../backend/services/ui/ui.audit');
const { resetApprovals } = require('../backend/services/governance/approvals.store');
const { __resetDesktopState } = require('../backend/services/desktop/desktop.engine');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };
const operatorHeaders = { 'x-user-id': 'qa-operator', 'x-role': 'operator' };

function resetEnv() {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  process.env.DESKTOP_CONTROL_MODE = process.platform === 'darwin' ? 'macos' : 'powershell';
  process.env.DESKTOP_CONTROL_FORCE_SUPPORTED = 'true';
  process.env.KI_OS_TEST_MODE = 'true';
}

test.beforeEach(() => {
  resetEnv();
  runtimeStore.resetStore();
  reset();
  resetAudit();
  resetApprovals();
  __resetDesktopState();
});

test('runtime store blocks invalid transitions', () => {
  const run = runtimeStore.createRun({ task: 'qa invalid transition' });
  assert.throws(() => runtimeStore.transitionRun(run.runId, 'COMPLETED'), /invalid_transition:CREATED->COMPLETED/);
});

test('runtime store tracks expected and observed outcome coverage', () => {
  const run = runtimeStore.createRun({ task: 'qa outcome coverage' });
  runtimeStore.transitionRun(run.runId, 'EXECUTING', { stepName: 'start' });
  runtimeStore.setExpectedOutcome(run.runId, { key: 'deliver.answer' });
  runtimeStore.setExpectedOutcome(run.runId, { key: 'persist.audit' });
  runtimeStore.appendObservedOutcome(run.runId, { key: 'deliver.answer' });
  const stored = runtimeStore.getRun(run.runId);
  assert.equal(stored.outcome.expected.length, 2);
  assert.equal(stored.outcome.observed.length, 1);
  assert.equal(stored.outcome.coverage, 0.5);
  assert.equal(stored.projection.coverage, 0.5);
});

test('operator critical desktop action moves run into WAITING_APPROVAL', async () => {
  const app = createApp();
  const res = await app.handleHttp({
    runtime: 'test',
    path: '/desktop/action',
    method: 'POST',
    headers: operatorHeaders,
    body: { action: 'type', text: 'hello world', sessionId: 'desk-r5' }
  });
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.approvalRequired, true);
  const run = runtimeStore.getRun(res.body.runId);
  assert.equal(run.status, 'WAITING_APPROVAL');
  assert.equal(run.projection.summary, 'waiting_approval');
});

test('admin safe desktop action is allowed and returns policy metadata', async () => {
  const app = createApp();
  const res = await app.handleHttp({
    runtime: 'test',
    path: '/desktop/action',
    method: 'POST',
    headers: adminHeaders,
    body: { action: 'wait', durationMs: 1, sessionId: 'desk-r5-admin' }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.policy.decision, 'allow');
  const run = runtimeStore.getRun(res.body.runId);
  assert.equal(run.status, 'COMPLETED');
  assert.equal(run.outcome.coverage, 1);
});

test('governance UI endpoints expose policy registry and approvals', async () => {
  const app = createApp();
  await app.handleHttp({ runtime: 'test', path: '/desktop/action', method: 'POST', headers: operatorHeaders, body: { action: 'type', text: 'abc', sessionId: 'desk-r5-ui' } });
  const policies = await app.handleHttp({ runtime: 'test', path: '/ui/governance/policies', method: 'GET', headers: adminHeaders, query: {} });
  const approvals = await app.handleHttp({ runtime: 'test', path: '/ui/governance/approvals', method: 'GET', headers: adminHeaders, query: {} });
  assert.equal(policies.statusCode, 200);
  assert.equal(approvals.statusCode, 200);
  assert.ok(Array.isArray(policies.body.items));
  assert.ok(policies.body.items.some((item) => item.id === 'desktop-critical-approval'));
  assert.ok(Array.isArray(approvals.body.items));
  assert.ok(approvals.body.items.length >= 1);
});

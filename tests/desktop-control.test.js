/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app');
const service = require('../backend/services/desktop/desktop.service');
const { fallbackPlan } = require('../backend/services/agent/planning.engine');
const { executeTask } = require('../backend/services/core/worker.orchestrator');
const { getWorker } = require('../backend/services/core/worker.registry');

const adminHeaders = { 'x-user-id': 'qa-user', 'x-role': 'admin' };
const viewerHeaders = { 'x-user-id': 'qa-viewer', 'x-role': 'viewer' };

function resetEnv() {
  delete process.env.DESKTOP_CONTROL_ENABLED;
  delete process.env.DESKTOP_CONTROL_MODE;
  delete process.env.DESKTOP_CONTROL_FORCE_SUPPORTED;
  process.env.KI_OS_TEST_MODE = 'true';
}

test.beforeEach(() => {
  service.__resetDesktopState();
  resetEnv();
});

test.after(() => {
  resetEnv();
  service.__resetDesktopState();
});

test('desktop routes expose status, stop, lock and unlock', async () => {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  process.env.DESKTOP_CONTROL_MODE = process.platform === 'darwin' ? 'macos' : 'powershell';
  process.env.DESKTOP_CONTROL_FORCE_SUPPORTED = 'true';
  const app = createApp();

  const status = await app.handleHttp({ runtime: 'test', path: '/desktop/status', method: 'GET', headers: viewerHeaders, body: null });
  assert.equal(status.statusCode, 200);
  assert.equal(typeof status.body.enabled, 'boolean');

  const lock = await app.handleHttp({ runtime: 'test', path: '/desktop/session/lock', method: 'POST', headers: adminHeaders, body: { sessionId: 's1' } });
  assert.equal(lock.statusCode, 200);
  assert.equal(lock.body.lockState.locked, true);

  const stop = await app.handleHttp({ runtime: 'test', path: '/desktop/stop', method: 'POST', headers: adminHeaders, body: { reason: 'qa' } });
  assert.equal(stop.statusCode, 200);
  assert.equal(stop.body.stopRequested, true);

  const unlock = await app.handleHttp({ runtime: 'test', path: '/desktop/session/unlock', method: 'POST', headers: adminHeaders, body: { sessionId: 's1', clearStop: true } });
  assert.equal(unlock.statusCode, 200);
});

test('desktop planning includes desktop_action for click query', () => {
  const plan = fallbackPlan('Bitte steuere den Desktop und klicke auf den Button', { desktopX: 120, desktopY: 80, sessionId: 'desk-1' });
  const tools = plan.steps.map(step => step.tool);
  assert.ok(tools.includes('desktop_status'));
  assert.ok(tools.includes('desktop_observe'));
  assert.ok(tools.includes('desktop_action'));
  const action = plan.steps.find(step => step.tool === 'desktop_action');
  assert.equal(action.parameters.action, 'click');
  assert.equal(action.depends_on[0], 'step_desktop_observe');
});

test('server-side guard is enforced for guest callers', async () => {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  process.env.DESKTOP_CONTROL_MODE = process.platform === 'darwin' ? 'macos' : 'powershell';
  process.env.DESKTOP_CONTROL_FORCE_SUPPORTED = 'true';
  const result = await service.performDesktopAction({ action: 'wait', durationMs: 1, userGuard: false, sessionId: 's2' }, { role: 'guest' });
  assert.equal(result.success, true);
  assert.equal(result.userGuard, true);
  assert.equal(result.guardEnforced, true);
});

test('desktop worker is registered and orchestrator routes to desktop service', async () => {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  process.env.DESKTOP_CONTROL_MODE = process.platform === 'darwin' ? 'macos' : 'powershell';
  process.env.DESKTOP_CONTROL_FORCE_SUPPORTED = 'true';
  const worker = getWorker('desktop');
  assert.equal(worker.worker_type, 'desktop');
  assert.ok(worker.capabilities.includes('desktop_action'));

  const result = await executeTask({ worker_type: 'desktop', model: 'gpt-4o', input_data: { command: 'status' } });
  assert.equal(result.output_type, 'desktop');
  const parsed = JSON.parse(result.output_data);
  assert.equal(typeof parsed.enabled, 'boolean');
});

test('desktop action validation rejects missing click coordinates', async () => {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  process.env.DESKTOP_CONTROL_MODE = process.platform === 'darwin' ? 'macos' : 'powershell';
  process.env.DESKTOP_CONTROL_FORCE_SUPPORTED = 'true';
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/desktop/action', method: 'POST', headers: adminHeaders, body: { action: 'click' } });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /missing_parameter/);
});

test('desktop write routes reject viewer role', async () => {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  process.env.DESKTOP_CONTROL_MODE = process.platform === 'darwin' ? 'macos' : 'powershell';
  process.env.DESKTOP_CONTROL_FORCE_SUPPORTED = 'true';
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/desktop/stop', method: 'POST', headers: viewerHeaders, body: { reason: 'qa' } });
  assert.equal(res.statusCode, 403);
});

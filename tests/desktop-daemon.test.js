/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../backend/services/desktop/desktop.service');
const client = require('../backend/services/desktop/desktop.daemon.client');

function setDaemonEnv() {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  process.env.DESKTOP_CONTROL_FORCE_SUPPORTED = 'true';
  process.env.DESKTOP_CONTROL_MODE = process.platform === 'darwin' ? 'macos' : 'powershell';
  process.env.KI_OS_TEST_MODE = 'true';
  process.env.DESKTOP_DAEMON_ENABLED = 'true';
  process.env.DESKTOP_DAEMON_PORT = '47839';
  process.env.DESKTOP_DAEMON_TOKEN = 'daemon-test-token';
}

async function cleanup() {
  await client.shutdownDaemon().catch(() => null);
  process.env.DESKTOP_DAEMON_ENABLED = 'false';
  service.__resetDesktopState();
  delete process.env.DESKTOP_CONTROL_ENABLED;
  delete process.env.DESKTOP_CONTROL_FORCE_SUPPORTED;
  delete process.env.DESKTOP_CONTROL_MODE;
  delete process.env.DESKTOP_DAEMON_PORT;
  delete process.env.DESKTOP_DAEMON_TOKEN;
}

test.beforeEach(async () => {
  await cleanup();
});

test.after(async () => {
  await cleanup();
});

test('desktop daemon auto-starts and answers status/action requests', async () => {
  setDaemonEnv();
  const status = await service.getDesktopStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.adapter, 'test-adapter');

  const lock = await service.lockDesktopSession({ sessionId: 'daemon-s1' });
  assert.equal(lock.success, true);
  assert.equal(lock.lockState.locked, true);

  const action = await service.performDesktopAction({ action: 'wait', durationMs: 5, sessionId: 'daemon-s1', userGuard: false }, { role: 'admin' });
  assert.equal(action.success, true);

  const stop = await service.stopDesktopActions('qa-stop');
  assert.equal(stop.success, true);
  assert.equal(stop.stopRequested, true);

  const state = await service.getCompanionState();
  assert.equal(state.lockState.locked, true);
  assert.equal(state.stopRequested, true);
});

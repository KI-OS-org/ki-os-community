/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app');
const { reset, push } = require('../backend/services/ui/ui.eventbus');
const { resetAudit } = require('../backend/services/ui/ui.audit');
const { resetStore } = require('../backend/services/ui/runtime.store');

const authHeaders = { 'x-user-id': 'qa-user', 'x-role': 'admin' };

test.beforeEach(() => {
  reset();
  resetAudit();
  resetStore();
  process.env.KI_OS_TEST_MODE = 'true';
});

test('cockpit receives events from chat and desktop actions', async () => {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  process.env.DESKTOP_CONTROL_MODE = process.platform === 'darwin' ? 'macos' : 'powershell';
  process.env.DESKTOP_CONTROL_FORCE_SUPPORTED = 'true';
  const app = createApp();

  push('agent.started', { agentId: 'agent-1', type: 'chat', task: 'Hallo KI-OS', step: 'intake', worker: 'chat', model: 'gpt-5.4' });
  await app.handleHttp({ runtime: 'test', path: '/desktop/stop', method: 'POST', headers: authHeaders, body: { reason: 'qa' } });

  const res = await app.handleHttp({ runtime: 'test', path: '/ui/cockpit', method: 'GET', headers: authHeaders, query: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.events));
  assert.ok(res.body.summary.providersTotal >= 1);
  assert.ok(typeof res.body.summary.averageLatencyMs === 'number');
});

test('audit endpoint exposes recorded desktop actions', async () => {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  process.env.DESKTOP_CONTROL_MODE = process.platform === 'darwin' ? 'macos' : 'powershell';
  process.env.DESKTOP_CONTROL_FORCE_SUPPORTED = 'true';
  const app = createApp();
  await app.handleHttp({ runtime: 'test', path: '/desktop/session/lock', method: 'POST', headers: authHeaders, body: { sessionId: 'qa-session' } });

  const audit = await app.handleHttp({ runtime: 'test', path: '/ui/audit', method: 'GET', headers: authHeaders, query: {} });
  assert.equal(audit.statusCode, 200);
  assert.equal(audit.body.success, true);
  assert.ok(audit.body.items.some((item) => String(item.action).includes('desktop')));
});

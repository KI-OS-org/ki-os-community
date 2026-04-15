/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: automation-webhook-callback.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const configSvc = require('../backend/services/automation.config.service');
const { handleHubCallback } = require('../backend/services/automation.webhook.service');

test.beforeEach(() => {
  configSvc.__resetAutomationConfigStore();
});

test('callback accepts valid bearer secret', async () => {
  await configSvc.saveWebhookConfig({ id: 'hub_n8n_customer_sync', hub: 'n8n', flowId: 'customer-sync', secret: 'abc123', allowCallback: true });
  const res = await handleHubCallback('n8n', 'customer-sync', { status: 'success', result: { ok: true } }, { headers: { authorization: 'Bearer abc123' } });
  assert.equal(res.success, true);
  assert.equal(res.status, 'success');
  assert.deepEqual(res.result, { ok: true });
});

test('callback rejects invalid secret', async () => {
  await configSvc.saveWebhookConfig({ id: 'hub_make_order_alert', hub: 'make', flowId: 'order-alert', secret: 'right-secret' });
  const res = await handleHubCallback('make', 'order-alert', { status: 'done' }, { headers: { authorization: 'Bearer wrong-secret' } });
  assert.equal(res.success, false);
  assert.match(res.error, /invalid automation secret/);
});

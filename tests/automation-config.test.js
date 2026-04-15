/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: automation-config.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const svc = require('../backend/services/automation.config.service');

test.beforeEach(() => {
  svc.__resetAutomationConfigStore();
});

test('save and get webhook config with hub metadata', async () => {
  const saved = await svc.saveWebhookConfig({ id: 'hub_n8n_customer_sync', hub: 'n8n', flowId: 'customer-sync', url: 'https://example.test/hook', secret: 'abc' });
  assert.equal(saved.success, true);
  assert.equal(saved.item.hub, 'n8n');
  const fetched = await svc.getWebhookConfig('hub_n8n_customer_sync');
  assert.equal(fetched.flowId, 'customer-sync');
  assert.equal(fetched.method, 'POST');
});

test('find config by hub and flow', async () => {
  await svc.saveWebhookConfig({ id: 'hub_make_order_alert', hub: 'make', flowId: 'order-alert', url: 'https://example.test/make' });
  const found = await svc.findWebhookConfigByHubFlow('make', 'order-alert');
  assert.ok(found);
  assert.equal(found.id, 'hub_make_order_alert');
});

test('save config rejects missing id', async () => {
  await assert.rejects(() => svc.saveWebhookConfig({ hub: 'n8n' }), /id/);
});

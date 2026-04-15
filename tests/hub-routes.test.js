process.env.NODE_ENV = 'test';
/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: hub-routes.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const configSvc = require('../backend/services/automation.config.service');

const servicePath = require.resolve('../backend/services/automation.webhook.service');
let calls = [];

function stubAutomationService() {
  calls = [];
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      triggerConfiguredAutomation: async (id, params = {}) => {
        calls.push({ type: 'admin-test', id, params });
        return { success: true, id, testMode: !!params.testMode };
      },
      triggerHubWebhook: async (hub, flowId, params = {}) => {
        calls.push({ type: 'trigger', hub, flowId, params });
        return { success: true, hub, flowId, requestId: 'req_test', result: { ok: true }, testMode: !!params.testMode };
      },
      handleHubCallback: async (hub, flowId, body) => ({ success: true, hub, flowId, result: body.result || body }),
      handleAutomationWebhook: async (body) => ({ success: true, body })
    }
  };
}

test.beforeEach(async () => {
  configSvc.__resetAutomationConfigStore();
  stubAutomationService();
  delete require.cache[require.resolve('../core/app')];
  await configSvc.saveWebhookConfig({ id: 'hub_n8n_customer_sync', hub: 'n8n', flowId: 'customer-sync', url: 'https://example.test/hook', secret: 'demo' });
});

test.afterEach(() => {
  delete require.cache[servicePath];
});

test('route POST /v1/hubs/webhook/:hub/:flowId triggers dispatcher', async () => {
  const { createApp } = require('../core/app');
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/v1/hubs/webhook/n8n/customer-sync', method: 'POST', headers: { 'x-user-id': 'test', 'x-role': 'user' }, body: { customerId: '123' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].flowId, 'customer-sync');
});

test('route POST /v1/hubs/callback/:hub/:flowId validates callback', async () => {
  const { createApp } = require('../core/app');
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/v1/hubs/callback/n8n/customer-sync', method: 'POST', headers: { 'x-user-id': 'test', 'x-role': 'user' }, body: { status: 'success', result: { synced: true } } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.result, { synced: true });
});

test('admin webhook test route triggers test mode', async () => {
  const { createApp } = require('../core/app');
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/admin/automation/webhook/test', method: 'POST', headers: { 'x-user-id': 'admin-user', 'x-role': 'admin' }, body: { id: 'hub_n8n_customer_sync', data: { ping: true } } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(calls.at(-1).params.testMode, true);
});

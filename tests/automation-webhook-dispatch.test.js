/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: automation-webhook-dispatch.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const configSvc = require('../backend/services/automation.config.service');

let captured;
const servicePath = path.resolve(__dirname, '../backend/services/automation.webhook.service.js');

function loadServiceWithAxiosStub(impl) {
  global.__KIOS_AXIOS__ = impl;
  delete require.cache[servicePath];
  return require(servicePath);
}

test.beforeEach(() => {
  configSvc.__resetAutomationConfigStore();
  captured = null;
  delete process.env.HUB_N8N_CUSTOMER_SYNC_SECRET;
});

test.afterEach(() => {
  delete global.__KIOS_AXIOS__;
  delete require.cache[servicePath];
});

test('dispatch configured automation sends bearer secret and test mode', async () => {
  process.env.HUB_N8N_CUSTOMER_SYNC_SECRET = 'secret-123';
  const svc = loadServiceWithAxiosStub(async (config) => {
    captured = config;
    return { status: 202, data: { accepted: true } };
  });
  await configSvc.saveWebhookConfig({ id: 'hub_n8n_customer_sync', hub: 'n8n', flowId: 'customer-sync', url: 'https://example.test/hook', secretRef: 'env:HUB_N8N_CUSTOMER_SYNC_SECRET' });
  const res = await svc.triggerConfiguredAutomation('hub_n8n_customer_sync', { data: { hello: 'world' }, testMode: true });
  assert.equal(res.success, true);
  assert.equal(captured.headers.Authorization, 'Bearer secret-123');
  assert.equal(captured.headers['X-KIOS-Hub'], 'n8n');
  assert.equal(captured.data.testMode, true);
  assert.equal(captured.data.data.hello, 'world');
});

test('dispatch configured automation returns skipped on missing url', async () => {
  const svc = loadServiceWithAxiosStub(async () => {
    throw new Error('should not be called');
  });
  await configSvc.saveWebhookConfig({ id: 'hub_http_missing', hub: 'http', flowId: 'sap-proxy' });
  const res = await svc.triggerConfiguredAutomation('hub_http_missing', { data: { ping: true } });
  assert.equal(res.result.skipped, true);
  assert.equal(res.result.reason, 'url_missing');
});

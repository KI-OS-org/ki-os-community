/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: agent-webhook-tool.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const configSvc = require('../backend/services/automation.config.service');

const automationServicePath = require.resolve('../backend/services/automation.webhook.service');
const toolsRegistryPath = require.resolve('../backend/services/agent/tools.registry');
const planningPath = require.resolve('../backend/services/agent/planning.engine');
let calls = [];

function stubAutomationService() {
  calls = [];
  require.cache[automationServicePath] = {
    id: automationServicePath,
    filename: automationServicePath,
    loaded: true,
    exports: {
      triggerConfiguredAutomation: async (id, params) => {
        calls.push({ mode: 'id', id, params });
        return { success: true, id, params };
      },
      triggerHubWebhook: async (hub, flowId, params) => {
        calls.push({ mode: 'hub', hub, flowId, params });
        return { success: true, hub, flowId, params };
      }
    }
  };
  delete require.cache[toolsRegistryPath];
  delete require.cache[planningPath];
}

test.beforeEach(async () => {
  configSvc.__resetAutomationConfigStore();
  stubAutomationService();
  await configSvc.saveWebhookConfig({ id: 'hub_n8n_customer_sync', hub: 'n8n', flowId: 'customer-sync', url: 'https://example.test/hook', secret: 'demo' });
});

test.afterEach(() => {
  delete require.cache[automationServicePath];
  delete require.cache[toolsRegistryPath];
  delete require.cache[planningPath];
});

test('tools registry exposes webhook_trigger', () => {
  const { registry } = require('../backend/services/agent/tools.registry');
  const tool = registry.getTool('webhook_trigger');
  assert.ok(tool);
  assert.match(tool.description, /Webhook/i);
});

test('webhook_trigger executes configured flow by hub + flowId', async () => {
  const { registry } = require('../backend/services/agent/tools.registry');
  const result = await registry.executeTool('webhook_trigger', { hub: 'n8n', flowId: 'customer-sync', data: { test: true }, testMode: true });
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, 'hub');
  assert.equal(calls[0].params.testMode, true);
});

test('fallback plan creates webhook step for integration query', () => {
  const { fallbackPlan } = require('../backend/services/agent/planning.engine');
  const plan = fallbackPlan('Bitte an n8n schicken und customer-sync triggern', { testMode: true });
  assert.equal(plan.steps[0].tool, 'webhook_trigger');
  assert.equal(plan.steps[0].parameters.hub, 'n8n');
  assert.equal(plan.steps[0].parameters.testMode, true);
});

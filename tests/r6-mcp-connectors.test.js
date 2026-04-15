/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app');
const { resetRegistry, registerConnector, updateConnectorHealth } = require('../backend/services/connectors/capability.registry');
const { validateConnectorContract } = require('../backend/services/connectors/connector.adapter');
const { reset } = require('../backend/services/core/observability.service');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };
const operatorHeaders = { 'x-user-id': 'qa-operator', 'x-role': 'operator' };

test.beforeEach(() => {
  process.env.DESKTOP_CONTROL_ENABLED = 'true';
  reset();
  resetRegistry();
});

test('connector contract rejects missing capabilities', () => {
  assert.throws(() => validateConnectorContract({ id: 'bad-connector', protocol: 'mcp' }), /capabilities_required/);
});

test('GET /connectors exposes capability metadata for all active connectors', async () => {
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/connectors', method: 'GET', headers: adminHeaders, query: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.preferredStandard, 'mcp');
  assert.ok(Array.isArray(res.body.items));
  assert.ok(res.body.items.length >= 5);
  assert.ok(res.body.items.every((item) => Array.isArray(item.capabilities) && item.capabilities.length >= 1));
  assert.ok(res.body.items.some((item) => item.id === 'mcp-bridge' && item.protocol === 'mcp'));
});

test('GET /mcp/capabilities returns MCP-compatible registry payload', async () => {
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/mcp/capabilities', method: 'GET', headers: adminHeaders, query: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.protocol, 'mcp');
  assert.equal(res.body.registry.preferredStandard, 'mcp');
  assert.ok(res.body.registry.summary.healthy >= 1);
});

test('connector health changes are centrally visible', async () => {
  updateConnectorHealth('websearch-native', 'degraded');
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/mcp/health', method: 'GET', headers: adminHeaders, query: {} });
  assert.equal(res.statusCode, 200);
  const connector = res.body.items.find((item) => item.id === 'websearch-native');
  assert.equal(connector.health, 'degraded');
});

test('operator MCP invoke requires approval path, admin is allowed', async () => {
  const app = createApp();
  const opRes = await app.handleHttp({
    runtime: 'test',
    path: '/mcp/invoke',
    method: 'POST',
    headers: operatorHeaders,
    body: { connectorId: 'mcp-bridge', capability: 'mcp.invoke' }
  });
  assert.equal(opRes.statusCode, 202);
  assert.equal(opRes.body.policy.decision, 'escalate');

  const adminRes = await app.handleHttp({
    runtime: 'test',
    path: '/mcp/invoke',
    method: 'POST',
    headers: adminHeaders,
    body: { connectorId: 'mcp-bridge', capability: 'mcp.invoke' }
  });
  assert.equal(adminRes.statusCode, 200);
  assert.equal(adminRes.body.policy.decision, 'allow');
});

test('custom connector can be registered via standard contract', () => {
  const registered = registerConnector({
    id: 'sap-mcp',
    name: 'SAP MCP',
    protocol: 'mcp',
    capabilities: ['sap.read.orders', 'sap.read.inventory'],
    health: 'healthy',
    trustLevel: 'high',
    metadata: { category: 'erp' },
    routes: { invoke: '/mcp/invoke' }
  });
  assert.equal(registered.id, 'sap-mcp');
  assert.equal(registered.protocol, 'mcp');
  assert.deepEqual(registered.capabilities, ['sap.read.orders', 'sap.read.inventory']);
});

/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */

process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-r14-'));
process.env.FILE_FABRIC_DIR = path.join(tempDir, 'file-fabric');
process.env.CONNECTOR_REGISTRY_PATH = path.join(tempDir, 'connectors.json');

const { createApp } = require('../core/app');
const Observability = require('../backend/services/core/observability.service');
const runtimeStore = require('../backend/services/ui/runtime.store');
const { resetRegistry, listCapabilities } = require('../backend/services/connectors/capability.registry');
const { resetFabric } = require('../backend/services/files/file.fabric.service');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };

test.beforeEach(() => {
  Observability.reset();
  runtimeStore.resetStore();
  resetRegistry();
  resetFabric();
});

test.after(() => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('R14 connector fabric exposes templates capability index and file fabric connector', async () => {
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/connectors/fabric', method: 'GET', headers: adminHeaders });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.version, 'v2');
  assert.ok(Array.isArray(res.body.templates));
  assert.ok(res.body.registry.items.some((item) => item.id === 'file-fabric'));
  assert.ok(res.body.capabilityIndex.some((item) => item.capability === 'file.put'));
});

test('R14 can register persistent custom connector and list it after reset', async () => {
  const app = createApp();
  const create = await app.handleHttp({
    runtime: 'test',
    path: '/connectors/register',
    method: 'POST',
    headers: adminHeaders,
    body: {
      id: 'sap-bridge',
      name: 'SAP Bridge',
      protocol: 'mcp',
      capabilities: ['sap.read'],
      health: 'healthy',
      trustLevel: 'standard',
      metadata: { category: 'erp' }
    }
  });
  assert.equal(create.statusCode, 200);
  assert.equal(create.body.item.id, 'sap-bridge');

  const persisted = JSON.parse(fs.readFileSync(process.env.CONNECTOR_REGISTRY_PATH, 'utf8'));
  assert.ok(Array.isArray(persisted.items));
  assert.ok(persisted.items.some((item) => item.id === 'sap-bridge'));
  const detail = await app.handleHttp({ runtime: 'test', path: '/connectors/sap-bridge', method: 'GET', headers: adminHeaders });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.body.item.id, 'sap-bridge');
});

test('R14 file fabric uploads lists reads and deletes files', async () => {
  const app = createApp();
  const upload = await app.handleHttp({
    runtime: 'test',
    path: '/files/upload',
    method: 'POST',
    headers: adminHeaders,
    body: { userId: 'ingo', name: 'note.txt', content: 'hello file fabric', metadata: { source: 'qa' } }
  });
  assert.equal(upload.statusCode, 200);
  const fileId = upload.body.item.id;

  const list = await app.handleHttp({ runtime: 'test', path: '/files', method: 'GET', headers: adminHeaders, query: { userId: 'ingo' } });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.total, 1);

  const content = await app.handleHttp({ runtime: 'test', path: `/files/${fileId}/content`, method: 'GET', headers: adminHeaders });
  assert.equal(content.statusCode, 200);
  assert.equal(content.body.contentText, 'hello file fabric');

  const del = await app.handleHttp({ runtime: 'test', path: `/files/${fileId}`, method: 'DELETE', headers: adminHeaders });
  assert.equal(del.statusCode, 200);
  assert.equal(del.body.success, true);
});

test('R14 connector invoke uses file fabric built-in capability', async () => {
  const app = createApp();
  const invoke = await app.handleHttp({
    runtime: 'test',
    path: '/connectors/invoke',
    method: 'POST',
    headers: adminHeaders,
    body: { capability: 'file.put', payload: { userId: 'ingo', name: 'from-connector.txt', content: 'via connector' } }
  });
  assert.equal(invoke.statusCode, 200);
  assert.equal(invoke.body.connectorId, 'file-fabric');
  const fileId = invoke.body.result.item.id;

  const get = await app.handleHttp({ runtime: 'test', path: `/files/${fileId}/content`, method: 'GET', headers: adminHeaders });
  assert.equal(get.statusCode, 200);
  assert.equal(get.body.item.name, 'from-connector.txt');
});

test('R14 ui file fabric endpoint exposes summary and mcp manifest exposes templates', async () => {
  const app = createApp();
  await app.handleHttp({ runtime: 'test', path: '/files/upload', method: 'POST', headers: adminHeaders, body: { userId: 'ingo', name: 'qa.json', content: '{"ok":true}', mimeType: 'application/json' } });
  const ui = await app.handleHttp({ runtime: 'test', path: '/ui/files', method: 'GET', headers: adminHeaders });
  assert.equal(ui.statusCode, 200);
  assert.equal(ui.body.summary.total, 1);

  const manifest = await app.handleHttp({ runtime: 'test', path: '/mcp/manifest', method: 'GET', headers: adminHeaders });
  assert.equal(manifest.statusCode, 200);
  assert.ok(Array.isArray(manifest.body.templates));
  assert.ok(Array.isArray(manifest.body.capabilities));
});

test('R14 capability resolution finds registered capability provider', () => {
  const caps = listCapabilities();
  assert.ok(caps.some((item) => item.capability === 'file.delete'));
});

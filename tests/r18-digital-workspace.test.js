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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-r18-'));
process.env.WORKSPACE_STORE_PATH = path.join(tempDir, 'workspace.json');
process.env.RUNTIME_STORE_PATH = path.join(tempDir, 'runtime.json');
process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE = 'true';

const { createApp } = require('../core/app');
const runtimeStore = require('../backend/services/ui/runtime.store');
const Observability = require('../backend/services/core/observability.service');
const { resetWorkspaceStore } = require('../backend/services/workspace/workspace.controller');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };
const userHeaders = { 'x-user-id': 'qa-user', 'x-role': 'user' };

test.beforeEach(() => {
  Observability.reset();
  runtimeStore.resetStore();
  resetWorkspaceStore();
});

test.after(() => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('R18 workspace returns specialized panels for research task class', async () => {
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/workspace', method: 'GET', query: { task: 'deep research briefing' }, headers: userHeaders });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.workspace.taskClass, 'research');
  assert.ok(res.body.workspace.panels.includes('sources'));
  assert.ok(Array.isArray(res.body.workspace.form));
});

test('R18 workspace whiteboard persists collaboration notes', async () => {
  const app = createApp();
  const add = await app.handleHttp({ runtime: 'test', path: '/workspace/whiteboard', method: 'POST', headers: adminHeaders, body: { text: 'Investigate pricing anomaly', x: 10, y: 20 } });
  assert.equal(add.statusCode, 200);
  assert.equal(add.body.entry.text, 'Investigate pricing anomaly');

  const list = await app.handleHttp({ runtime: 'test', path: '/workspace/whiteboard', method: 'GET', headers: adminHeaders });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.items.length, 1);
});

test('R18 UI exposes operator and user workspace variants', async () => {
  const app = createApp();
  runtimeStore.createRun({ runId: 'run-workspace-1', task: 'retail kpi review', status: 'EXECUTING', userId: 'qa-user' });

  const operator = await app.handleHttp({ runtime: 'test', path: '/ui/workspace/operator', method: 'GET', headers: adminHeaders, query: { task: 'retail kpi review', runId: 'run-workspace-1' } });
  const user = await app.handleHttp({ runtime: 'test', path: '/ui/workspace/user', method: 'GET', headers: userHeaders, query: { task: 'retail kpi review', runId: 'run-workspace-1' } });

  assert.equal(operator.statusCode, 200);
  assert.equal(user.statusCode, 200);
  assert.equal(operator.body.workspace.taskClass, 'commerce');
  assert.equal(operator.body.workspace.role.mode, 'operator');
  assert.equal(user.body.workspace.role.mode, 'user');
  assert.equal(operator.body.workspace.currentRun.runId, 'run-workspace-1');
});

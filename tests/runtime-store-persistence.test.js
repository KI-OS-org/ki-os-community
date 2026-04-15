/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../backend/services/ui/runtime.store.js');
const uiRoutesPath = path.resolve(__dirname, '../backend/services/ui/ui.routes.js');
const appPath = path.resolve(__dirname, '../core/app.js');
const chatControllerPath = path.resolve(__dirname, '../backend/services/chat.controller.js');

function freshStore(filePath) {
  process.env.RUNTIME_STORE_PATH = filePath;
  delete require.cache[modulePath];
  return require(modulePath);
}

test('runtime store persists runs across module reload', () => {
  const filePath = path.join(process.cwd(), '.tmp-runtime-store-persistence.json');
  try { fs.rmSync(filePath, { force: true }); } catch {}
  let store = freshStore(filePath);
  store.resetStore();
  const created = store.createRun({ runId: 'persist-run-1', task: 'Persist me', userId: 'qa-user' });
  store.transitionRun(created.runId, 'EXECUTING', { stepName: 'run' });
  store.appendOutput(created.runId, { text: 'done' });
  delete require.cache[modulePath];
  store = freshStore(filePath);
  const loaded = store.getRun('persist-run-1');
  assert.ok(loaded);
  assert.equal(loaded.task, 'Persist me');
  assert.equal(loaded.status, 'EXECUTING');
  assert.equal(loaded.outputs.length, 1);
  store.resetStore();
  delete process.env.RUNTIME_STORE_PATH;
  delete require.cache[modulePath];
  delete require.cache[uiRoutesPath];
  delete require.cache[appPath];
  delete require.cache[chatControllerPath];
  require(modulePath);
});

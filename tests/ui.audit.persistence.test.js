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

const modulePath = path.resolve(__dirname, '../backend/services/ui/ui.audit.js');
const uiRoutesPath = path.resolve(__dirname, '../backend/services/ui/ui.routes.js');
const appPath = path.resolve(__dirname, '../core/app.js');
const chatControllerPath = path.resolve(__dirname, '../backend/services/chat.controller.js');

function freshAudit(filePath) {
  process.env.UI_AUDIT_PATH = filePath;
  delete require.cache[modulePath];
  return require(modulePath);
}

test('audit log persists entries across module reload', () => {
  const filePath = path.join(process.cwd(), '.tmp-ui-audit.ndjson');
  try { fs.rmSync(filePath, { force: true }); } catch {}
  let audit = freshAudit(filePath);
  audit.resetAudit();
  audit.writeAudit('desktop.lock', { target: 'session-1' }, { userId: 'qa-user', role: 'admin' });
  delete require.cache[modulePath];
  audit = freshAudit(filePath);
  const items = audit.getAuditEntries(10);
  assert.equal(items.length, 1);
  assert.equal(items[0].action, 'desktop.lock');
  assert.equal(items[0].role, 'admin');
  audit.resetAudit();
  delete process.env.UI_AUDIT_PATH;
  delete require.cache[modulePath];
  delete require.cache[uiRoutesPath];
  delete require.cache[appPath];
  delete require.cache[chatControllerPath];
  require(modulePath);
});

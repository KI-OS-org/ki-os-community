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

test('R28.1 qa:claude script includes R28 suite', () => {
  const pkg = require('../package.json');
  assert.match(pkg.scripts['qa:claude'], /r28-control-plane-visible\.test\.js/);
});

test('R28.1 full regression runner writes version-specific artifacts', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'full-regression.js'), 'utf8');
  assert.match(script, /LABEL/);
  assert.match(script, /FULL_REGRESSION_SUMMARY\.json/);
});

test('R28.1 HTTP client fallback exists for axios-free environments', async () => {
  const client = require('../backend/services/core/http.client');
  assert.equal(typeof client.request, 'function');
  assert.equal(typeof client.post, 'function');
  assert.equal(typeof client.get, 'function');
});

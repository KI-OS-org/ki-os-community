/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: trust-policy.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyTrustPolicy } = require('../backend/policy/trust.policy');

test('trust policy approves strong default score', () => {
  const out = applyTrustPolicy({ trust_score: 80 }, { worker_type: 'chat' });
  assert.equal(out.action, 'approve');
});

test('trust policy rejects weak research score', () => {
  const out = applyTrustPolicy({ trust_score: 20 }, { worker_type: 'research' });
  assert.equal(out.action, 'revise');
});

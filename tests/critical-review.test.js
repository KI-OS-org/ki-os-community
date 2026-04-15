/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: critical-review.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { reviewOutput } = require('../backend/services/mesh/critical.review.service');

test('reviewOutput flags academic response without sources', () => {
  const out = reviewOutput({ task: { domain: 'academic', task: 'Dissertation' }, answer: 'Kurzer Text', sources: [] });
  assert.equal(out.status, 'revise');
  assert.ok(out.findings.length >= 1);
});

test('reviewOutput approves basic business response', () => {
  const out = reviewOutput({ task: { domain: 'business', task: 'Board Summary' }, answer: 'Dies ist ein ausreichend langer Antworttext mit Kontext und Entscheidungspunkten.'.repeat(3), sources: [] });
  assert.equal(out.status, 'approve');
});

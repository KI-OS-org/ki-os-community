/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: mesh-framing.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { frameTask } = require('../backend/services/mesh/task.framing.service');

test('frameTask asks only critical academic questions', () => {
  const framed = frameTask({ message: 'Mein Thema für meine Promotion ist KI im Retail' }, { userDefaults: { quality: 'high' } });
  assert.equal(framed.domain, 'academic');
  assert.equal(framed.needs_clarification, true);
  assert.ok(framed.questions.length <= 3);
  assert.ok(framed.questions.some(q => q.key === 'source_rules'));
});

test('frameTask infers business goal from email request', () => {
  const framed = frameTask({ message: 'Bitte schreibe eine Mail an den CFO wegen Budgetfreigabe' }, {});
  assert.equal(framed.domain, 'communication');
  assert.match(framed.summary, /Auftrag:/);
});

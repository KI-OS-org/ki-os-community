/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: domain-routing.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { routeDomainTask } = require('../backend/services/domain/domain.router');

test('routes retail request to retail agent', () => {
  const out = routeDomainTask({ task: 'Erstelle eine Loyalty Strategie im Handel', domain: 'business' }, {});
  assert.equal(out.selected, 'retail');
  assert.equal(out.enrichment.review_lens, 'retail-review');
});

test('routes phd request to research agent', () => {
  const out = routeDomainTask({ task: 'Mein Thema für meine Promotion ist KI', domain: 'academic' }, {});
  assert.equal(out.selected, 'research');
  assert.equal(out.enrichment.review_lens, 'academic-review');
});

/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app');
const Observability = require('../backend/services/core/observability.service');
const {
  classifyTask,
  resolveDynamicRoute,
  listRoutingDecisions,
  resetRoutingDecisionLog
} = require('../backend/services/routing/dynamic-routing.service');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };

test.beforeEach(() => {
  process.env.OPENAI_ENABLED = 'true';
  process.env.ANTHROPIC_ENABLED = 'true';
  process.env.GEMINI_ENABLED = 'true';
  process.env.DEEPSEEK_ENABLED = 'true';
  process.env.OPENROUTER_ENABLED = 'true';
  Observability.reset();
  resetRoutingDecisionLog();
});

test('task classification v1 recognizes key reference cases', () => {
  const cases = [
    ['Bitte schreibe Node.js Code für eine API', 'code'],
    ['Mach eine aktuelle Websuche zu KI Trends', 'websearch'],
    ['Analysiere die Strategie und begründe sie', 'reasoning'],
    ['Erzeuge ein Bildkonzept für die Startseite', 'vision'],
    ['Bitte antworte schnell und kurz', 'fast'],
    ['Mach das möglichst günstig', 'low_cost'],
    ['Vergleiche aktuelle Anbieter mit Quellen', 'websearch'],
    ['Warum ist die Architektur so aufgebaut?', 'reasoning'],
    ['Screenshot der Seite analysieren', 'vision'],
    ['Normale Chat Antwort für mich', 'default']
  ];
  const hits = cases.filter(([query, expectedRole]) => classifyTask({ query }).role === expectedRole).length;
  assert.ok(hits >= 9, `expected at least 9 correct classifications, got ${hits}`);
});

test('dynamic router chooses preferred capable model and logs decision', async () => {
  const decision = await resolveDynamicRoute({ query: 'Bitte schreibe ein Refactoring für Node API Code' });
  assert.equal(decision.role, 'code');
  assert.ok(['anthropic', 'openai', 'deepseek', 'openrouter', 'gemini'].includes(decision.selected.provider));
  assert.ok(decision.selected.model);
  assert.equal(listRoutingDecisions(10).length, 1);
  const snapshot = Observability.getSnapshot();
  assert.ok(snapshot.observability.eventsByType['routing.decision.made'] >= 1);
});

test('fallback activates when preferred providers are unavailable', async () => {
  process.env.OPENAI_ENABLED = 'false';
  process.env.ANTHROPIC_ENABLED = 'false';
  process.env.GEMINI_ENABLED = 'false';
  const decision = await resolveDynamicRoute({ query: 'Suche aktuelle News zu Retail AI' });
  assert.equal(decision.role, 'websearch');
  assert.equal(decision.fallbackUsed, true);
  assert.equal(decision.selected.provider, 'openrouter');
  const snapshot = Observability.getSnapshot();
  assert.ok(snapshot.observability.eventsByType['routing.fallback.used'] >= 1);
});

test('routing endpoints expose decision log and profiles', async () => {
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/routing/resolve', method: 'POST', headers: adminHeaders, body: { query: 'Bitte kurz Markt News recherchieren' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.decision.selected.provider);

  const decisions = await app.handleHttp({ runtime: 'test', path: '/ui/routing/decisions', method: 'GET', headers: adminHeaders, query: {} });
  const profiles = await app.handleHttp({ runtime: 'test', path: '/ui/routing/profiles', method: 'GET', headers: adminHeaders, query: {} });
  assert.equal(decisions.statusCode, 200);
  assert.equal(profiles.statusCode, 200);
  assert.ok(Array.isArray(decisions.body.items));
  assert.ok(Array.isArray(profiles.body.items));
  assert.ok(profiles.body.items.some((item) => item.provider === 'openai'));
});

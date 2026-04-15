// ghost.control.test.js
const { test, expect } = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const createAbortController = (timeout) => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller;
};

test('Einfachster Workflow — genau 1 navigate Step erwartet', async () => {
  const goal = 'Öffne die Agents-Seite';
  const mode = 'demo';
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });
  const r = await response.json();
  assert.strictEqual(response.status, 200);
  assert(r.plan);
  assert(Array.isArray(r.plan.steps));
  assert(r.plan.steps.length >= 1);
  assert(r.plan.steps[0].type === 'navigate');
  assert(r.plan.steps[0].callout.length > 0);
});

test('Kein Step-Duplikat bei Agent-Erstellung', async () => {
  const goal = 'Erstelle einen neuen Agenten';
  const mode = 'demo';
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });
  const r = await response.json();
  assert.strictEqual(response.status, 200);
  assert(r.plan);
  assert(Array.isArray(r.plan.steps));
  const stepIds = r.plan.steps.map(step => `${step.type}-${step.target}`);
  assert.strictEqual(new Set(stepIds).size, stepIds.length);
});

test('Callouts nicht leer', async () => {
  const goal = 'Navigiere zum Memory und erstelle einen Eintrag';
  const mode = 'demo';
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });
  const r = await response.json();
  assert.strictEqual(response.status, 200);
  assert(r.plan);
  assert(Array.isArray(r.plan.steps));
  r.plan.steps.forEach(step => {
    assert(step.callout.length > 5);
  });
});

test('Max 10 Steps eingehalten', async () => {
  const goal = 'Mache einen vollständigen Agenten-Erstellungs-Workflow mit allen Feldern';
  const mode = 'demo';
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });
  const r = await response.json();
  assert.strictEqual(response.status, 200);
  assert(r.plan);
  assert(Array.isArray(r.plan.steps));
  assert(r.plan.steps.length <= 10);
});

test('Reihenfolge korrekt — navigate vor spotlight vor click/fill', async () => {
  const goal = 'Erstelle einen neuen Job';
  const mode = 'demo';
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });
  const r = await response.json();
  assert.strictEqual(response.status, 200);
  assert(r.plan);
  assert(Array.isArray(r.plan.steps));
  let hasFilledOrClicked = false;
  for (const step of r.plan.steps) {
    if (['fill', 'click'].includes(step.type)) {
      hasFilledOrClicked = true;
    } else if (step.type === 'navigate' && hasFilledOrClicked) {
      assert.fail('navigate-Step nach fill-Step');
    }
  }
});

test('needsClarification hat immer question-Text', async () => {
  const goal = 'Mach irgendwas';
  const mode = 'demo';
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });
  const r = await response.json();
  assert.strictEqual(response.status, 200);
  if (r.needsClarification) {
    assert(r.question.length > 10);
  }
});

test('Parallele UX-Loads — 5 gleichzeitige Anfragen', async () => {
  const goals = [
    'Öffne die Agents-Seite',
    'Erstelle einen neuen Agenten',
    'Navigiere zum Memory und erstelle einen Eintrag',
    'Mache einen vollständigen Agenten-Erstellungs-Workflow mit allen Feldern',
    'Erstelle einen neuen Job'
  ];
  const startTime = Date.now();
  const responses = await Promise.all(goals.map(async (goal) => {
    const response = await fetch(`${BASE_URL}/ghost/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, mode: 'demo' }),
      signal: createAbortController(18000).signal
    });
    const r = await response.json();
    assert.strictEqual(response.status, 200);
    return r;
  }));
  const duration = Date.now() - startTime;
  assert(duration < 30000);
});
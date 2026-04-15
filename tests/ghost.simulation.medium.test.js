// ghost.simulation.medium.test.js
const test = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');

const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test('Demo-Modus — Agenten erstellen', async (t) => {
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: "Zeige mir wie ich einen neuen KI-Agenten für E-Mail-Analyse erstelle",
      mode: "demo"
    })
  });

  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.ok(Array.isArray(data.plan?.steps) && data.plan.steps.length >= 1 || data.needsClarification);
  assert.strictEqual(typeof data.needsClarification, 'boolean');
  if (data.plan) {
    assert.strictEqual(typeof data.plan.id, 'string');
    assert.ok(Array.isArray(data.plan.steps));
  }
}, 15000);

test('Build-Modus — Job erstellen', async (t) => {
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: "Erstelle einen täglichen Job der um 08:00 Uhr einen Bericht generiert",
      mode: "build"
    })
  });

  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data.needsClarification, 'boolean');
  if (data.plan) {
    assert.strictEqual(typeof data.plan.id, 'string');
    assert.ok(Array.isArray(data.plan.steps));
  }
}, 15000);

test('Navigation-Intent', async (t) => {
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: "Navigiere zur Memory-Seite",
      mode: "demo"
    })
  });

  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data.needsClarification, 'boolean');
  if (data.plan) {
    assert.strictEqual(typeof data.plan.id, 'string');
    assert.ok(Array.isArray(data.plan.steps));
    assert.strictEqual(data.plan.steps[0].type, 'navigate' || 'spotlight');
  }
}, 15000);

test('Komplexerer Workflow', async (t) => {
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: "Erstelle einen Agenten und verbinde ihn mit einem Webhook-Trigger",
      mode: "demo"
    })
  });

  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data.needsClarification, 'boolean');
  if (data.plan) {
    assert.strictEqual(typeof data.plan.id, 'string');
    assert.ok(Array.isArray(data.plan.steps));
  }
}, 15000);

test('Mode explizit build', async (t) => {
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: "Speichere einen neuen Provider mit OpenAI Key",
      mode: "build"
    })
  });

  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data.needsClarification, 'boolean');
  if (data.plan) {
    assert.strictEqual(typeof data.plan.id, 'string');
    assert.ok(Array.isArray(data.plan.steps));
  }
}, 15000);

test('Antwort-Struktur-Validierung', async (t) => {
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: "Öffne die Governance-Seite",
      mode: "demo"
    })
  });

  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data.needsClarification, 'boolean');
  if (data.needsClarification) {
    assert.strictEqual(typeof data.question, 'string');
  } else {
    assert.strictEqual(typeof data.plan.id, 'string');
    assert.ok(Array.isArray(data.plan.steps));
  }
}, 15000);
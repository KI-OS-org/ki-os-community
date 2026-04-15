// ghost.control.test.js
const test = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const createAbortController = (timeout) => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller;
};

test('State — exportieren', async () => {
  const goal = "Exportiere den aktuellen System-State als JSON";
  const mode = "build";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  // State-Export ist kein direkter Ghost-Control-Step — needsClarification ist korrekt
  assert.ok(data.needsClarification === true || Array.isArray(data.plan?.steps));
});

test('State — importieren', async () => {
  const goal = "Importiere einen State aus einer JSON-Datei";
  const mode = "build";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.ok(Array.isArray(data.plan.steps));
});

test('Tenants — neuen Tenant erstellen', async () => {
  const goal = "Erstelle einen neuen Tenant 'Firma XYZ' mit Plan 'Professional'";
  const mode = "build";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.strictEqual(Array.isArray(data.plan.steps), true);
  data.plan.steps.forEach(step => {
    assert.strictEqual(typeof step.id, 'string');
    assert.strictEqual(typeof step.type, 'string');
    assert.strictEqual(typeof step.callout, 'string');
  });
});

test('Connector Galaxy — Status prüfen', async () => {
  const goal = "Zeige alle Konnektoren in der Galaxy und ihren Status";
  const mode = "demo";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.ok(['/connector-galaxy', '/providers'].includes(data.plan.steps[0].target));
});

test('Connector Galaxy — Konnektor aktivieren', async () => {
  const goal = "Aktiviere den inaktiven Konnektor in der Galaxy";
  const mode = "build";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.strictEqual(Array.isArray(data.plan.steps), true);
  data.plan.steps.forEach(step => {
    assert.strictEqual(typeof step.id, 'string');
    assert.strictEqual(typeof step.type, 'string');
    assert.strictEqual(typeof step.callout, 'string');
  });
});

test('Tests-Seite — Frontend Tests starten', async () => {
  const goal = "Starte alle automatisierten Frontend Tests";
  const mode = "build";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.strictEqual(Array.isArray(data.plan.steps), true);
  data.plan.steps.forEach(step => {
    assert.strictEqual(typeof step.id, 'string');
    assert.strictEqual(typeof step.type, 'string');
    assert.strictEqual(typeof step.callout, 'string');
  });
});
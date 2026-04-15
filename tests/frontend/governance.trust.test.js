// ghost.control.test.js
const test = require('node:test');
const assert = require('assert');
const fetch = require('node-fetch');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test('Control Plane — System-Health prüfen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Zeige mir den Gesundheitsstatus des Systems", mode: "demo" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(data.needsClarification, false);
  assert.strictEqual(data.plan.steps[0].type, 'navigate');
  assert.ok(['/control', '/workspace', '/supervisor', '/repair'].includes(data.plan.steps[0].target));
});

test('Trust — Audit-Log anzeigen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Zeige das Audit-Log der letzten 24 Stunden", mode: "demo" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(data.needsClarification, false);
});

test('Trust — Genehmigung erteilen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Genehmige die erste ausstehende Anfrage im Trust Center", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(data.needsClarification, false);
  assert.ok(['navigate', 'spotlight', 'click', 'confirm'].includes(data.plan.steps[0].type));
});

test('Trust — Genehmigung ablehnen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Lehne die ausstehende Anfrage ab", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(data.needsClarification, false);
  assert.ok(['navigate', 'spotlight', 'click', 'confirm'].includes(data.plan.steps[0].type));
});

test('Privacy — PII erkennen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Erkenne PII-Daten im Text 'Max Mustermann, max@test.de, Tel: 0123456789'", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(data.needsClarification, false);
  assert.ok(Array.isArray(data.plan.steps) && data.plan.steps.length > 0);
});

test('Supervisor — Eskalation anzeigen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Zeige alle offenen Eskalationen im Supervisor", mode: "demo" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(data.needsClarification, false);
  assert.strictEqual(data.plan.steps[0].type, 'navigate');
  assert.strictEqual(data.plan.steps[0].target, '/supervisor');
});
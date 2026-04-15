// ghost.control.test.js
const test = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test('AgentMesh — Task starten', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Starte einen neuen Multi-Agent Task mit dem Ziel 'Analysiere den Markt für KI-Tools'", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert(data.plan);
  assert(Array.isArray(data.plan.steps));
  data.plan.steps.forEach(step => {
    assert(step.id);
    assert(step.type);
    assert(step.callout);
  });
});

test('AgentMesh — laufende Tasks anzeigen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Zeige alle laufenden AgentMesh Tasks", mode: "demo" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert(data.plan);
});

test('Runs — letzten Run anzeigen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Zeige mir den letzten Agent-Run mit allen Details", mode: "demo" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert(data.plan);
  assert(data.plan.steps);
  assert(data.plan.steps.some(step => step.target && (step.target.includes('/runs') || step.target.includes('/jobs'))));
});

test('Runs — Run stoppen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Stoppe den laufenden Run", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert(data.plan);
});

test('Runs — Run-Trace anzeigen', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Zeige den Execution-Trace des letzten Runs", mode: "demo" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert(data.plan);
});

test('AgentMesh — Ergebnis exportieren', async () => {
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Exportiere das Ergebnis des letzten AgentMesh-Tasks als JSON", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert(data.plan);
});
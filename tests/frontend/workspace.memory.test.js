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

test('Workspace — Datei hochladen', async () => {
  const goal = "Lade eine Datei im Workspace hoch";
  const mode = "build";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.ok(data.needsClarification || (data.plan && Array.isArray(data.plan.steps)));
});

test('Memory — Eintrag suchen', async () => {
  const goal = "Suche im Memory nach Einträgen über Agenten";
  const mode = "demo";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
});

test('Memory — neuen Eintrag erstellen', async () => {
  const goal = "Erstelle einen neuen Memory-Eintrag mit Text 'Wichtige Information'";
  const mode = "build";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
});

test('Files — Datei suchen', async () => {
  const goal = "Suche die Datei report.pdf in Files";
  const mode = "demo";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
});

test('Documents — PDF verarbeiten', async () => {
  const goal = "Lade ein PDF hoch und extrahiere den Text";
  const mode = "build";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
});

test('Workspace UX — was sieht ein neuer Nutzer?', async () => {
  const goal = "Zeige mir den Workspace Überblick";
  const mode = "demo";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal: createAbortController(18000).signal
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.ok(data.plan && Array.isArray(data.plan.steps));
});
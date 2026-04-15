// ghost.control.test.js
const test = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const createFetchWithTimeout = (url, options, timeout = 18000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
};

test('Provider hinzufügen', async (t) => {
  const response = await createFetchWithTimeout(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Füge einen neuen OpenAI Provider mit API Key hinzu", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.strictEqual(Array.isArray(data.plan.steps), true);
  assert.strictEqual(Array.isArray(data.plan.steps), true);
});

test('Provider health check', async (t) => {
  const response = await createFetchWithTimeout(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Prüfe ob alle Provider gesund sind", mode: "demo" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.ok(Array.isArray(data.plan.steps));
});

test('Integration hinzufügen', async (t) => {
  const response = await createFetchWithTimeout(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Verbinde eine neue Slack Integration", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.ok(Array.isArray(data.plan.steps));
});

test('Webhook erstellen', async (t) => {
  const response = await createFetchWithTimeout(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Erstelle einen neuen Webhook für neue Agent-Runs", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.strictEqual(Array.isArray(data.plan.steps), true);
  assert.strictEqual(Array.isArray(data.plan.steps), true);
});

test('Webhook testen', async (t) => {
  const response = await createFetchWithTimeout(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Teste den Webhook 'Agent Run Notifications'", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.ok(Array.isArray(data.plan.steps));
});

test('MCP Capability aufrufen', async (t) => {
  const response = await createFetchWithTimeout(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "Rufe die MCP Capability 'file-read' auf", mode: "build" })
  });

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(data.needsClarification, false);
  assert.strictEqual(Array.isArray(data.plan.steps), true);
  assert.strictEqual(data.plan.steps.some(step => step.callout.includes('file-read')), true);
});
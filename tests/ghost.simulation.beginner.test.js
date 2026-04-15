// tests/ghost.simulation.beginner.test.js
const test = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');

const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test('Leere Eingabe', async (t) => {
  // Einsteiger versucht eine leere Anfrage zu senden
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "" })
  });

  assert.strictEqual(response.status, 400);
  const json = await response.json();
  assert.strictEqual(json.error, 'goal is required');
}, 15000);

test('Sehr kurze Eingabe', async (t) => {
  // Einsteiger sendet eine sehr kurze Anfrage
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "hi" })
  });

  assert.strictEqual(response.status, 200);
  const json = await response.json();
  assert.strictEqual(typeof json, 'object');
  assert.ok('needsClarification' in json || 'plan' in json);
}, 15000);

test('Deutsche Alltagssprache', async (t) => {
  // Einsteiger sendet eine Anfrage in deutscher Alltagssprache
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "ich möchte einen agenten erstellen" })
  });

  assert.strictEqual(response.status, 200);
  const json = await response.json();
  assert.strictEqual(typeof json, 'object');
  assert.ok('needsClarification' in json);
  assert.strictEqual(typeof json.needsClarification, 'boolean');
}, 15000);

test('Englische Eingabe', async (t) => {
  // Einsteiger sendet eine Anfrage in englischer Sprache
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "create agent" })
  });

  assert.strictEqual(response.status, 200);
  const json = await response.json();
  assert.strictEqual(typeof json, 'object');
  assert.ok('needsClarification' in json);
  assert.strictEqual(typeof json.needsClarification, 'boolean');
}, 15000);

test('Zu langer Text', async (t) => {
  // Einsteiger sendet einen zu langen Text
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "A".repeat(501) })
  });

  assert.strictEqual(response.status, 400);
  const json = await response.json();
  assert.strictEqual(typeof json, 'object');
  assert.ok('error' in json);
}, 15000);

test('Ungültiger mode', async (t) => {
  // Einsteiger sendet eine Anfrage mit einem ungültigen mode
  const response = await fetch(`${TEST_BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: "neuen Job erstellen", mode: "falsch" })
  });

  assert.strictEqual(response.status, 400);
  const json = await response.json();
  assert.strictEqual(typeof json, 'object');
  assert.ok('error' in json);
}, 15000);
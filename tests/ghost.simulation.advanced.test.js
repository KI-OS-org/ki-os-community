// ghost.simulation.advanced.test.js
const test = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test('Sonderzeichen im goal', async () => {
  const goal = "Erstelle Agent mit Name 'Müller & Söhne KI' für <email@domain.de>";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal })
  });

  assert.strictEqual(response.status, 200, 'HTTP 200 expected');
  const data = await response.json();
  assert.ok(data, 'Response should be valid JSON');
});

test('Multi-Step Workflow', async () => {
  const goal = "Erstelle einen Flow: Agent A analysiert E-Mail → Agent B kategorisiert → Agent C antwortet automatisch";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode: 'build' })
  });

  assert.strictEqual(response.status, 200, 'HTTP 200 expected');
  const data = await response.json();
  assert.ok(data.plan && data.plan.steps.length >= 3, 'Plan should have at least 3 steps');
});

test('Technischer Prompt mit Code', async () => {
  const goal = "Erstelle einen Agenten mit system prompt: 'Du bist ein JSON-Validator. Input: {data: string}. Output: {valid: boolean, errors: string[]}'";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode: 'build' })
  });

  assert.strictEqual(response.status, 200, 'HTTP 200 expected');
  const data = await response.json();
  assert.ok(data, 'Response should be valid JSON');
});

test('Parallele Requests (3 gleichzeitig)', async () => {
  const goals = [
    "Erstelle Agent für E-Mail-Verarbeitung",
    "Erstelle Agent für Datenanalyse",
    "Erstelle Agent für Text-Summarization"
  ];

  const responses = await Promise.all(goals.map(goal => fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal })
  })));

  for (const response of responses) {
    assert.strictEqual(response.status, 200, 'HTTP 200 expected');
    const data = await response.json();
    assert.ok(data, 'Response should be valid JSON');
  }
});

test('Response-Zeit unter 10 Sekunden', async () => {
  const goal = "Zeige Supervisor-Dashboard";
  const startTime = Date.now();
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode: 'demo' })
  });
  const endTime = Date.now();
  const responseTime = endTime - startTime;

  assert.strictEqual(response.status, 200, 'HTTP 200 expected');
  assert.ok(responseTime < 10000, 'Response time should be less than 10 seconds');
  const data = await response.json();
  assert.ok(data, 'Response should be valid JSON');
});

test('Vollständige Schema-Validierung bei needsClarification: false', async () => {
  const goal = "Erstelle neuen Agenten für Datenanalyse";
  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode: 'demo' })
  });

  assert.strictEqual(response.status, 200, 'HTTP 200 expected');
  const data = await response.json();
  assert.ok(data.plan, 'Plan should be present');

  const plan = data.plan;
  assert.ok(typeof plan.id === 'string', 'plan.id should be a string');
  assert.ok(['demo', 'build'].includes(plan.mode), 'plan.mode should be either "demo" or "build"');
  assert.ok(typeof plan.title === 'string', 'plan.title should be a string');
  assert.ok(typeof plan.description === 'string', 'plan.description should be a string');
  assert.ok(Array.isArray(plan.steps), 'plan.steps should be an array');

  for (const step of plan.steps) {
    assert.ok(typeof step.id === 'string', 'Each step should have a string id');
    assert.ok(typeof step.type === 'string', 'Each step should have a string type');
    assert.ok(typeof step.callout === 'string', 'Each step should have a string callout');
  }
});
/**
 * @file    agents.crud.test.js
 * @desc    Ghost Control Agent CRUD Simulation — create, edit, toggle, delete
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only
 */
const test = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const ghostPlan = async (goal, mode = 'demo', timeout = 18000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE_URL}/ghost/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, mode }),
      signal: controller.signal
    });
    return { status: res.status, data: await res.json() };
  } finally {
    clearTimeout(id);
  }
};

function assertValidResponse(data) {
  assert.ok(typeof data === 'object', 'response must be object');
  assert.ok('needsClarification' in data, 'must have needsClarification');
  assert.strictEqual(typeof data.needsClarification, 'boolean');
  if (!data.needsClarification) {
    assert.ok(data.plan, 'plan must exist when needsClarification=false');
    assert.ok(typeof data.plan.id === 'string', 'plan.id must be string');
    assert.ok(Array.isArray(data.plan.steps), 'plan.steps must be array');
    assert.ok(data.plan.steps.length >= 1, 'plan must have at least 1 step');
    data.plan.steps.forEach((step, i) => {
      assert.ok(typeof step.id === 'string', `step[${i}].id must be string`);
      assert.ok(typeof step.type === 'string', `step[${i}].type must be string`);
      assert.ok(typeof step.callout === 'string', `step[${i}].callout must be string`);
      assert.ok(step.callout.length > 0, `step[${i}].callout must not be empty`);
    });
  }
}

test('Neuen Agenten erstellen (vollständiger Workflow)', async () => {
  const { status, data } = await ghostPlan(
    "Erstelle einen neuen Agenten namens 'Test-Agent' mit Kategorie 'General' und Prompt 'Du bist ein Assistent'",
    'build'
  );
  assert.strictEqual(status, 200);
  assertValidResponse(data);
  if (!data.needsClarification) {
    // Workflow muss mindestens fill- und click-Schritte enthalten
    const types = data.plan.steps.map(s => s.type);
    assert.ok(
      types.includes('fill') || types.includes('click'),
      `Workflow steps sollten fill/click enthalten, got: ${types.join(',')}`
    );
    // Muss data-ghost='agent-name' oder 'agent-save' adressieren
    const targets = data.plan.steps.map(s => s.target || '').join(' ');
    assert.ok(
      targets.includes('agent-name') || targets.includes('agent-save') || targets.includes('/agents'),
      `Steps sollten agent-Selektoren adressieren, targets: ${targets}`
    );
  }
});

test('Agenten bearbeiten', async () => {
  const { status, data } = await ghostPlan('Bearbeite den ersten Agenten in der Liste', 'build');
  assert.strictEqual(status, 200);
  assertValidResponse(data);
  if (!data.needsClarification) {
    const targets = data.plan.steps.map(s => s.target || '').join(' ');
    assert.ok(
      targets.includes('agent') || targets.includes('/agents'),
      `Edit-Workflow sollte agent-Selektoren nutzen, targets: ${targets}`
    );
  }
});

test('Agenten aktivieren/deaktivieren', async () => {
  const { status, data } = await ghostPlan('Aktiviere den ersten Agenten in der Liste', 'build');
  assert.strictEqual(status, 200);
  assertValidResponse(data);
});

test('Agenten löschen', async () => {
  const { status, data } = await ghostPlan("Lösche den Agenten 'Test-Agent'", 'build');
  assert.strictEqual(status, 200);
  assertValidResponse(data);
});

test('Eingabe-Validierung — leerer Name', async () => {
  const { status, data } = await ghostPlan('Erstelle einen Agenten ohne Name', 'build');
  assert.strictEqual(status, 200);
  assert.ok(data.plan || data.needsClarification, 'must return plan or needsClarification');
});

test('Zu langer Prompt', async () => {
  const { status, data } = await ghostPlan(
    'Erstelle Agenten mit System Prompt von 10000 Zeichen',
    'build'
  );
  assert.strictEqual(status, 200);
  assert.ok(data.plan || data.needsClarification, 'must return plan or needsClarification');
});

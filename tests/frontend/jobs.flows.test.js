/**
 * @file    jobs.flows.test.js
 * @desc    Ghost Control Jobs & Flows Simulation — create, run, execute
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

function assertValidPlan(data, context) {
  assert.ok(data.plan, `plan muss vorhanden sein: ${context}`);
  assert.ok(Array.isArray(data.plan.steps), `plan.steps muss Array sein: ${context}`);
  assert.ok(data.plan.steps.length >= 1, `plan muss ≥1 Step haben: ${context}`);
  data.plan.steps.forEach((step, i) => {
    assert.ok(typeof step.id === 'string', `step[${i}].id: ${context}`);
    assert.ok(typeof step.type === 'string', `step[${i}].type: ${context}`);
    assert.ok(typeof step.callout === 'string', `step[${i}].callout: ${context}`);
  });
}

test('Neuen Job erstellen', async () => {
  const { status, data } = await ghostPlan(
    "Erstelle einen täglichen Job 'Täglicher Bericht' um 08:00 Uhr mit dem ersten verfügbaren Agenten",
    'build'
  );
  assert.strictEqual(status, 200);
  assert.ok(data.plan || data.needsClarification);
  if (!data.needsClarification) {
    assertValidPlan(data, 'Job erstellen');
    // Muss job-bezogene Selektoren oder /jobs Route adressieren
    const allTargets = data.plan.steps.map(s => s.target || '').join(' ');
    assert.ok(
      allTargets.includes('job') || allTargets.includes('/jobs'),
      `Steps sollten job-Selektoren nutzen, targets: ${allTargets}`
    );
  }
});

test('Job sofort ausführen', async () => {
  const { status, data } = await ghostPlan("Führe den Job 'Täglicher Bericht' sofort aus", 'build');
  assert.strictEqual(status, 200);
  assert.ok(data.plan || data.needsClarification);
  if (!data.needsClarification) {
    assertValidPlan(data, 'Job ausführen');
    const allTargets = data.plan.steps.map(s => s.target || '').join(' ');
    assert.ok(
      allTargets.includes('job') || allTargets.includes('/jobs'),
      `Steps sollten job-Selektoren nutzen`
    );
  }
});

test('Job ohne Zeitplan', async () => {
  const { status, data } = await ghostPlan('Erstelle Job ohne Zeitplan nur mit Name', 'build');
  assert.strictEqual(status, 200);
  assert.ok(typeof data === 'object');
  assert.ok('needsClarification' in data || 'plan' in data);
});

test('Flows — neuen Flow erstellen', async () => {
  const { status, data } = await ghostPlan("Erstelle einen neuen Flow namens 'E-Mail Pipeline'", 'build');
  assert.strictEqual(status, 200);
  assert.ok(data.plan || data.needsClarification);
  if (!data.needsClarification) {
    assertValidPlan(data, 'Flow erstellen');
    const allTargets = data.plan.steps.map(s => s.target || '').join(' ');
    assert.ok(
      allTargets.includes('flow') || allTargets.includes('/flows'),
      `Steps sollten flow-Selektoren nutzen, targets: ${allTargets}`
    );
  }
});

test('Flow ausführen', async () => {
  const { status, data } = await ghostPlan("Führe den Flow 'E-Mail Pipeline' aus", 'build');
  assert.strictEqual(status, 200);
  assert.ok(data.plan || data.needsClarification);
  if (!data.needsClarification) {
    assertValidPlan(data, 'Flow ausführen');
    const allTargets = data.plan.steps.map(s => s.target || '').join(' ');
    assert.ok(
      allTargets.includes('flow') || allTargets.includes('/flows'),
      `Steps sollten flow-Selektoren nutzen`
    );
  }
});

test('UX-Check — was zeigt die Flows-Seite dem User?', async () => {
  const { status, data } = await ghostPlan('Zeige mir alle vorhandenen Flows', 'demo');
  assert.strictEqual(status, 200);
  assert.ok(typeof data === 'object');
  if (data.needsClarification) {
    assert.strictEqual(data.needsClarification, true);
    assert.ok(typeof data.question === 'string');
  } else {
    assert.ok(Array.isArray(data.plan.steps));
  }
});

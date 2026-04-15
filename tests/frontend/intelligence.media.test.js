// ghost.control.test.js
const test = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const createPlan = async (goal, mode) => {
  const controller = new AbortController();
  const signal = controller.signal;
  setTimeout(() => controller.abort(), 18000);

  const response = await fetch(`${BASE_URL}/ghost/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, mode }),
    signal
  });

  return response;
};

test('Campaign erstellen', async () => {
  const response = await createPlan("Erstelle eine neue Social-Media Campaign für KI-OS mit 5 Posts", "build");
  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(Array.isArray(data.plan.steps), true);
  data.plan.steps.forEach(step => {
    assert.strictEqual(typeof step.id, 'string');
    assert.strictEqual(typeof step.type, 'string');
    assert.strictEqual(typeof step.callout, 'string');
  });
});

test('Economic — Profil anzeigen', async () => {
  const response = await createPlan("Zeige das aktuelle wirtschaftliche Profil und die Scorecards", "demo");
  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data, 'object');
});

test('Efficiency — Wettbewerber-Analyse starten', async () => {
  const response = await createPlan("Starte eine Wettbewerber-Analyse für KI-OS", "build");
  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(Array.isArray(data.plan.steps), true);
  data.plan.steps.forEach(step => {
    assert.strictEqual(typeof step.id, 'string');
    assert.strictEqual(typeof step.type, 'string');
    assert.strictEqual(typeof step.callout, 'string');
  });
});

test('Media Studio — Bild generieren', async () => {
  const response = await createPlan("Generiere ein Bild mit dem Prompt 'KI-Roboter im Büro'", "build");
  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data, 'object');
  assert.strictEqual(Array.isArray(data.plan.steps), true);
  data.plan.steps.forEach(step => {
    assert.strictEqual(typeof step.id, 'string');
    assert.strictEqual(typeof step.type, 'string');
    assert.strictEqual(typeof step.callout, 'string');
  });
});

test('Media Studio — Video-Synthese', async () => {
  const response = await createPlan("Erstelle ein kurzes Erklärvideo für KI-OS", "build");
  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data, 'object');
  // Video-Synthese ist kein direkter Ghost-Control-Step — needsClarification akzeptieren
  assert.ok(data.needsClarification === true || Array.isArray(data.plan?.steps));
  if (data.plan?.steps) {
    data.plan.steps.forEach(step => {
      assert.strictEqual(typeof step.id, 'string');
      assert.strictEqual(typeof step.type, 'string');
      assert.strictEqual(typeof step.callout, 'string');
    });
  }
});

test('Notifications — alle anzeigen', async () => {
  const response = await createPlan("Zeige alle Benachrichtigungen der letzten Woche", "demo");
  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data, 'object');
});
/**
 * Tests: Ghost Control Vision Phase 2 — Re-Planning on Vision-Fail
 * Runner: node --test tests/ghost.vision-phase2.test.js
 *
 * Prüft die replanOnVisionFail() Funktion + handleGhostRequest /ghost/replan
 * ohne LLM-Calls (kein API-Key nötig) da keine OPENROUTER_API_KEY / ANTHROPIC_API_KEY
 * gesetzt — die Funktion fällt auf needsClarification-Fallback zurück.
 *
 * ENT-6: Vision Phase 2 — Re-Planning on Vision-Fail, max 2 Versuche.
 */

'use strict';

const { test, describe } = require('node:test');
const assert             = require('node:assert/strict');

const { replanOnVisionFail, MAX_REPLAN_ATTEMPTS } = require('../backend/services/ghost/ghost.plan.service');
const { handleGhostRequest }                      = require('../backend/services/ghost/ghost.plan.controller');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SAMPLE_PLAN = {
  id:        'test-plan-01',
  mode:      'demo',
  title:     'Agent anlegen',
  sessionId: 'sess-test-01',
  steps: [
    { id: 'step-1', type: 'navigate',  target: '/agents',                        callout: 'Navigiere zu Agents' },
    { id: 'step-2', type: 'spotlight', target: '[data-ghost="new-agent-btn"]',   callout: 'Hier der Button' },
    { id: 'step-3', type: 'click',     target: '[data-ghost="new-agent-btn"]',   callout: 'Button klicken' },
    { id: 'step-4', type: 'fill',      target: '[data-ghost="agent-name"]',      callout: 'Name eintragen', value: 'Test-Agent' },
  ],
};

const VISION_FAIL = {
  verified:    false,
  confidence:  0.12,
  description: 'Der Button "Neuer Agent" ist nicht sichtbar. Die Seite zeigt eine leere Agentenliste.',
  hint:        'Vielleicht muss die Seite zuerst neu geladen werden.',
};

// ─── 1. MAX_REPLAN_ATTEMPTS ──────────────────────────────────────────────────
describe('MAX_REPLAN_ATTEMPTS', () => {
  test('ist auf 2 gesetzt (ENT-6 Spec)', () => {
    assert.equal(MAX_REPLAN_ATTEMPTS, 2, 'ENT-6 schreibt max 2 Versuche vor');
  });

  test('ist eine positive ganze Zahl', () => {
    assert.ok(Number.isInteger(MAX_REPLAN_ATTEMPTS) && MAX_REPLAN_ATTEMPTS > 0);
  });
});

// ─── 2. Retry-Limit-Enforcement ──────────────────────────────────────────────
describe('replanOnVisionFail — Retry Limit', () => {
  test('retryCount >= MAX_REPLAN_ATTEMPTS → needsClarification ohne LLM-Call', async () => {
    const result = await replanOnVisionFail({
      goal:            'Agents zeigen',
      mode:            'demo',
      originalPlan:    SAMPLE_PLAN,
      failedStepIndex: 2,
      visionResult:    VISION_FAIL,
      retryCount:      MAX_REPLAN_ATTEMPTS, // limit already reached
    });

    assert.equal(result.needsClarification, true, 'Muss needsClarification=true sein');
    assert.ok(typeof result.question === 'string', 'Frage muss vorhanden sein');
    assert.ok(result.question.length > 10,         'Frage muss aussagekräftig sein');
    assert.equal(result.retryCount,   MAX_REPLAN_ATTEMPTS);
    assert.equal(result.maxRetries,   MAX_REPLAN_ATTEMPTS);
  });

  test('retryCount > MAX_REPLAN_ATTEMPTS → ebenfalls geblockt', async () => {
    const result = await replanOnVisionFail({
      goal:            'Agents zeigen',
      mode:            'demo',
      originalPlan:    SAMPLE_PLAN,
      failedStepIndex: 0,
      visionResult:    VISION_FAIL,
      retryCount:      99,
    });

    assert.equal(result.needsClarification, true);
    assert.ok(result.question.length > 0);
  });
});

// ─── 3. Input-Validierung ─────────────────────────────────────────────────────
describe('replanOnVisionFail — Input-Validierung', () => {
  test('fehlendes goal → throw', async () => {
    await assert.rejects(
      () => replanOnVisionFail({ goal: '', originalPlan: SAMPLE_PLAN, failedStepIndex: 0, visionResult: VISION_FAIL }),
      /goal ist erforderlich/
    );
  });

  test('fehlendes originalPlan.steps → throw', async () => {
    await assert.rejects(
      () => replanOnVisionFail({ goal: 'Test', originalPlan: { id: 'x' }, failedStepIndex: 0, visionResult: VISION_FAIL }),
      /steps fehlt/
    );
  });

  test('negativer failedStepIndex → throw', async () => {
    await assert.rejects(
      () => replanOnVisionFail({ goal: 'Test', originalPlan: SAMPLE_PLAN, failedStepIndex: -1, visionResult: VISION_FAIL }),
      /failedStepIndex/
    );
  });
});

// ─── 4. Fallback ohne LLM-Key ────────────────────────────────────────────────
describe('replanOnVisionFail — Fallback ohne LLM-Provider', () => {
  const origAnthropic   = process.env.ANTHROPIC_API_KEY;
  const origOpenrouter  = process.env.OPENROUTER_API_KEY;
  const origOpenAI      = process.env.OPENAI_API_KEY;

  // Keys entfernen damit der LLM-Call fehlschlägt → needsClarification Fallback
  test.before(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });
  test.after(() => {
    if (origAnthropic)  process.env.ANTHROPIC_API_KEY  = origAnthropic;
    if (origOpenrouter) process.env.OPENROUTER_API_KEY = origOpenrouter;
    if (origOpenAI)     process.env.OPENAI_API_KEY     = origOpenAI;
  });

  test('ohne API-Key → needsClarification Fallback (kein Crash)', async () => {
    const result = await replanOnVisionFail({
      goal:            'Agents zeigen',
      mode:            'demo',
      originalPlan:    SAMPLE_PLAN,
      failedStepIndex: 1,
      visionResult:    VISION_FAIL,
      retryCount:      0,
    });

    // Entweder wurde re-planned (wenn mock verfügbar) oder needsClarification Fallback
    assert.ok(typeof result.needsClarification === 'boolean', 'needsClarification muss boolean sein');
    assert.ok(typeof result.retryCount === 'number',          'retryCount muss number sein');
    assert.ok(typeof result.maxRetries === 'number',          'maxRetries muss number sein');
    assert.equal(result.maxRetries, MAX_REPLAN_ATTEMPTS,      'maxRetries muss MAX_REPLAN_ATTEMPTS entsprechen');

    if (result.needsClarification) {
      assert.ok(typeof result.question === 'string' && result.question.length > 0, 'Frage muss vorhanden sein');
    } else {
      assert.ok(result.plan && typeof result.plan === 'object', 'Plan muss vorhanden sein wenn needsClarification=false');
    }
  });

  test('retryCount wird korrekt hochgezählt (0 → 1)', async () => {
    const result = await replanOnVisionFail({
      goal:            'Test',
      mode:            'demo',
      originalPlan:    SAMPLE_PLAN,
      failedStepIndex: 0,
      visionResult:    VISION_FAIL,
      retryCount:      0,
    });

    assert.equal(result.retryCount, 1, 'retryCount muss von 0 auf 1 steigen');
  });
});

// ─── 5. Controller: POST /ghost/replan ────────────────────────────────────────
describe('handleGhostRequest /ghost/replan', () => {
  test('405 bei GET', async () => {
    const r = await handleGhostRequest('/ghost/replan', 'GET', {});
    assert.equal(r.statusCode, 405);
  });

  test('400 bei fehlendem goal', async () => {
    const r = await handleGhostRequest('/ghost/replan', 'POST', {
      originalPlan: SAMPLE_PLAN, failedStepIndex: 0, visionResult: VISION_FAIL,
    });
    assert.equal(r.statusCode, 400);
    assert.ok(r.body?.error?.includes('goal'));
  });

  test('400 bei fehlendem originalPlan', async () => {
    const r = await handleGhostRequest('/ghost/replan', 'POST', {
      goal: 'Test', failedStepIndex: 0, visionResult: VISION_FAIL,
    });
    assert.equal(r.statusCode, 400);
  });

  test('400 bei ungültigem failedStepIndex (-1)', async () => {
    const r = await handleGhostRequest('/ghost/replan', 'POST', {
      goal: 'Test', originalPlan: SAMPLE_PLAN, failedStepIndex: -1, visionResult: VISION_FAIL,
    });
    assert.equal(r.statusCode, 400);
  });

  test('400 wenn visionResult.verified=true (kein Fail)', async () => {
    const r = await handleGhostRequest('/ghost/replan', 'POST', {
      goal:            'Test',
      originalPlan:    SAMPLE_PLAN,
      failedStepIndex: 0,
      visionResult:    { verified: true, confidence: 0.95, description: 'Alles ok' },
    });
    assert.equal(r.statusCode, 400);
    assert.ok(r.body?.error?.includes('verified'));
  });

  test('200 bei gültigem Request (Fallback ohne LLM-Key → needsClarification)', async () => {
    const r = await handleGhostRequest('/ghost/replan', 'POST', {
      goal:            'Neuen Agent anlegen',
      mode:            'demo',
      originalPlan:    SAMPLE_PLAN,
      failedStepIndex: 2,
      visionResult:    VISION_FAIL,
      retryCount:      0,
    });

    assert.equal(r.statusCode, 200, `Erwarte 200, bekommen: ${r.statusCode}`);
    assert.ok(typeof r.body?.needsClarification === 'boolean');
    assert.ok(typeof r.body?.retryCount         === 'number');
    assert.ok(typeof r.body?.maxRetries         === 'number');
  });

  test('200 bei retryCount >= MAX → limitierender Fallback', async () => {
    const r = await handleGhostRequest('/ghost/replan', 'POST', {
      goal:            'Test',
      mode:            'demo',
      originalPlan:    SAMPLE_PLAN,
      failedStepIndex: 0,
      visionResult:    VISION_FAIL,
      retryCount:      MAX_REPLAN_ATTEMPTS,
    });

    assert.equal(r.statusCode, 200);
    assert.equal(r.body?.needsClarification, true, 'Limit erreicht → needsClarification');
    assert.ok(r.body?.question?.length > 0, 'Nutzergerechte Erklärung muss vorhanden sein');
  });

  test('404 für unbekannte Ghost-Route', async () => {
    const r = await handleGhostRequest('/ghost/unknown', 'POST', {});
    assert.equal(r.statusCode, 404);
  });
});

// ─── 6. Controller-Routing: alle 3 Ghost-Endpunkte ───────────────────────────
describe('handleGhostRequest — Route-Dispatch', () => {
  test('/ghost/plan → 400 ohne goal', async () => {
    const r = await handleGhostRequest('/ghost/plan', 'POST', {});
    assert.equal(r.statusCode, 400);
  });

  test('/ghost/verify → 400 ohne imageData', async () => {
    const r = await handleGhostRequest('/ghost/verify', 'POST', { stepDescription: 'Test' });
    assert.equal(r.statusCode, 400);
  });

  test('/ghost/replan → 400 ohne goal', async () => {
    const r = await handleGhostRequest('/ghost/replan', 'POST', {});
    assert.equal(r.statusCode, 400);
  });

  test('alle 3 Endpunkte antworten auf PUT mit 405', async () => {
    for (const p of ['/ghost/plan', '/ghost/verify', '/ghost/replan']) {
      const r = await handleGhostRequest(p, 'PUT', {});
      assert.equal(r.statusCode, 405, `${p} sollte 405 zurückgeben`);
    }
  });
});

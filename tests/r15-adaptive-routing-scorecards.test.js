/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-r15-'));
process.env.ROUTING_DECISION_LOG_PATH = path.join(tempDir, 'routing-decisions.json');
process.env.ROUTING_SCORECARD_PATH = path.join(tempDir, 'routing-scorecards.json');
process.env.MOCK_MODEL_CATALOG = 'true';
process.env.ADAPTIVE_ROUTING_ENABLED = 'true';
process.env.ADAPTIVE_ROUTING_WEIGHT = '0.15';
process.env.OUTCOME_ROUTING_ENABLED = 'true';
process.env.OUTCOME_ROUTING_WEIGHT = '0.05';

const { createApp } = require('../core/app');
const routing = require('../backend/services/routing/dynamic-routing.service');
const runtimeStore = require('../backend/services/ui/runtime.store');
const Observability = require('../backend/services/core/observability.service');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };

test.beforeEach(() => {
  Observability.reset();
  runtimeStore.resetStore();
  routing.resetRoutingDecisionLog();
  routing.resetRoutingScorecards();
});

test.after(() => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('R15 records adaptive routing scorecards and persists them', () => {
  const updated = routing.recordRouteOutcome({
    provider: 'openai',
    model: 'gpt-5.4',
    success: true,
    latencyMs: 820,
    trustScore: 91,
    outcomeCoverage: 1,
    runId: 'run-r15-1'
  });
  assert.equal(updated.provider, 'openai');
  assert.equal(updated.model, 'gpt-5.4');
  assert.equal(updated.totalRuns, 1);
  assert.ok(updated.score >= 0.8);

  const raw = JSON.parse(fs.readFileSync(process.env.ROUTING_SCORECARD_PATH, 'utf8'));
  assert.equal(raw.items[0].model, 'gpt-5.4');
});

test('R15 adaptive score influences candidate scoring', () => {
  routing.recordRouteOutcome({ provider: 'openai', model: 'gpt-5.4', success: true, latencyMs: 800, trustScore: 95, outcomeCoverage: 1 });
  routing.recordRouteOutcome({ provider: 'openai', model: 'gpt-5.4', success: true, latencyMs: 850, trustScore: 93, outcomeCoverage: 0.9 });

  const strong = routing.scoreCandidate({ provider: 'openai', model: 'gpt-5.4', cost_cpm: 2.5, p95_ms: 900, quality: 0.92, strengths: ['chat'] }, 'default', process.env, { coverage: 0.8 });
  const cold = routing.scoreCandidate({ provider: 'gemini', model: 'gemini-2.0-flash', cost_cpm: 0.1, p95_ms: 300, quality: 0.74, strengths: ['chat', 'fast'] }, 'default', process.env, { coverage: 0.1 });

  assert.ok(strong.adaptiveScore > 0.5);
  assert.ok(strong.finalScore > 0.6);
  assert.ok(cold.scorecard.totalRuns === 0);
});

test('R15 routing endpoints expose scorecards and explain payload', async () => {
  routing.recordRouteOutcome({ provider: 'openai', model: 'gpt-5.4', success: true, latencyMs: 760, trustScore: 92, outcomeCoverage: 1 });
  const app = createApp();

  const scorecards = await app.handleHttp({ runtime: 'test', path: '/routing/scorecards', method: 'GET', headers: adminHeaders });
  assert.equal(scorecards.statusCode, 200);
  assert.equal(scorecards.body.items[0].model, 'gpt-5.4');

  const decision = await app.handleHttp({ runtime: 'test', path: '/routing/resolve', method: 'POST', headers: adminHeaders, body: { query: 'Bitte analysiere Strategie', intent: 'reasoning' } });
  assert.equal(decision.statusCode, 200);
  assert.ok(Array.isArray(decision.body.decision.explain.reasons));
  assert.ok(typeof decision.body.decision.selected.adaptiveScore === 'number');
});

test('R15 ui routing scorecards endpoint exposes adaptive summary', async () => {
  routing.recordRouteOutcome({ provider: 'anthropic', model: 'claude-sonnet-4-6', success: false, latencyMs: 1800, trustScore: 40, outcomeCoverage: 0 });
  const app = createApp();
  const res = await app.handleHttp({ runtime: 'test', path: '/ui/routing/scorecards', method: 'GET', headers: adminHeaders });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.summary.adaptiveRoutingEnabled, true);
  assert.equal(res.body.items[0].provider, 'anthropic');
});

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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-r16-'));
process.env.ROUTING_SCORECARD_PATH = path.join(tempDir, 'routing-scorecards.json');
process.env.SUPERVISOR_ESCALATION_LOG_PATH = path.join(tempDir, 'supervisor-escalations.json');
process.env.SUPERVISOR_RECOVERY_LOG_PATH = path.join(tempDir, 'supervisor-recoveries.json');
process.env.MOCK_MODEL_CATALOG = 'true';
process.env.OUTCOME_ROUTING_ENABLED = 'true';
process.env.SUPERVISOR_LOW_OUTCOME_THRESHOLD = '0.5';

const { createApp } = require('../core/app');
const routing = require('../backend/services/routing/dynamic-routing.service');
const supervisor = require('../backend/services/supervisor/supervisor.service');
const runtimeStore = require('../backend/services/ui/runtime.store');
const Observability = require('../backend/services/core/observability.service');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };

test.beforeEach(() => {
  Observability.reset();
  runtimeStore.resetStore();
  routing.resetRoutingDecisionLog();
  routing.resetRoutingScorecards();
  supervisor.resetEscalations();
  supervisor.resetRecoveries();
});

test.after(() => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('R16 chooses scorecard-backed alternative model for provider failures', async () => {
  routing.recordRouteOutcome({ provider: 'anthropic', model: 'claude-sonnet-4-6', success: true, latencyMs: 850, trustScore: 95, outcomeCoverage: 0.9 });
  routing.recordRouteOutcome({ provider: 'gemini', model: 'gemini-2.0-flash', success: true, latencyMs: 420, trustScore: 86, outcomeCoverage: 0.8 });

  const alt = await supervisor.chooseAlternativeModel({
    currentModel: 'gpt-5.4',
    query: 'Bitte analysiere die Strategie',
    intent: 'reasoning',
    failureClass: 'provider',
    outcome: { coverage: 0.7 }
  });

  assert.equal(alt.model, 'claude-sonnet-4-6');
  assert.equal(alt.provider, 'anthropic');
  assert.equal(alt.decision.source, 'scorecard_mesh');
});

test('R16 supervisor mesh endpoint exposes playbooks and adaptive nodes', async () => {
  routing.recordRouteOutcome({ provider: 'anthropic', model: 'claude-sonnet-4-6', success: true, latencyMs: 900, trustScore: 93, outcomeCoverage: 0.88 });
  const app = createApp();

  const playbooks = await app.handleHttp({ runtime: 'test', path: '/supervisor/playbooks', method: 'GET', headers: adminHeaders });
  assert.equal(playbooks.statusCode, 200);
  assert.ok(playbooks.body.items.some((item) => item.failureClass === 'provider'));

  const mesh = await app.handleHttp({ runtime: 'test', path: '/supervisor/mesh', method: 'GET', headers: adminHeaders });
  assert.equal(mesh.statusCode, 200);
  assert.equal(mesh.body.summary.outcomeAwareRecovery, true);
  assert.ok(mesh.body.topology.routingNodes.some((item) => item.model === 'claude-sonnet-4-6'));

  const uiMesh = await app.handleHttp({ runtime: 'test', path: '/ui/supervisor/mesh', method: 'GET', headers: adminHeaders });
  assert.equal(uiMesh.statusCode, 200);
  assert.equal(uiMesh.body.version, 'v2');
});

test('R16 records recovery history during supervised execution', async () => {
  routing.recordRouteOutcome({ provider: 'anthropic', model: 'claude-sonnet-4-6', success: true, latencyMs: 700, trustScore: 94, outcomeCoverage: 0.95 });
  let calls = 0;
  const result = await supervisor.superviseTaskExecution({
    task: { model: 'gpt-5.4', worker_type: 'chat', task_id: 'task-r16' },
    query: 'Bitte beantworte die Frage',
    intent: 'default',
    traceId: 'trace-r16',
    runId: 'run-r16',
    outcome: { coverage: 0.2 },
    execute: async (task) => {
      calls += 1;
      if (calls === 1) {
        const err = new Error('provider failed');
        err.statusCode = 502;
        throw err;
      }
      return { ok: true, model: task.model };
    }
  });

  assert.equal(result.success, true);
  assert.equal(calls, 2);
  const recoveries = supervisor.listRecoveries(5);
  assert.ok(recoveries.length >= 2);
  assert.ok(recoveries.some((item) => item.success === false && item.failureClass === 'provider'));
  assert.ok(recoveries.some((item) => item.success === true && item.finalModel === 'claude-sonnet-4-6'));
});

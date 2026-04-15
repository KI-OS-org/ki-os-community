/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app');
const runtimeStore = require('../backend/services/ui/runtime.store');
const Observability = require('../backend/services/core/observability.service');
const {
  classifyFailure,
  superviseTaskExecution,
  listEscalations,
  resetEscalations,
  evaluateConfidence
} = require('../backend/services/supervisor/supervisor.service');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };

test.beforeEach(() => {
  Observability.reset();
  runtimeStore.resetStore();
  resetEscalations();
});

test('failure class v1 recognizes timeout and uncertainty', () => {
  assert.equal(classifyFailure(new Error('Provider timeout after 30000ms')), 'timeout');
  assert.equal(classifyFailure(new Error('low trust'), { lowConfidence: true }), 'uncertainty');
});

test('supervisor retries deterministically and recovers with alternative model', async () => {
  let calls = 0;
  const result = await superviseTaskExecution({
    task: { task_id: 'task-r8-1', worker_type: 'research', model: 'gpt-5.4' },
    query: 'Bitte recherchiere aktuelle Markttrends',
    intent: 'research',
    traceId: 'trace-r8-1',
    runId: 'run-r8-1',
    maxRecoveryAttempts: 2,
    execute: async (task) => {
      calls += 1;
      if (calls === 1) throw new Error('Provider timeout after 30000ms');
      return { ok: true, model: task.model };
    }
  });
  assert.equal(result.success, true);
  assert.equal(calls, 2);
  assert.ok(result.recovery.length >= 1);
  const snapshot = Observability.getSnapshot();
  assert.ok(snapshot.observability.eventsByType['supervisor.recovery.attempted'] >= 1);
  assert.ok(snapshot.observability.eventsByType['supervisor.recovered'] >= 1);
});

test('supervisor escalates after deterministic retry exhaustion', async () => {
  await assert.rejects(() => superviseTaskExecution({
    task: { task_id: 'task-r8-2', worker_type: 'chat', model: 'gpt-5.4' },
    query: 'Normale Antwort',
    intent: 'default',
    traceId: 'trace-r8-2',
    runId: 'run-r8-2',
    maxRecoveryAttempts: 1,
    execute: async () => { throw new Error('ECONNREFUSED network socket error'); }
  }), /(supervisor_escalated:(network|unknown)|supervisor_loop_blocked)/);
  assert.ok(Array.isArray(listEscalations(10)));
});

test('confidence logic marks low-score verification as uncertainty', () => {
  const confidence = evaluateConfidence({ verification: { verdict: 'revise', trust_score: 32 }, minScore: 40 });
  assert.equal(confidence.uncertain, true);
  assert.equal(confidence.failureClass, 'uncertainty');
});

test('supervisor API and UI expose recovery metadata and escalations', async () => {
  const app = createApp();
  await assert.rejects(() => superviseTaskExecution({
    task: { task_id: 'task-r8-3', worker_type: 'code', model: 'claude-sonnet-4-6' },
    query: 'Refactor code',
    intent: 'code',
    traceId: 'trace-r8-3',
    runId: 'run-r8-3',
    maxRecoveryAttempts: 1,
    execute: async () => { throw new Error('provider crashed'); }
  }));

  const root = await app.handleHttp({ runtime: 'test', path: '/supervisor', method: 'GET', headers: adminHeaders, query: {} });
  const rec = await app.handleHttp({ runtime: 'test', path: '/supervisor/recover', method: 'POST', headers: adminHeaders, body: { currentModel: 'gpt-5.4', query: 'Bitte recherchiere', intent: 'research', error: 'Provider timeout after 30000ms' } });
  const ui = await app.handleHttp({ runtime: 'test', path: '/ui/supervisor', method: 'GET', headers: adminHeaders, query: {} });
  const escalations = await app.handleHttp({ runtime: 'test', path: '/supervisor/escalations', method: 'GET', headers: adminHeaders, query: {} });

  assert.equal(root.statusCode, 200);
  assert.equal(rec.statusCode, 200);
  assert.equal(ui.statusCode, 200);
  assert.equal(escalations.statusCode, 200);
  assert.equal(root.body.version, 'v2');
  assert.ok(rec.body.recommended.action);
  assert.ok(Array.isArray(ui.body.items));
  assert.ok(Array.isArray(escalations.body.items));
  assert.ok(Array.isArray(escalations.body.items));
});

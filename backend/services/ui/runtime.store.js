/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
"use strict";
const Observability = require('../core/observability.service');
const { createStoreBackend } = require('../state/store.backend');

const backend = createStoreBackend({
  name: 'runtime-store',
  backendEnvKey: 'RUNTIME_STORE_BACKEND',
  filePathEnvKey: 'RUNTIME_STORE_PATH',
  tableEnvKey: 'RUNTIME_STORE_TABLE',
  defaultFileName: '.ki-os-runtime-store.json',
  defaultTableName: 'ki_os_runtime_store',
  partitionKey: 'runtime_store',
  defaultValueFactory: () => ({ runs: [] })
});

const MAX_RUNS = Number(process.env.RUNTIME_STORE_LIMIT || 500);
const MAX_TRANSITIONS = Number(process.env.RUNTIME_STORE_MAX_TRANSITIONS || 100);
const FINAL_STATES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
const ACTIVE_STATES = new Set(['CREATED', 'INTENT_RESOLVED', 'PLANNING', 'ROUTED', 'EXECUTING', 'VERIFYING', 'REVIEWING', 'WAITING_APPROVAL']);
const VALID_TRANSITIONS = Object.freeze({
  CREATED: ['INTENT_RESOLVED', 'PLANNING', 'ROUTED', 'EXECUTING', 'WAITING_APPROVAL', 'FAILED', 'CANCELLED'],
  INTENT_RESOLVED: ['PLANNING', 'ROUTED', 'EXECUTING', 'WAITING_APPROVAL', 'FAILED', 'CANCELLED'],
  PLANNING: ['ROUTED', 'EXECUTING', 'VERIFYING', 'WAITING_APPROVAL', 'FAILED', 'CANCELLED'],
  ROUTED: ['EXECUTING', 'VERIFYING', 'WAITING_APPROVAL', 'FAILED', 'CANCELLED'],
  EXECUTING: ['VERIFYING', 'REVIEWING', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED'],
  VERIFYING: ['REVIEWING', 'COMPLETED', 'FAILED', 'WAITING_APPROVAL', 'CANCELLED'],
  REVIEWING: ['COMPLETED', 'FAILED', 'WAITING_APPROVAL', 'CANCELLED'],
  WAITING_APPROVAL: ['PLANNING', 'EXECUTING', 'CANCELLED', 'FAILED'],
  COMPLETED: [], FAILED: [], CANCELLED: []
});

let store = { runs: [] };
function now() { return new Date().toISOString(); }
function normalizeOutcome(outcome = {}) { return { expected: Array.isArray(outcome.expected) ? outcome.expected : [], observed: Array.isArray(outcome.observed) ? outcome.observed : [], coverage: Number(outcome.coverage || 0) }; }
function projectRun(run) { const final = FINAL_STATES.has(run.status); const errored = Array.isArray(run.errors) && run.errors.length > 0; const blocked = run.status === 'WAITING_APPROVAL'; const coverage = Number(run.outcome?.coverage || 0); run.projection = { final, blocked, healthy: !errored && run.status !== 'FAILED', coverage, summary: blocked ? 'waiting_approval' : (final ? run.status.toLowerCase() : 'in_progress') }; return run; }
function normalizeRun(seed = {}) { return projectRun({ runId: seed.runId, traceId: seed.traceId || null, sessionId: seed.sessionId || null, parentRunId: seed.parentRunId || null, agentId: seed.agentId || seed.runId, userId: seed.userId || 'guest', tenantId: seed.tenantId || 'default', type: seed.type || 'agent', status: seed.status || 'CREATED', task: seed.task || '', createdAt: seed.createdAt || now(), updatedAt: seed.updatedAt || now(), completedAt: seed.completedAt || null, steps: Array.isArray(seed.steps) ? seed.steps : [], events: Array.isArray(seed.events) ? seed.events : [], errors: Array.isArray(seed.errors) ? seed.errors : [], outputs: Array.isArray(seed.outputs) ? seed.outputs : [], transitionsCount: Number(seed.transitionsCount || 0), outcome: normalizeOutcome(seed.outcome) }); }
function normalizeStore(parsed) { const base = parsed && typeof parsed === 'object' ? parsed : {}; return { runs: Array.isArray(base.runs) ? base.runs.map(normalizeRun) : [] }; }
function readStore() { return normalizeStore(backend.read()); }
function persist() { if (store.runs.length > MAX_RUNS) store.runs = store.runs.slice(-MAX_RUNS); backend.write(store); }
function load() { store = readStore(); return store; }
function findRun(runId) { return store.runs.find((r) => r.runId === runId) || null; }
function ensureRun(runId, seed = {}) { load(); let run = findRun(runId); if (!run) { run = normalizeRun({ ...seed, runId }); store.runs.push(run); Observability.emit('runtime.run.created', { runId, traceId: run.traceId, agentId: run.agentId, userId: run.userId, tenantId: run.tenantId, type: run.type }); persist(); } return run; }
function createRun(seed = {}) { const runId = seed.runId || `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; return ensureRun(runId, seed); }
function assertValidTransition(fromStatus, toStatus) { const allowed = VALID_TRANSITIONS[fromStatus] || []; if (!allowed.includes(toStatus)) { const error = new Error(`invalid_transition:${fromStatus}->${toStatus}`); error.statusCode = 400; throw error; } }
function transitionRun(runId, status, details = {}) { const run = ensureRun(runId, details); assertValidTransition(run.status, status); run.transitionsCount = Number(run.transitionsCount || 0) + 1; if (run.transitionsCount > MAX_TRANSITIONS) { const error = new Error('runtime_transition_limit_exceeded'); error.statusCode = 409; throw error; } run.status = status; run.updatedAt = now(); run.events.push({ timestamp: run.updatedAt, type: 'state', status, details }); Observability.emit('runtime.run.transition', { runId, traceId: run.traceId, status, details }, { runId }); if (details.stepId || details.stepName) { run.steps.push({ id: details.stepId || `step-${run.steps.length + 1}`, name: details.stepName || status, status, timestamp: run.updatedAt, worker: details.worker || null, model: details.model || null }); } if (FINAL_STATES.has(status)) run.completedAt = run.updatedAt; projectRun(run); persist(); return run; }
function appendOutput(runId, output) { const run = ensureRun(runId); run.outputs.push({ timestamp: now(), ...output }); Observability.emit('runtime.run.output.appended', { runId, traceId: run.traceId, outputType: output?.type || 'unknown' }, { runId }); run.updatedAt = now(); projectRun(run); persist(); return run; }
function appendError(runId, error) { const run = ensureRun(runId); run.errors.push({ timestamp: now(), ...error }); Observability.emit('runtime.run.error.appended', { runId, traceId: run.traceId, error: error?.message || 'unknown_error' }, { runId }); run.updatedAt = now(); projectRun(run); persist(); return run; }
function recordEvent(runId, event) { const run = ensureRun(runId); run.events.push({ timestamp: now(), ...event }); Observability.emit('runtime.event.recorded', { runId, traceId: run.traceId, eventType: event?.type || 'custom' }, { runId }); run.updatedAt = now(); projectRun(run); persist(); return run; }
function computeCoverage(outcome = {}) { const expected = Array.isArray(outcome.expected) ? outcome.expected : []; const observed = Array.isArray(outcome.observed) ? outcome.observed : []; if (!expected.length) return 0; const keys = new Set(observed.map((item) => String(item?.key || ''))); const matched = expected.filter((item) => keys.has(String(item?.key || ''))).length; return Number((matched / expected.length).toFixed(4)); }
function setExpectedOutcome(runId, payload = {}) { const run = ensureRun(runId); run.outcome.expected.push({ timestamp: now(), ...payload }); run.outcome.coverage = computeCoverage(run.outcome); Observability.emit('runtime.outcome.expected', { runId, traceId: run.traceId, key: payload?.key || null }, { runId }); projectRun(run); persist(); return run; }
function appendObservedOutcome(runId, payload = {}) { const run = ensureRun(runId); run.outcome.observed.push({ timestamp: now(), ...payload }); run.outcome.coverage = computeCoverage(run.outcome); Observability.emit('runtime.outcome.observed', { runId, traceId: run.traceId, key: payload?.key || null }, { runId }); projectRun(run); persist(); return run; }
function listRuns(limit = 50) { load(); return store.runs.slice(-Math.max(1, Number(limit || 50))).reverse().map((run) => projectRun(run)); }
function getRun(runId) { load(); const run = findRun(runId); return run ? projectRun(run) : null; }
function getMetrics() { load(); const runs = store.runs; const active = runs.filter((r) => ACTIVE_STATES.has(r.status)).length; const completed = runs.filter((r) => r.status === 'COMPLETED').length; const failed = runs.filter((r) => r.status === 'FAILED').length; const waitingApproval = runs.filter((r) => r.status === 'WAITING_APPROVAL').length; const durations = runs.filter((r) => r.createdAt && r.completedAt).map((r) => new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()).filter((n) => Number.isFinite(n) && n >= 0); const averageLatencyMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0; const coverageValues = runs.map((r) => Number(r.outcome?.coverage || 0)).filter((v) => Number.isFinite(v)); const outcomeCoverage = coverageValues.length ? Number((coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length).toFixed(4)) : 0; return { totalRuns: runs.length, activeRuns: active, completedRuns: completed, failedRuns: failed, waitingApprovalRuns: waitingApproval, averageLatencyMs, outcomeCoverage }; }
function exportState() { load(); return { backend: getBackendInfo(), store: normalizeStore(store) }; }
function importState(payload = {}) { store = normalizeStore(payload.store || payload); persist(); return exportState(); }
function getBackendInfo() { return { ...backend.info(), limit: MAX_RUNS, maxTransitions: MAX_TRANSITIONS }; }
function resetStore() { store = { runs: [] }; backend.remove(); }
load();
module.exports = { VALID_TRANSITIONS, createRun, transitionRun, appendOutput, appendError, recordEvent, setExpectedOutcome, appendObservedOutcome, computeCoverage, listRuns, getRun, getMetrics, exportState, importState, getBackendInfo, resetStore, _load: load };
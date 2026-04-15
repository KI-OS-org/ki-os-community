/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const Observability = require('../core/observability.service');
const { createStoreBackend } = require('../state/store.backend');
const backend = createStoreBackend({ name: 'circuit-breaker', backendEnvKey: 'CB_STORE_BACKEND', filePathEnvKey: 'CIRCUIT_BREAKER_STATE_PATH', tableEnvKey: 'CB_STORE_TABLE', defaultFileName: '.ki-os-circuit-breaker.json', defaultTableName: 'ki_os_circuit_breaker', partitionKey: 'circuit_breaker', defaultValueFactory: () => ({ items: {} }) });
function threshold() { return Number(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || 3); }
function coolDownMs() { return Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS || 30000); }
function now() { return Date.now(); }
let state = backend.read() || { items: {} };
function load() { state = backend.read() || { items: {} }; return state; }
function persist() { backend.write(state); }
function stateFor(key) { load(); return state.items[key] || { failures: 0, openedAt: 0, state: 'closed', lastError: null }; }
function canExecute(key) { const current = stateFor(key); if (current.state !== 'open') return { allowed: true, state: current.state }; const age = now() - Number(current.openedAt || 0); if (age >= coolDownMs()) { current.state = 'half_open'; state.items[key] = current; persist(); return { allowed: true, state: 'half_open' }; } const error = new Error(`circuit_breaker_open:${key}`); error.statusCode = 503; error.failureClass = 'provider'; error.circuitBreaker = { key, state: 'open', retryAfterMs: Math.max(0, coolDownMs() - age) }; Observability.emit('security.event', { source: 'circuit_breaker', key, decision: 'blocked', state: 'open' }); throw error; }
function recordFailure(key, error) { load(); const current = state.items[key] || { failures: 0, openedAt: 0, state: 'closed', lastError: null }; current.failures += 1; current.lastError = String(error?.message || error || 'unknown_error'); if (current.failures >= threshold()) { current.state = 'open'; current.openedAt = now(); } state.items[key] = current; persist(); Observability.emit('security.event', { source: 'circuit_breaker', key, decision: current.state === 'open' ? 'opened' : 'tracked', failures: current.failures }); return current; }
function recordSuccess(key) { load(); state.items[key] = { failures: 0, openedAt: 0, state: 'closed', lastError: null }; persist(); return state.items[key]; }
function getSnapshot() { load(); return { success: true, backend: backend.info(), threshold: threshold(), coolDownMs: coolDownMs(), items: state.items }; }
function reset() { state = { items: {} }; backend.remove(); }
module.exports = { canExecute, recordFailure, recordSuccess, stateFor, getSnapshot, reset, resetCircuitBreakers: reset, getCircuitBreakerState: stateFor };
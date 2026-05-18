/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
'use strict';

const { push } = require('../ui/ui.eventbus');
const OTel = require('./otel-lite.service');

function getRuntimeStore() {
  return require('../ui/runtime.store');
}

const metrics = {
  bootedAt: new Date().toISOString(),
  requestsTotal: 0,
  requestsByRoute: {},
  requestsByMethod: {},
  statusCodes: {},
  errorsTotal: 0,
  errorsByClass: {},
  providerCallsTotal: 0,
  providerUsage: {},
  providerFailures: {},
  eventsTotal: 0,
  eventsByType: {},
  durationsMs: [],
  lastError: null
};

const EVENT_TAXONOMY = Object.freeze({
  'http.request.started': 'Inbound request accepted by app layer',
  'http.request.completed': 'Inbound request completed with status and latency',
  'http.request.failed': 'Inbound request failed before successful completion',
  'runtime.run.created': 'Run created in runtime store',
  'runtime.run.transition': 'Run state transition',
  'runtime.run.output.appended': 'Output appended to run',
  'runtime.run.error.appended': 'Error appended to run',
  'runtime.event.recorded': 'Custom runtime event recorded',
  'chat.started': 'Chat request entered controller',
  'chat.completed': 'Chat request completed successfully',
  'chat.failed': 'Chat request failed',
  'provider.call.completed': 'Provider call succeeded',
  'provider.call.failed': 'Provider call failed',
  'security.event': 'Security or trust relevant event',
  'policy.decision': 'Policy gate decision emitted',
  'governance.approval.requested': 'Approval request created for gated action',
  'runtime.outcome.expected': 'Expected outcome registered for run',
  'runtime.outcome.observed': 'Observed outcome registered for run',
  'desktop.action': 'Desktop action observed',
  'ui.audit.write': 'UI audit trail entry written',
  'connector.registered': 'Connector registered in capability registry',
  'connector.health.updated': 'Connector health state updated',
  'mcp.request.completed': 'MCP base path request completed',
  'routing.decision.made': 'Dynamic routing decision recorded with selected provider/model',
  'routing.fallback.used': 'Dynamic routing fallback path was activated',
  'supervisor.recovery.attempted': 'Supervisor attempted controlled recovery after a classified failure',
  'supervisor.recovered': 'Supervisor recovered execution after retry or model switch',
  'supervisor.escalated': 'Supervisor escalated a failure after deterministic recovery exhaustion',
  'supervisor.loop.blocked': 'Supervisor blocked further retries to avoid infinite recovery loops',
  'memory.mutation.saved': 'Structured memory mutation persisted with semantic annotation',
  'memory.outcome.marker.created': 'Outcome-aware marker stored in semantic memory',
  'memory.retrieval.performed': 'Semantic retrieval executed with provenance references'
});

function inc(bucket, key, amount = 1) {
  bucket[key] = (bucket[key] || 0) + amount;
}

function avg(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

function normalizeErrorMessage(error) {
  return String(error?.message || error || 'unknown_error');
}

function classifyError(error, statusCode) {
  const msg = normalizeErrorMessage(error).toLowerCase();
  const status = Number(statusCode || error?.statusCode || 0);
  if (status === 429 || /too many requests|rate limit/.test(msg)) return 'rate_limit';
  if (status === 401 || /unauthorized|invalid token|missing api key/.test(msg)) return 'auth';
  if (status === 403 || /forbidden|trust gate|policy|blocked/.test(msg)) return 'policy';
  if (status === 400 || /invalid|required|bad request|validation/.test(msg)) return 'validation';
  if (/timeout|timed out|etimedout|deadline/.test(msg)) return 'timeout';
  if (/network|socket|econnrefused|enotfound|dns/.test(msg)) return 'network';
  if (/provider|openai|anthropic|gemini|deepseek|openrouter/.test(msg)) return 'provider';
  if (status >= 500) return 'internal';
  return 'unknown';
}

function emit(eventType, payload = {}, options = {}) {
  OTel.logRecord('INFO', eventType, { traceId: payload?.traceId || options?.traceId || null, runId: options?.runId || payload?.runId || null, path: payload?.path || null, provider: payload?.provider || null });
  metrics.eventsTotal += 1;
  inc(metrics.eventsByType, eventType);
  const entry = push(eventType, payload);
  if (options.runId && !String(eventType || '').startsWith('runtime.')) {
    const runtimeStore = getRuntimeStore();
    if (runtimeStore && typeof runtimeStore.recordEvent === 'function') {
      runtimeStore.recordEvent(options.runId, { type: eventType, payload });
    }
  }
  return entry;
}

function startRequest({ traceId, method, path, runtime } = {}) {
  metrics.requestsTotal += 1;
  inc(metrics.requestsByRoute, path || 'unknown');
  inc(metrics.requestsByMethod, (method || 'GET').toUpperCase());
  const span = OTel.startSpan('http.request', { traceId, method, path, runtime, kind: 'server' });
  emit('http.request.started', { traceId, method, path, runtime });
  return { startedAt: Date.now(), traceId, method, path, runtime, spanId: span.spanId };
}

function completeRequest(handle, { statusCode, runId } = {}) {
  const durationMs = Math.max(0, Date.now() - Number(handle?.startedAt || Date.now()));
  metrics.durationsMs.push(durationMs);
  if (metrics.durationsMs.length > 1000) metrics.durationsMs.splice(0, metrics.durationsMs.length - 1000);
  inc(metrics.statusCodes, String(statusCode || 0));
  OTel.addEvent(handle?.spanId, 'http.request.completed', { statusCode: statusCode || 0, durationMs });
  OTel.endSpan(handle?.spanId, 'ok', { statusCode: statusCode || 0, runId: runId || null });
  emit('http.request.completed', {
    traceId: handle?.traceId,
    method: handle?.method,
    path: handle?.path,
    runtime: handle?.runtime,
    statusCode: statusCode || 0,
    durationMs
  }, { runId });
  return durationMs;
}

function failRequest(handle, error, { statusCode, runId } = {}) {
  const errorClass = classifyError(error, statusCode);
  metrics.errorsTotal += 1;
  inc(metrics.errorsByClass, errorClass);
  inc(metrics.statusCodes, String(statusCode || error?.statusCode || 500));
  metrics.lastError = {
    at: new Date().toISOString(),
    errorClass,
    message: normalizeErrorMessage(error),
    statusCode: statusCode || error?.statusCode || 500,
    traceId: handle?.traceId,
    path: handle?.path,
    method: handle?.method
  };
  OTel.addEvent(handle?.spanId, 'http.request.failed', { statusCode: statusCode || error?.statusCode || 500, errorClass, error: normalizeErrorMessage(error) });
  OTel.endSpan(handle?.spanId, 'error', { statusCode: statusCode || error?.statusCode || 500, runId: runId || null, errorClass });
  emit('http.request.failed', {
    traceId: handle?.traceId,
    method: handle?.method,
    path: handle?.path,
    runtime: handle?.runtime,
    statusCode: statusCode || error?.statusCode || 500,
    errorClass,
    error: normalizeErrorMessage(error)
  }, { runId });
  return errorClass;
}

function recordProviderCall(provider, meta = {}) {
  const key = String(provider || 'unknown').toLowerCase();
  metrics.providerCallsTotal += 1;
  inc(metrics.providerUsage, key);
  emit('provider.call.completed', { provider: key, ...meta });
}

function recordProviderFailure(provider, error, meta = {}) {
  const key = String(provider || 'unknown').toLowerCase();
  inc(metrics.providerFailures, key);
  emit('provider.call.failed', {
    provider: key,
    errorClass: classifyError(error),
    error: normalizeErrorMessage(error),
    ...meta
  });
}

function getSnapshot() {
  const runtimeMetrics = getRuntimeStore().getMetrics();
  return {
    success: true,
    observability: {
      bootedAt: metrics.bootedAt,
      requestsTotal: metrics.requestsTotal,
      errorsTotal: metrics.errorsTotal,
      errorRate: metrics.requestsTotal ? Number((metrics.errorsTotal / metrics.requestsTotal).toFixed(4)) : 0,
      avgLatencyMs: avg(metrics.durationsMs),
      p95LatencyMs: percentile(metrics.durationsMs, 95),
      requestsByRoute: metrics.requestsByRoute,
      requestsByMethod: metrics.requestsByMethod,
      statusCodes: metrics.statusCodes,
      errorsByClass: metrics.errorsByClass,
      providerCallsTotal: metrics.providerCallsTotal,
      providerUsage: metrics.providerUsage,
      providerFailures: metrics.providerFailures,
      eventsTotal: metrics.eventsTotal,
      eventsByType: metrics.eventsByType,
      taxonomyVersion: 'v1',
      eventTypes: EVENT_TAXONOMY,
      lastError: metrics.lastError
    },
    runtime: runtimeMetrics,
    telemetry: OTel.getSnapshot().otel
  };
}


function reset() {
  metrics.bootedAt = new Date().toISOString();
  metrics.requestsTotal = 0;
  metrics.requestsByRoute = {};
  metrics.requestsByMethod = {};
  metrics.statusCodes = {};
  metrics.errorsTotal = 0;
  metrics.errorsByClass = {};
  metrics.providerCallsTotal = 0;
  metrics.providerUsage = {};
  metrics.providerFailures = {};
  metrics.eventsTotal = 0;
  metrics.eventsByType = {};
  metrics.durationsMs = [];
  metrics.lastError = null;
}

module.exports = {
  EVENT_TAXONOMY,
  classifyError,
  emit,
  startRequest,
  completeRequest,
  failRequest,
  recordProviderCall,
  recordProviderFailure,
  getSnapshot,
  reset,
  getTelemetrySnapshot: OTel.getSnapshot
};

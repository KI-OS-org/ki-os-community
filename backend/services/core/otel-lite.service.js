/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const MAX_SPANS = Number(process.env.OTEL_SPAN_LIMIT || 500);
const MAX_LOGS = Number(process.env.OTEL_LOG_LIMIT || 500);
const state = {
  bootedAt: new Date().toISOString(),
  spans: [],
  logs: [],
  exportEvents: [],
  exporters: {},
  counters: {
    spansStarted: 0,
    spansCompleted: 0,
    errors: 0
  }
};

function nowIso() { return new Date().toISOString(); }
function durationMs(startedAt) { return Math.max(0, Date.now() - Number(startedAt || Date.now())); }
function trim(arr, limit) {
  if (arr.length > limit) arr.splice(0, arr.length - limit);
}

function normalizeAttrs(attrs = {}) {
  const out = {};
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined) continue;
    if (v === null) { out[k] = null; continue; }
    if (typeof v === 'object') out[k] = JSON.stringify(v).slice(0, 500);
    else out[k] = v;
  }
  return out;
}

function startSpan(name, attrs = {}) {
  const span = {
    spanId: `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    traceId: attrs.traceId || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    runId: attrs.runId || null,
    name,
    kind: attrs.kind || 'internal',
    status: 'started',
    startedAt: Date.now(),
    startedAtIso: nowIso(),
    endedAtIso: null,
    durationMs: null,
    attributes: normalizeAttrs(attrs),
    events: []
  };
  state.spans.push(span);
  state.counters.spansStarted += 1;
  trim(state.spans, MAX_SPANS);
  return span;
}

function addEvent(spanOrId, name, attrs = {}) {
  const spanId = typeof spanOrId === 'string' ? spanOrId : spanOrId?.spanId;
  const span = state.spans.find((item) => item.spanId === spanId);
  if (!span) return null;
  span.events.push({ name, timestamp: nowIso(), attributes: normalizeAttrs(attrs) });
  if (span.events.length > 50) span.events.splice(0, span.events.length - 50);
  return span;
}

function endSpan(spanOrId, status = 'ok', attrs = {}) {
  const spanId = typeof spanOrId === 'string' ? spanOrId : spanOrId?.spanId;
  const span = state.spans.find((item) => item.spanId === spanId);
  if (!span) return null;
  span.status = status;
  span.durationMs = durationMs(span.startedAt);
  span.endedAtIso = nowIso();
  span.attributes = { ...span.attributes, ...normalizeAttrs(attrs) };
  state.counters.spansCompleted += 1;
  if (status !== 'ok') state.counters.errors += 1;
  return span;
}

function logRecord(severity, event, attrs = {}) {
  state.logs.push({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: nowIso(),
    severity,
    event,
    attributes: normalizeAttrs(attrs)
  });
  trim(state.logs, MAX_LOGS);
}

function listSpans(limit = 50) {
  return state.spans.slice(-Math.max(1, Number(limit || 50))).reverse();
}

function listLogs(limit = 50) {
  return state.logs.slice(-Math.max(1, Number(limit || 50))).reverse();
}

function getSnapshot() {
  const spans = state.spans;
  const durations = spans.map((s) => Number(s.durationMs || 0)).filter((n) => Number.isFinite(n) && n > 0);
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const p95 = durations.length ? durations.sort((a, b) => a - b)[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] : 0;
  return {
    success: true,
    otel: {
      enabled: true,
      profile: 'otel-lite-v1',
      bootedAt: state.bootedAt,
      spansStored: state.spans.length,
      logsStored: state.logs.length,
      spansStarted: state.counters.spansStarted,
      spansCompleted: state.counters.spansCompleted,
      errors: state.counters.errors,
      avgSpanDurationMs: avg,
      p95SpanDurationMs: p95,
      exporters: state.exporters,
      exportEvents: state.exportEvents.slice(0, 20)
    }
  };
}

function exporterMode() { return String(process.env.OTEL_EXPORTER_MODE || 'cloudwatch').toLowerCase(); }
function listExporters() { return [{ id: 'cloudwatch', enabled: exporterMode() === 'cloudwatch' }, { id: 'otlp_http', enabled: exporterMode() === 'otlp_http' }]; }
function exportTest(payload = {}) {
  const exporter = exporterMode();
  const event = { id: `otel-exp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, exporter, payload, createdAt: nowIso() };
  state.exportEvents.unshift(event);
  state.exportEvents = state.exportEvents.slice(0, 100);
  state.exporters[exporter] = { lastExportAt: event.createdAt, totalExports: Number(state.exporters[exporter]?.totalExports || 0) + 1, lastPayloadType: payload.type || 'test' };
  return { success: true, exporter, event };
}

function reset() {
  state.bootedAt = nowIso();
  state.spans.length = 0;
  state.logs.length = 0;
  state.exportEvents.length = 0;
  state.exporters = {};
  state.counters = { spansStarted: 0, spansCompleted: 0, errors: 0 };
}

module.exports = {
  startSpan,
  addEvent,
  endSpan,
  logRecord,
  listSpans,
  listLogs,
  getSnapshot,
  listExporters,
  exportTest,
  reset
};

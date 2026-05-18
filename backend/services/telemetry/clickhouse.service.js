/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
'use strict';

const { defaultClient } = require('./clickhouse.client');

const RETENTION_DAYS = Math.max(1, Math.min(3650, Number(process.env.CLICKHOUSE_RETENTION_DAYS || 30)));
let initPromise = null;

function toPositiveInt(value, fallback, max = 1000) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
}

async function ensureSchema(client = defaultClient) {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await client.command(`CREATE DATABASE IF NOT EXISTS ${client.database}`);

    await client.command(`
      CREATE TABLE IF NOT EXISTS otel_spans (
        trace_id String,
        span_id String,
        parent_span_id String DEFAULT '',
        service LowCardinality(String),
        operation LowCardinality(String),
        duration_ms Float64,
        status LowCardinality(String),
        attributes String,
        timestamp DateTime64(3, 'UTC'),
        INDEX idx_trace trace_id TYPE bloom_filter(0.01) GRANULARITY 1,
        INDEX idx_status status TYPE set(100) GRANULARITY 4,
        INDEX idx_operation operation TYPE bloom_filter(0.01) GRANULARITY 4
      )
      ENGINE = MergeTree
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (service, timestamp, trace_id, span_id)
      TTL timestamp + INTERVAL ${RETENTION_DAYS} DAY
      SETTINGS index_granularity = 8192
    `);

    await client.command(`
      CREATE TABLE IF NOT EXISTS otel_metrics (
        metric_name LowCardinality(String),
        value Float64,
        labels String,
        timestamp DateTime64(3, 'UTC'),
        INDEX idx_metric metric_name TYPE set(1000) GRANULARITY 4
      )
      ENGINE = MergeTree
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (metric_name, timestamp)
      TTL timestamp + INTERVAL ${RETENTION_DAYS} DAY
    `);

    await client.command(`
      CREATE TABLE IF NOT EXISTS otel_logs (
        level LowCardinality(String),
        message String,
        service LowCardinality(String),
        trace_id String,
        timestamp DateTime64(3, 'UTC'),
        INDEX idx_log_trace trace_id TYPE bloom_filter(0.01) GRANULARITY 1,
        INDEX idx_log_level level TYPE set(100) GRANULARITY 4
      )
      ENGINE = MergeTree
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (service, timestamp, level, trace_id)
      TTL timestamp + INTERVAL ${RETENTION_DAYS} DAY
    `);
  })();
  return initPromise;
}

function parseWindow(value, fallback = '24 HOUR') {
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^(\d{1,4})\s*(MINUTE|HOUR|DAY)$/);
  if (!match) return fallback;
  return `${Number(match[1])} ${match[2]}`;
}

async function getTraces({ page = 1, limit = 50, service, status, search } = {}) {
  await ensureSchema();
  const safePage = toPositiveInt(page, 1, 100000);
  const safeLimit = toPositiveInt(limit, 50, 200);
  const offset = (safePage - 1) * safeLimit;
  const filters = [];
  const params = { limit: safeLimit, offset };

  if (service) {
    filters.push('service = :service');
    params.service = service;
  }
  if (status) {
    filters.push('status = :status');
    params.status = status;
  }
  if (search) {
    filters.push('(trace_id ILIKE :search OR operation ILIKE :search)');
    params.search = `%${search}%`;
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = await defaultClient.query(`
    SELECT
      trace_id,
      min(timestamp) AS started_at,
      max(timestamp) AS ended_at,
      count() AS span_count,
      any(service) AS service,
      groupUniqArray(operation) AS operations,
      max(duration_ms) AS max_duration_ms,
      quantileExact(0.95)(duration_ms) AS p95_duration_ms,
      countIf(status IN ('ERROR', 'STATUS_CODE_ERROR')) AS error_count
    FROM otel_spans
    ${where}
    GROUP BY trace_id
    ORDER BY started_at DESC
    LIMIT :limit OFFSET :offset
  `, params);

  const totals = await defaultClient.query(`
    SELECT count() AS total
    FROM (SELECT trace_id FROM otel_spans ${where} GROUP BY trace_id)
  `, params);

  return {
    page: safePage,
    limit: safeLimit,
    total: Number(totals[0]?.total || 0),
    traces: rows,
  };
}

async function getTrace(traceId) {
  await ensureSchema();
  const spans = await defaultClient.query(`
    SELECT trace_id, span_id, parent_span_id, service, operation, duration_ms, status, attributes, timestamp
    FROM otel_spans
    WHERE trace_id = :traceId
    ORDER BY timestamp ASC, duration_ms DESC
  `, { traceId });
  return {
    trace_id: traceId,
    span_count: spans.length,
    duration_ms: spans.length ? Math.max(...spans.map((s) => Number(s.duration_ms || 0))) : 0,
    status: spans.some((s) => String(s.status).includes('ERROR')) ? 'ERROR' : 'OK',
    spans,
  };
}

async function getLatency({ window = '24 HOUR', bucket = '5 minute', service } = {}) {
  await ensureSchema();
  const interval = parseWindow(window);
  const bucketExpr = String(bucket).toLowerCase().includes('hour')
    ? 'toStartOfHour(timestamp)'
    : 'toStartOfFiveMinute(timestamp)';
  const params = {};
  const serviceFilter = service ? 'AND service = :service' : '';
  if (service) params.service = service;
  return defaultClient.query(`
    SELECT
      ${bucketExpr} AS bucket,
      quantileTDigest(0.50)(duration_ms) AS p50,
      quantileTDigest(0.90)(duration_ms) AS p90,
      quantileTDigest(0.99)(duration_ms) AS p99,
      avg(duration_ms) AS avg,
      count() AS count
    FROM otel_spans
    WHERE timestamp >= now() - INTERVAL ${interval} ${serviceFilter}
    GROUP BY bucket
    ORDER BY bucket ASC
  `, params);
}

async function getCosts({ window = '24 HOUR' } = {}) {
  await ensureSchema();
  const interval = parseWindow(window);
  return defaultClient.query(`
    SELECT
      JSONExtractString(attributes, 'provider') AS provider,
      JSONExtractString(attributes, 'model') AS model,
      sum(toFloat64OrZero(JSONExtractString(attributes, 'cost_usd'))) AS total_usd,
      count() AS calls,
      avg(duration_ms) AS avg_latency_ms
    FROM otel_spans
    WHERE timestamp >= now() - INTERVAL ${interval}
      AND JSONExtractString(attributes, 'cost_usd') != ''
    GROUP BY provider, model
    ORDER BY total_usd DESC
  `);
}

async function getErrors({ window = '24 HOUR', limit = 20 } = {}) {
  await ensureSchema();
  const interval = parseWindow(window);
  const safeLimit = toPositiveInt(limit, 20, 100);
  const summary = await defaultClient.query(`
    SELECT
      count() AS total_spans,
      countIf(status IN ('ERROR', 'STATUS_CODE_ERROR')) AS error_spans,
      if(total_spans = 0, 0, error_spans / total_spans) AS error_rate
    FROM otel_spans
    WHERE timestamp >= now() - INTERVAL ${interval}
  `);
  const topErrors = await defaultClient.query(`
    SELECT
      service,
      operation,
      JSONExtractString(attributes, 'error.message') AS message,
      count() AS count,
      max(timestamp) AS last_seen
    FROM otel_spans
    WHERE timestamp >= now() - INTERVAL ${interval}
      AND status IN ('ERROR', 'STATUS_CODE_ERROR')
    GROUP BY service, operation, message
    ORDER BY count DESC
    LIMIT :limit
  `, { limit: safeLimit });
  const timeline = await defaultClient.query(`
    SELECT
      toStartOfFiveMinute(timestamp) AS bucket,
      count() AS total,
      countIf(status IN ('ERROR', 'STATUS_CODE_ERROR')) AS errors,
      if(total = 0, 0, errors / total) AS error_rate
    FROM otel_spans
    WHERE timestamp >= now() - INTERVAL ${interval}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);
  return { summary: summary[0] || { total_spans: 0, error_spans: 0, error_rate: 0 }, topErrors, timeline };
}

module.exports = {
  ensureSchema,
  getTraces,
  getTrace,
  getLatency,
  getCosts,
  getErrors,
};

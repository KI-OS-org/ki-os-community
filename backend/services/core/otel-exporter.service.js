/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: otel-exporter.service.js
 * OTLP/HTTP Exporter fuer KI-OS
 * @license AGPL-3.0-only
 */

const http = require('http');
const { URL } = require('url');
const { listSpans, listLogs } = require('./otel-lite.service');

const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const OTEL_EXPORT_INTERVAL_MS = Number(process.env.OTEL_EXPORT_INTERVAL_MS) || 30000;
const OTEL_EXPORT_BATCH_SIZE = Number(process.env.OTEL_EXPORT_BATCH_SIZE) || 100;
const OTEL_EXPORTER_HEADERS = process.env.OTEL_EXPORTER_HEADERS ? JSON.parse(process.env.OTEL_EXPORTER_HEADERS) : {};
const OTEL_EXPORT_FAIL_SILENT = process.env.OTEL_EXPORT_FAIL_SILENT !== 'false';
const OTEL_EXPORTER_ENABLED = OTEL_EXPORTER_OTLP_ENDPOINT ? true : false;
const OTEL_EXPORT_RETRY = Number(process.env.OTEL_EXPORT_RETRY) || 2;

const state = {
  lastExportAt: null,
  totalExported: { spans: 0, logs: 0 },
  errors: [],
  exported: new Set(),
  timer: null
};

function start() {
  if (!OTEL_EXPORTER_ENABLED) {
    console.warn('OTEL_EXPORTER_OTLP_ENDPOINT not set, exporter not started.');
    return;
  }
  stop();
  state.timer = setInterval(() => flush().catch(err => console.error(err)), OTEL_EXPORT_INTERVAL_MS);
  console.log('OTEL Exporter started with interval:', OTEL_EXPORT_INTERVAL_MS, 'ms');
}

function stop() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  console.log('OTEL Exporter stopped');
}

function flush() {
  return Promise.all([exportSpans(), exportLogs()])
    .then(([spanResult, logResult]) => ({ spans: spanResult.count, logs: logResult.count, errors: [] }))
    .catch(err => ({ spans: 0, logs: 0, errors: [err.message] }))
    .finally(() => {
      state.lastExportAt = new Date().toISOString();
      cleanupExportedSpans();
    });
}

function exportSpans() {
  const spans = listSpans(OTEL_EXPORT_BATCH_SIZE).filter(span => !state.exported.has(span.spanId));
  if (spans.length === 0) return Promise.resolve({ count: 0 });

  const data = formatSpans(spans);
  spans.forEach(span => state.exported.add(span.spanId));

  return _httpPost(`${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`, data)
    .then(() => ({ count: spans.length }))
    .catch(err => {
      state.errors.push(err.message);
      if (!OTEL_EXPORT_FAIL_SILENT) console.error(err);
      return { count: 0 };
    });
}

function exportLogs() {
  const logs = listLogs(OTEL_EXPORT_BATCH_SIZE);
  if (logs.length === 0) return Promise.resolve({ count: 0 });

  const data = formatLogs(logs);

  return _httpPost(`${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`, data)
    .then(() => ({ count: logs.length }))
    .catch(err => {
      state.errors.push(err.message);
      if (!OTEL_EXPORT_FAIL_SILENT) console.error(err);
      return { count: 0 };
    });
}

function formatSpans(spans) {
  return {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'ki-os' } },
          { key: 'service.version', value: { stringValue: process.env.npm_package_version || '1.8.1' } }
        ]
      },
      scopeSpans: [{
        scope: { name: 'ki-os.otel-lite' },
        spans: spans.map(span => ({
          traceId: hexify(span.traceId),
          spanId: hexify(span.spanId),
          name: span.name,
          kind: 1, // 1 for internal, adjust if needed
          startTimeUnixNano: span.startedAt * 1000000,
          endTimeUnixNano: (span.endedAtIso ? new Date(span.endedAtIso).getTime() : Date.now()) * 1000000,
          status: { code: span.status === 'ok' ? 1 : 2 },
          attributes: getAttributes(span.attributes)
        }))
      }]
    }]
  };
}

function formatLogs(logs) {
  return {
    resourceLogs: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'ki-os' } },
          { key: 'service.version', value: { stringValue: process.env.npm_package_version || '1.8.1' } }
        ]
      },
      scopeLogs: [{
        scope: { name: 'ki-os.otel-lite' },
        logRecords: logs.map(log => ({
          timeUnixNano: new Date(log.timestamp).getTime() * 1000000,
          severityText: log.severity,
          body: { stringValue: log.event },
          attributes: getAttributes(log.attributes)
        }))
      }]
    }]
  };
}

function _httpPost(url, body, retries = OTEL_EXPORT_RETRY) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: options.hostname,
      port: options.port,
      path: options.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...OTEL_EXPORTER_HEADERS
      }
    }, res => {
      if (res.statusCode >= 500 && retries > 0) {
        setTimeout(() => {
          _httpPost(url, body, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP error ${res.statusCode}: ${res.statusMessage}`));
      } else {
        resolve();
      }
    });

    req.on('error', err => {
      if (retries > 0) {
        setTimeout(() => {
          _httpPost(url, body, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(err);
      }
    });

    req.write(postData);
    req.end();
  });
}

function hexify(id) {
  return id.replace(/[^a-f0-9]/gi, '').padEnd(16, '0').slice(0, 16);
}

function getAttributes(attrs) {
  const genAiKeys = ['gen_ai.system', 'gen_ai.request.model', 'gen_ai.usage.input_tokens', 'gen_ai.usage.output_tokens'];
  const out = [];
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined) continue;
    if (v === null) { out.push({ key: k, value: { nullValue: {} } }); continue; }
    if (typeof v === 'object') out.push({ key: k, value: { stringValue: JSON.stringify(v).slice(0, 500) } });
    else out.push({ key: k, value: { stringValue: v } });
  }
  for (const key of genAiKeys) {
    if (!attrs[key]) continue;
    const value = attrs[key];
    out.push({ key: key, value: { stringValue: value } });
  }
  return out;
}

function _toNano(val) {
  return val ? val * 1000000 : Date.now() * 1000000;
}

function cleanupExportedSpans() {
  if (state.exported.size > 5000) {
    const excess = [...state.exported].slice(0, 2000);
    excess.forEach(spanId => state.exported.delete(spanId));
  }
}

function getStatus() {
  return {
    enabled: OTEL_EXPORTER_ENABLED,
    endpoint: OTEL_EXPORTER_OTLP_ENDPOINT,
    lastExportAt: state.lastExportAt,
    totalExported: state.totalExported,
    errors: state.errors
  };
}

module.exports = {
  start,
  stop,
  flush,
  getStatus
};
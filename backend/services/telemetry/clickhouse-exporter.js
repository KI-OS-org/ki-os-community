/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS ClickHouse Exporter
 * 
 * Exportiert OpenTelemetry Spans, Metrics und Logs zu ClickHouse.
 * Batch-Insert alle 5 Sekunden für Performance.
 * 
 * @module services/telemetry/clickhouse-exporter
 * @license AGPL-3.0
 */

'use strict';

const { getClickHouseClient } = require('./clickhouse.client');
const { bus } = require('../ui/ui.eventbus');

class ClickHouseExporter {
  constructor(options = {}) {
    this.client = getClickHouseClient();
    
    // Batch-Konfiguration
    this.batchSize = options.batchSize || 100;
    this.batchIntervalMs = options.batchIntervalMs || 5000;
    
    // Batches
    this.spansBatch = [];
    this.metricsBatch = [];
    this.logsBatch = [];
    this.costsBatch = [];
    
    // Timer
    this.flushTimer = null;
    
    // Stats
    this.stats = {
      spansExported: 0,
      metricsExported: 0,
      logsExported: 0,
      costsExported: 0,
      errors: 0,
    };
  }
  
  /**
   * Exporter starten
   */
  start() {
    console.log('[ClickHouseExporter] Starting with batch size:', this.batchSize);
    
    // Event-Subscriber registrieren
    bus.on('otel.span', (span) => this.onSpan(span));
    bus.on('otel.metric', (metric) => this.onMetric(metric));
    bus.on('otel.log', (log) => this.onLog(log));
    bus.on('llm.call.completed', (call) => this.onLlmCallCompleted(call));
    
    // Flush-Timer starten
    this.flushTimer = setInterval(() => this.flush(), this.batchIntervalMs);
    
    console.log('[ClickHouseExporter] Started');
  }
  
  /**
   * Exporter stoppen
   */
  async stop() {
    console.log('[ClickHouseExporter] Stopping...');
    
    // Timer stoppen
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Restliche Daten flushen
    await this.flush();
    
    // Event-Subscriber deregistrieren
    bus.off('otel.span', (span) => this.onSpan(span));
    bus.off('otel.metric', (metric) => this.onMetric(metric));
    bus.off('otel.log', (log) => this.onLog(log));
    bus.off('llm.call.completed', (call) => this.onLlmCallCompleted(call));
    
    console.log('[ClickHouseExporter] Stopped. Stats:', this.stats);
  }
  
  /**
   * Span empfangen
   */
  onSpan(span) {
    this.spansBatch.push({
      trace_id: span.traceId || 'unknown',
      span_id: span.spanId || 'unknown',
      parent_span_id: span.parentSpanId || null,
      service_name: span.serviceName || 'ki-os-backend',
      service_version: span.serviceVersion || '1.27.0',
      operation_name: span.operationName || 'unknown',
      span_kind: span.spanKind || 'internal',
      start_time: span.startTime || new Date().toISOString(),
      end_time: span.endTime || new Date().toISOString(),
      status: span.status || 'ok',
      status_message: span.statusMessage || null,
      attributes: span.attributes || {},
      resource: span.resource || {},
      host: span.host || 'localhost',
      environment: span.environment || 'production',
      timestamp: new Date().toISOString(),
    });
    
    if (this.spansBatch.length >= this.batchSize) {
      this.flushSpans();
    }
  }
  
  /**
   * Metric empfangen
   */
  onMetric(metric) {
    this.metricsBatch.push({
      metric_name: metric.name || 'unknown',
      metric_type: metric.type || 'gauge',
      value: metric.value || 0,
      labels: metric.labels || {},
      unit: metric.unit || '',
      service_name: metric.serviceName || 'ki-os-backend',
      resource: metric.resource || {},
      timestamp: new Date().toISOString(),
    });
    
    if (this.metricsBatch.length >= this.batchSize) {
      this.flushMetrics();
    }
  }
  
  /**
   * Log empfangen
   */
  onLog(log) {
    this.logsBatch.push({
      trace_id: log.traceId || null,
      span_id: log.spanId || null,
      level: log.level || 'info',
      severity: log.severity || 0,
      body: log.body || '',
      service_name: log.serviceName || 'ki-os-backend',
      attributes: log.attributes || {},
      resource: log.resource || {},
      timestamp: new Date().toISOString(),
    });
    
    if (this.logsBatch.length >= this.batchSize) {
      this.flushLogs();
    }
  }
  
  /**
   * LLM Call Completed (für Kosten-Tracking)
   */
  onLlmCallCompleted(call) {
    this.costsBatch.push({
      trace_id: call.traceId || 'unknown',
      span_id: call.spanId || 'unknown',
      cost_usd: call.costUsd || 0,
      provider: call.provider || 'unknown',
      model: call.model || 'unknown',
      input_tokens: call.inputTokens || 0,
      output_tokens: call.outputTokens || 0,
      agent_id: call.agentId || 'unknown',
      agent_role: call.agentRole || 'unknown',
      session_id: call.sessionId || null,
      user_id: call.userId || null,
      timestamp: new Date().toISOString(),
    });
    
    if (this.costsBatch.length >= this.batchSize) {
      this.flushCosts();
    }
  }
  
  /**
   * Alle Batches flushen
   */
  async flush() {
    await Promise.all([
      this.flushSpans(),
      this.flushMetrics(),
      this.flushLogs(),
      this.flushCosts(),
    ]);
  }
  
  /**
   * Spans flushen
   */
  async flushSpans() {
    if (this.spansBatch.length === 0) return;
    
    try {
      await this.client.insert('otel_spans', this.spansBatch);
      this.stats.spansExported += this.spansBatch.length;
      this.spansBatch = [];
    } catch (error) {
      console.error('[ClickHouseExporter] Flush spans error:', error.message);
      this.stats.errors++;
    }
  }
  
  /**
   * Metrics flushen
   */
  async flushMetrics() {
    if (this.metricsBatch.length === 0) return;
    
    try {
      await this.client.insert('otel_metrics', this.metricsBatch);
      this.stats.metricsExported += this.metricsBatch.length;
      this.metricsBatch = [];
    } catch (error) {
      console.error('[ClickHouseExporter] Flush metrics error:', error.message);
      this.stats.errors++;
    }
  }
  
  /**
   * Logs flushen
   */
  async flushLogs() {
    if (this.logsBatch.length === 0) return;
    
    try {
      await this.client.insert('otel_logs', this.logsBatch);
      this.stats.logsExported += this.logsBatch.length;
      this.logsBatch = [];
    } catch (error) {
      console.error('[ClickHouseExporter] Flush logs error:', error.message);
      this.stats.errors++;
    }
  }
  
  /**
   * Costs flushen
   */
  async flushCosts() {
    if (this.costsBatch.length === 0) return;
    
    try {
      await this.client.insert('otel_costs', this.costsBatch);
      this.stats.costsExported += this.costsBatch.length;
      this.costsBatch = [];
    } catch (error) {
      console.error('[ClickHouseExporter] Flush costs error:', error.message);
      this.stats.errors++;
    }
  }
  
  /**
   * Stats holen
   */
  getStats() {
    return {
      ...this.stats,
      batches: {
        spans: this.spansBatch.length,
        metrics: this.metricsBatch.length,
        logs: this.logsBatch.length,
        costs: this.costsBatch.length,
      },
    };
  }
}

// Singleton-Instance
let _instance = null;

function getClickHouseExporter(options = {}) {
  if (!_instance) {
    _instance = new ClickHouseExporter(options);
  }
  return _instance;
}

module.exports = {
  ClickHouseExporter,
  getClickHouseExporter,
};

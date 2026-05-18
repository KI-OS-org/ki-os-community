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
'use strict';
const os = require('os');
const { list } = require('./ui.eventbus');
const { getAuditEntries } = require('./ui.audit');
const { getDesktopStatus, getCompanionState } = require('../desktop/desktop.service');
const { loadModelCatalog, minimum } = require('../providers/models-services');
const { listWebhookConfigs } = require('../automation.config.service');
const workerRegistry = require('../core/worker.registry');
const { listRuns, getMetrics } = require('./runtime.store');
const Observability = require('../core/observability.service');
const OTel = require('../core/otel-lite.service');

function summarizeProviders(catalog = {}) {
  const providers = Object.keys(catalog.providers || {});
  return providers.map((name) => ({
    provider: name,
    defaultModel: catalog.providers[name]?.default || null,
    online: Boolean(catalog.providers[name]?.default) || catalog.providers[name]?.status === 'success'
  }));
}

function summarizeAgents(runs = []) {
  return runs.map((run) => ({
    agentId: run.agentId || run.runId,
    runId: run.runId,
    name: run.type || 'agent',
    type: run.type || 'agent',
    status: run.status,
    currentTask: run.task || '-',
    currentStep: run.steps?.length ? run.steps[run.steps.length - 1].name : '-',
    currentWorker: run.steps?.length ? run.steps[run.steps.length - 1].worker || '-' : '-',
    currentModel: run.steps?.length ? run.steps[run.steps.length - 1].model || '-' : '-',
    host: os.hostname(),
    startedAt: run.createdAt,
    updatedAt: run.updatedAt,
    durationMs: run.completedAt ? (new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime()) : (Date.now() - new Date(run.createdAt).getTime()),
    lastActivity: run.updatedAt
  })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}


function summarizeIncidents(events = [], audits = []) {
  const items = [];
  for (const event of events) {
    const type = String(event.event || event.type || '');
    if (/failed|escalated|blocked|security/.test(type)) {
      items.push({
        id: event.id,
        timestamp: event.timestamp,
        severity: /security/.test(type) ? 'high' : (/failed|escalated/.test(type) ? 'medium' : 'low'),
        type,
        traceId: event.traceId || null,
        runId: event.runId || null,
        summary: type
      });
    }
  }
  for (const audit of audits.slice(0, 10)) {
    items.push({ id: audit.id, timestamp: audit.timestamp, severity: 'info', type: audit.action, traceId: null, runId: null, summary: audit.action });
  }
  return items.sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp))).slice(0,20);
}

function summarizeSecurity(events = []) {
  return events.filter((event) => /security|policy|blocked|approval/.test(String(event.event || ''))).map((event) => ({
    id: event.id,
    timestamp: event.timestamp,
    type: event.event,
    traceId: event.traceId || null,
    runId: event.runId || null,
    summary: event.event
  })).slice(-20).reverse();
}

async function getCockpitPayload() {
  const [desktopStatus, companionState, catalog, webhooks] = await Promise.all([
    getDesktopStatus().catch(() => ({ enabled: false, success: false })),
    getCompanionState().catch(() => ({ sessions: [] })),
    loadModelCatalog().catch(() => minimum),
    listWebhookConfigs().catch(() => ({ items: [] }))
  ]);
  const events = list(150);
  const metrics = getMetrics();
  const snapshot = Observability.getSnapshot();
  const telemetry = OTel.getSnapshot();
  const audits = getAuditEntries(20);
  const agents = summarizeAgents(listRuns(100));
  const providers = summarizeProviders(catalog);
  const queueLength = Number(companionState?.queueLength || desktopStatus?.queueLength || 0);
  const desktopSessionsCount = Number(companionState?.sessions?.length || (desktopStatus?.enabled ? 1 : 0));

  return {
    success: true,
    summary: {
      activeAgentsCount: metrics.activeRuns,
      idleAgentsCount: Math.max(0, metrics.totalRuns - metrics.activeRuns - metrics.failedRuns),
      errorAgentsCount: metrics.failedRuns,
      runningJobsCount: metrics.activeRuns,
      queuedJobsCount: queueLength,
      desktopSessionsCount,
      providersOnline: providers.filter((p) => p.online).length,
      providersTotal: providers.length,
      averageLatencyMs: metrics.averageLatencyMs,
      totalRuns: metrics.totalRuns,
      completedRuns: metrics.completedRuns,
      lastCriticalAction: audits[0] || null
    },
    agents,
    events: events.slice(-25).reverse(),
    systemPulse: {
      backendHealth: 'online',
      daemonHealth: desktopStatus?.readiness ? 'online' : (desktopStatus?.enabled ? 'degraded' : 'disabled'),
      queueLength,
      lockState: desktopStatus?.lockState || null,
      catalogRefreshAt: catalog?.meta?.generatedAt || null,
      desktopStatus,
      providers,
      workers: Object.keys(workerRegistry.WORKER_DEFINITIONS || {}).length,
      configuredWebhooks: Array.isArray(webhooks?.items) ? webhooks.items.length : 0
    },
    incidents: summarizeIncidents(events, audits),
    security: summarizeSecurity(events),
    traces: OTel.listSpans(20),
    telemetry: telemetry.otel,
    observability: snapshot.observability,
    catalogMeta: catalog?.meta || null,
    hostname: os.hostname(),
    version: '6.2.1-r11-control-plane-otel'
  };
}

module.exports = { getCockpitPayload, summarizeAgents };

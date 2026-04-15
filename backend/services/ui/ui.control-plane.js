/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const { getCockpitPayload } = require('./ui.cockpit');
const { getPolicyDefinitions, evaluateToolPolicy, POLICY_VERSION } = require('../governance/policy.engine');
const tenantService = require('../tenant/tenant.service');
const { listRoutingDecisions, listRoutingScorecards } = require('../routing/dynamic-routing.service');
const { listDagDefinitions, getDagRegistryInfo } = require('../dag/dag.runtime.service');
const runtimeStore = require('./runtime.store');
const OTel = require('../core/otel-lite.service');
const Observability = require('../core/observability.service');

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function summarizeExecutions(runs = []) {
  const dagRuns = runs.filter((run) => run.type === 'dag');
  const waitingApprovals = runs.filter((run) => run.status === 'WAITING_APPROVAL').length;
  const completed = runs.filter((run) => run.status === 'COMPLETED').length;
  const failed = runs.filter((run) => run.status === 'FAILED').length;
  const total = runs.length || 1;
  return {
    totalRuns: runs.length,
    dagRuns: dagRuns.length,
    waitingApprovals,
    completed,
    failed,
    completionRate: Number((completed / total).toFixed(4)),
    failureRate: Number((failed / total).toFixed(4))
  };
}

function buildRoutingHighlights(limit = 5) {
  const scorecards = listRoutingScorecards(limit);
  const latest = listRoutingDecisions(limit);
  return {
    scorecards,
    latest,
    preferredProviders: scorecards.map((item) => ({ provider: item.provider, model: item.model, score: item.score, successRuns: item.successRuns, avgLatencyMs: item.avgLatencyMs }))
  };
}

function buildGovernanceHighlights(ctx = {}) {
  const tenantId = String(ctx?.pki?.tenantId || ctx?.tenantId || 'default');
  const tenantView = tenantService.getEffectivePolicyView(tenantId) || { tenantId, overrides: {}, policies: [] };
  const sampleAllow = evaluateToolPolicy({ tool: 'llm_invoke', action: 'chat', ctx: { ...ctx, pki: { ...(ctx.pki || {}), role: ctx?.pki?.role || 'admin', tenantId } }, payload: { provider: 'openai', model: 'gpt-5.4', budgetCents: 100, residency: tenantView.residency || 'eu' } });
  const sampleBlocked = evaluateToolPolicy({ tool: 'llm_invoke', action: 'chat', ctx: { ...ctx, pki: { ...(ctx.pki || {}), role: ctx?.pki?.role || 'admin', tenantId } }, payload: { provider: 'openrouter', model: 'gpt-5.4', budgetCents: safeNumber((tenantView.overrides || {}).maxBudgetCents, 0) + 1000, residency: 'us' } });
  return {
    policyVersion: POLICY_VERSION,
    tenantId,
    tenantView,
    policies: getPolicyDefinitions(),
    explain: [sampleAllow, sampleBlocked]
  };
}

function buildDagHighlights() {
  const definitions = listDagDefinitions();
  const runs = runtimeStore.listRuns(100).filter((run) => run.type === 'dag');
  const latest = runs.slice(0, 10).map((run) => ({
    runId: run.runId,
    task: run.task,
    status: run.status,
    updatedAt: run.updatedAt,
    branches: Array.isArray(run.outputs) ? run.outputs.filter((item) => item.type === 'dag.level').length : 0,
    coverage: safeNumber(run.outcome?.coverage, 0)
  }));
  return {
    definitions: definitions.map((dag) => ({ dagId: dag.dagId, name: dag.name, nodes: dag.nodes.length, edges: dag.edges.length })),
    totalDefinitions: definitions.length,
    activeDagRuns: runs.filter((run) => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)).length,
    latestRuns: latest,
    registry: getDagRegistryInfo()
  };
}

async function getVisibleControlPlanePayload(ctx = {}) {
  const cockpit = await getCockpitPayload();
  const runs = runtimeStore.listRuns(100);
  const executions = summarizeExecutions(runs);
  const routing = buildRoutingHighlights(8);
  const governance = buildGovernanceHighlights(ctx);
  const dag = buildDagHighlights();
  const telemetry = OTel.getSnapshot().otel;
  const observability = Observability.getSnapshot().observability;
  const topMetrics = {
    atcRate: executions.completionRate,
    escalationRate: Number(((executions.waitingApprovals || 0) / Math.max(1, executions.totalRuns || 1)).toFixed(4)),
    avgLatencyMs: safeNumber(cockpit.summary?.averageLatencyMs, 0),
    providersOnline: `${safeNumber(cockpit.summary?.providersOnline, 0)}/${safeNumber(cockpit.summary?.providersTotal, 0)}`,
    outcomeCoverage: safeNumber(runtimeStore.getMetrics().outcomeCoverage, 0)
  };
  return {
    success: true,
    ui: 'r28-visible-control-plane',
    generatedAt: new Date().toISOString(),
    topMetrics,
    cockpit,
    routing,
    governance,
    dag,
    executions,
    telemetry,
    observability
  };
}

module.exports = {
  getVisibleControlPlanePayload,
  buildGovernanceHighlights,
  buildRoutingHighlights,
  buildDagHighlights,
  summarizeExecutions
};

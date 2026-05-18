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
const fs = require('fs');
const path = require('path');
const { assertRole } = require('./ui.auth');
const { getCockpitPayload } = require('./ui.cockpit');
const { getVisibleControlPlanePayload } = require('./ui.control-plane');
const OTel = require('../core/otel-lite.service');
const Observability = require('../core/observability.service');
const { getModelsPayload, refreshModels } = require('./ui.models');
const { getAuditEntries, writeAudit } = require('./ui.audit');
const { list } = require('./ui.eventbus');
const { listRuns, getRun } = require('./runtime.store');
const { getDesktopStatus } = require('../desktop/desktop.service');
const { OS_VERSION } = require('../../../core/app');
const workerRegistry = require('../core/worker.registry');
const { getPolicyDefinitions, POLICY_VERSION } = require('../governance/policy.engine');
const { listApprovals } = require('../governance/approvals.store');
const { getPolicyRegistryPayload } = require('../governance/policy.registry');
const { detectPII } = require('../privacy/privacy.guard');
const { getCapabilityRegistryPayload, getFabricPayload } = require('../connectors/capability.registry');
const { getFabricPayload: getFileFabricPayload } = require('../files/file.fabric.service');
const { getRoutingProfiles, listRoutingDecisions, getRoutingScorecardPayload } = require('../routing/dynamic-routing.service');
const { getSupervisorPayload, buildSupervisorMesh, getRecoveryPlaybookPayload } = require('../supervisor/supervisor.service');
const { createMemoryAdapter } = require('../../memory');
const { summarizeSchema } = require('../memory/semantic-memory.service');
const { getWorkspacePayload } = require('../workspace/workspace.controller');
const { getPackRegistryPayload } = require('../packs/pack.service');

const CONSOLE_ASSETS = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['app.js', 'application/javascript; charset=utf-8'],
  ['style.css', 'text/css; charset=utf-8']
]);

function getConsoleAsset(asset) {
  const normalized = path.basename(String(asset || ''));
  if (normalized !== asset || !CONSOLE_ASSETS.has(normalized)) {
    const error = new Error('Invalid console asset');
    error.statusCode = 400;
    throw error;
  }
  const assetPath = path.join(process.cwd(), 'frontend', 'control-console', normalized);
  return {
    contentType: CONSOLE_ASSETS.get(normalized),
    body: fs.readFileSync(assetPath, 'utf8')
  };
}

async function handleUiRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  if (pathname === '/console' && method === 'GET') {
    const asset = getConsoleAsset('index.html');
    return { statusCode: 200, headers: { 'content-type': asset.contentType }, body: asset.body };
  }
  if (pathname === '/console/app.js' && method === 'GET') {
    const asset = getConsoleAsset('app.js');
    return { statusCode: 200, headers: { 'content-type': asset.contentType }, body: asset.body };
  }
  if (pathname === '/console/style.css' && method === 'GET') {
    const asset = getConsoleAsset('style.css');
    return { statusCode: 200, headers: { 'content-type': asset.contentType }, body: asset.body };
  }
  if (pathname === '/ui/config' && method === 'GET') {
    return {
      statusCode: 200,
      body: {
        success: true,
        version: OS_VERSION,
        controlConsole: true,
        transport: { events: 'sse+poll', commands: 'rest' },
        cockpitStartscreen: true,
        roles: ['admin', 'operator', 'viewer', 'auditor', 'user'],
        tauri: { scaffolded: true, wrapper: 'tauri' },
        connectors: { registry: true, preferredStandard: 'mcp', paths: ['/ui/connectors', '/connectors', '/mcp/capabilities'] }
      }
    };
  }
  if (pathname === '/ui/cockpit' && method === 'GET') return { statusCode: 200, body: await getCockpitPayload() };
  if (pathname === '/ui/control-plane' && method === 'GET') return { statusCode: 200, body: await getCockpitPayload() };
  if (pathname === '/ui/control-plane/visible' && method === 'GET') return { statusCode: 200, body: await getVisibleControlPlanePayload(ctx) };
  if (pathname === '/ui/policy/explain' && method === 'GET') { const payload = await getVisibleControlPlanePayload(ctx); return { statusCode: 200, body: { success: true, governance: payload.governance, traceId: ctx.traceId } }; }
  if (pathname === '/ui/providers/live' && method === 'GET') { const payload = await getVisibleControlPlanePayload(ctx); return { statusCode: 200, body: { success: true, routing: payload.routing, traceId: ctx.traceId } }; }
  if (pathname === '/ui/dag/live' && method === 'GET') { const payload = await getVisibleControlPlanePayload(ctx); return { statusCode: 200, body: { success: true, dag: payload.dag, executions: payload.executions, traceId: ctx.traceId } }; }
  if (pathname === '/ui/incidents' && method === 'GET') { const payload = await getCockpitPayload(); return { statusCode: 200, body: { success: true, items: payload.incidents || [] } }; }
  if (pathname === '/ui/security' && method === 'GET') { const payload = await getCockpitPayload(); return { statusCode: 200, body: { success: true, items: payload.security || [] } }; }
  if (pathname === '/ui/traces' && method === 'GET') return { statusCode: 200, body: { success: true, items: OTel.listSpans(Number(body.limit || 50)), telemetry: OTel.getSnapshot().otel } };
  if (pathname === '/ui/telemetry' && method === 'GET') return { statusCode: 200, body: { success: true, observability: Observability.getSnapshot().observability, telemetry: OTel.getSnapshot().otel } };
  if (pathname === '/ui/models' && method === 'GET') return { statusCode: 200, body: await getModelsPayload(false, ctx) };
  if (pathname === '/ui/models/refresh' && method === 'POST') return { statusCode: 200, body: await refreshModels(ctx) };
  if (pathname === '/ui/audit' && method === 'GET') return { statusCode: 200, body: { success: true, items: getAuditEntries(Number(body.limit || 100)) } };
  if (pathname === '/ui/events' && method === 'GET') return { statusCode: 200, body: { success: true, items: list(Number(body.limit || 100)).reverse() } };
  if (pathname === '/ui/logs' && method === 'GET') return { statusCode: 200, body: { success: true, items: list(Number(body.limit || 100)).reverse() } };
  if (pathname === '/ui/desktop' && method === 'GET') return { statusCode: 200, body: { success: true, status: await getDesktopStatus() } };
  if (pathname === '/ui/workers' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: Object.values(workerRegistry.WORKER_DEFINITIONS || {}) } };
  }

  if (pathname === '/ui/governance/policies' && method === 'GET') {
    return { statusCode: 200, body: { success: true, version: POLICY_VERSION, items: getPolicyDefinitions() } };
  }
  if (pathname === '/ui/governance/approvals' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: listApprovals(Number(body.limit || 100)) } };
  }
  if (pathname === '/ui/governance/registry' && method === 'GET') {
    return { statusCode: 200, body: getPolicyRegistryPayload() };
  }
  if (pathname === '/ui/privacy' && method === 'GET') {
    const sample = String(body.text || 'Max Mueller, max@example.com, +49 170 1234567, Hofrat-Strobel-Str. 6');
    return { statusCode: 200, body: { success: true, sampleAnalysis: detectPII(sample) } };
  }

  if (pathname === '/ui/connectors' && method === 'GET') {
    return { statusCode: 200, body: getCapabilityRegistryPayload() };
  }
  if (pathname === '/ui/connectors/fabric' && method === 'GET') {
    return { statusCode: 200, body: getFabricPayload() };
  }
  if (pathname === '/ui/workspace' && method === 'GET') return { statusCode: 200, body: getWorkspacePayload(body, ctx) };
  if (pathname === '/ui/workspace/operator' && method === 'GET') return { statusCode: 200, body: getWorkspacePayload(Object.assign({}, body, { role: 'operator' }), Object.assign({}, ctx, { pki: Object.assign({}, ctx.pki || {}, { role: 'operator' }) })) };
  if (pathname === '/ui/workspace/user' && method === 'GET') return { statusCode: 200, body: getWorkspacePayload(Object.assign({}, body, { role: 'user' }), Object.assign({}, ctx, { pki: Object.assign({}, ctx.pki || {}, { role: 'user' }) })) };
  if (pathname === '/ui/workspace/whiteboard' && method === 'GET') return { statusCode: 200, body: { success: true, items: getWorkspacePayload(body, ctx).workspace.sharedWhiteboard || [] } };
  if (pathname === '/ui/packs' && method === 'GET') return { statusCode: 200, body: Object.assign({ ui: true, traceId: ctx.traceId }, getPackRegistryPayload()) };

  if (pathname === '/ui/files' && method === 'GET') {
    return { statusCode: 200, body: getFileFabricPayload() };
  }

  if (pathname === '/ui/routing/profiles' && method === 'GET') {
    return { statusCode: 200, body: await getRoutingProfiles() };
  }
  if (pathname === '/ui/routing/decisions' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: listRoutingDecisions(Number(body.limit || 50)) } };
  }
  if (pathname === '/ui/routing/scorecards' && method === 'GET') {
    return { statusCode: 200, body: getRoutingScorecardPayload(Number(body.limit || 50)) };
  }

  if (pathname === '/ui/supervisor' && method === 'GET') {
    return { statusCode: 200, body: getSupervisorPayload() };
  }
  if (pathname === '/ui/supervisor/mesh' && method === 'GET') {
    return { statusCode: 200, body: buildSupervisorMesh(Number(body.limit || 25)) };
  }
  if (pathname === '/ui/supervisor/playbooks' && method === 'GET') {
    return { statusCode: 200, body: getRecoveryPlaybookPayload() };
  }

  if ((pathname === '/ui/memory' || pathname === '/ui/memory/graph') && method === 'GET') {
    const memory = createMemoryAdapter();
    const { buildGraph } = require('../memory/semantic-memory.service');
    const userId = body.userId || ctx?.pki?.userId || 'guest';
    const limit = Number(body.limit || 25);
    const items = await memory.listByUser(userId, limit);
    if (pathname === '/ui/memory/graph') {
      return { statusCode: 200, body: { success: true, userId, graph: buildGraph(items) } };
    }
    return { statusCode: 200, body: { success: true, userId, total: items.length, items, schema: summarizeSchema(items) } };
  }

  if (pathname === '/ui/runs' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: listRuns(Number(body.limit || 50)) } };
  }
  if (pathname.startsWith('/ui/tasks/') && method === 'GET') {
    const runId = decodeURIComponent(pathname.split('/').pop());
    const run = getRun(runId);
    return run ? { statusCode: 200, body: { success: true, item: run } } : { statusCode: 404, body: { success: false, error: 'run_not_found', runId } };
  }
  if (pathname.startsWith('/ui/runs/') && method === 'GET') {
    const runId = decodeURIComponent(pathname.split('/').pop());
    const run = getRun(runId);
    return run ? { statusCode: 200, body: { success: true, item: run } } : { statusCode: 404, body: { success: false, error: 'run_not_found', runId } };
  }
  if (pathname === '/ui/audit/write' && method === 'POST') {
    const entry = writeAudit(body.action || 'ui.manual', body.details || {}, ctx);
    return { statusCode: 200, body: { success: true, entry } };
  }
  return { statusCode: 404, body: { success: false, error: 'Unknown UI route', path: pathname, method } };
}

module.exports = { handleUiRequest, getConsoleAsset };

/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Datei: core/app.js (Community Edition)
 * Zentraler HTTP-Router — enthält ausschließlich Community-Features.
 * Enterprise-Routen (DAG, Tenant, Retail, Federation, Economic, State Fabric,
 * Workspace, Desktop, Packs) sind in dieser Edition nicht enthalten.
 */

'use strict';
const OS_VERSION   = require('../package.json').version;
const logger       = require('../backend/services/core/logger.service');
const Observability = require('../backend/services/core/observability.service');
const { assertRole }      = require('../backend/services/ui/ui.auth');
const { assertRateLimit } = require('../backend/services/core/rate-limit.service');
const { evaluatePolicy }  = require('../backend/services/governance/policy.engine');
const { createApprovalRequest } = require('../backend/services/governance/approvals.store');
const runtimeStore = require('../backend/services/ui/runtime.store');

async function buildHealthPayload(runtime = 'core') {
  const checks = {};
  let status = 'ok';
  try {
    checks.runtime = { ok: true, metrics: runtimeStore.getMetrics() };
  } catch (e) {
    checks.runtime = { ok: false, error: e.message };
    status = 'down';
  }
  try {
    const { createMemoryAdapter } = require('../backend/memory');
    checks.memory = await createMemoryAdapter().health();
    checks.memory.ok = checks.memory.ok !== false;
  } catch (e) {
    checks.memory = { ok: false, error: e.message };
    if (status !== 'down') status = 'degraded';
  }
  try {
    const { getCapabilityRegistryPayload } = require('../backend/services/connectors/capability.registry');
    const registry = getCapabilityRegistryPayload();
    checks.connectors = { ok: true, total: registry.total || 0 };
  } catch (e) {
    checks.connectors = { ok: false, error: e.message };
    if (status !== 'down') status = 'degraded';
  }
  try {
    const { getSupervisorPayload } = require('../backend/services/supervisor/supervisor.service');
    const supervisor = getSupervisorPayload();
    checks.supervisor = { ok: true, escalationCount: supervisor.escalationCount || 0 };
  } catch (e) {
    checks.supervisor = { ok: false, error: e.message };
    if (status !== 'down') status = 'degraded';
  }
  for (const value of Object.values(checks)) {
    if (value && value.ok === false && status === 'ok') status = 'degraded';
  }
  return { status, os_level: OS_VERSION, edition: 'community', runtime, checks };
}

function parseBody(rawBody, isBase64Encoded) {
  if (!rawBody) return {};
  try {
    const text = isBase64Encoded ? Buffer.from(rawBody, 'base64').toString('utf8') : rawBody;
    return typeof text === 'string' ? JSON.parse(text) : text;
  } catch { return {}; }
}

function getCorsOrigin(headers = {}) {
  const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:*,file://').split(',').map(s => s.trim()).filter(Boolean);
  const reqOrigin = headers.origin || headers.Origin || '';
  if (allowed.includes('*')) return '*';
  // Community: allow localhost and file:// origins
  if (!reqOrigin || reqOrigin.startsWith('http://localhost') || reqOrigin.startsWith('file://')) return reqOrigin || '*';
  return allowed.includes(reqOrigin) ? reqOrigin : (allowed[0] || '*');
}

function getPki() {
  try {
    const { PKIIntegration } = require('../backend/services/pki.integration');
    return new PKIIntegration();
  } catch {
    return { extractAuth: async () => ({ authenticated: true, userId: 'local', tenantId: 'default', role: 'admin' }) };
  }
}

function isTestAuthOverrideAllowed(request = {}) {
  return request.runtime === 'test' && process.env.NODE_ENV === 'test' &&
    String(process.env.KI_OS_ALLOW_TEST_AUTH_OVERRIDE || 'true').toLowerCase() === 'true';
}

function getServices() {
  return {
    handleChat:        () => require('../backend/services/chat.controller').handleChat,
    starter:           () => require('../backend/services/demo/demo.news.service'),
    handleMemory:      () => require('../backend/services/memory.controller').handleMemory,
    handleJobsQuery:   () => require('../backend/services/jobs.controller').handleJobsQuery,
    media:             () => require('../backend/services/media.controller'),
    handleAdminRequest:() => require('../backend/services/admin.controller').handleAdminRequest,
    handleDocProcess:  () => require('../backend/services/doc.controller').handleDocProcess,
    handleFeedback:    () => require('../backend/services/feedback.controller').handleFeedback,
    automation:        () => require('../backend/services/automation.webhook.service'),
    ui:                () => require('../backend/services/ui/ui.routes'),
    routing:           () => require('../backend/services/routing/routing.controller'),
    connectors:        () => require('../backend/services/connectors/connectors.controller'),
    mcp:               () => require('../backend/services/connectors/mcp.controller'),
    files:             () => require('../backend/services/files/files.controller'),
    supervisor:        () => require('../backend/services/supervisor/supervisor.controller'),
    governance:        () => require('../backend/services/governance/governance.controller'),
    privacy:           () => require('../backend/services/privacy/privacy.controller'),
    agentmesh:         () => require('../backend/services/agentmesh/agentmesh.controller'),
    meshRuntime:       () => require('../backend/services/agentmesh/mesh.runtime.controller'),
    simulations:       () => require('../backend/services/simulations/simulations.controller'),
    agentRegistry:     () => require('../backend/services/agent/agent.registry.service'),
    selfRepair:        () => require('../backend/services/selfrepair/selfrepair.controller'),
    efficiency:        () => require('../backend/services/efficiency/efficiency.controller'),
    authController:    () => require('../backend/services/auth/auth.controller'),
    campaigns:         () => require('../backend/services/campaigns/campaign.controller'),
    notifications:     () => require('../backend/services/notifications/notification.controller'),
  };
}

function matchHubRoute(path, prefix) {
  const regex = new RegExp(`^${prefix}/([^/]+)/([^/]+)$`);
  const match = String(path || '').match(regex);
  if (!match) return null;
  return { hub: decodeURIComponent(match[1]), flowId: decodeURIComponent(match[2]) };
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createApp() {
  async function handleHttp(request = {}) {
    const headers   = request.headers || {};
    const method    = request.method || request.httpMethod || request.requestContext?.http?.method || 'GET';
    const path      = String(request.path || request.rawPath || '/').split('?')[0];
    const query     = request.query || request.queryStringParameters || {};
    const body      = request.body && typeof request.body === 'object' ? request.body : parseBody(request.body, request.isBase64Encoded);
    const corsOrigin = getCorsOrigin(headers);
    const traceId   = headers['x-trace-id'] || headers['X-Trace-Id'] || genId('trace');
    const requestObs = Observability.startRequest({ traceId, method, path, runtime: request.runtime || 'core' });

    if (method === 'OPTIONS') {
      return { statusCode: 204, headers: { 'access-control-allow-origin': corsOrigin, 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type,Authorization,X-User-Id,X-Role,X-Trace-Id,X-Provider' }, body: '' };
    }

    if (path === '/health' && method === 'GET') { const b = await buildHealthPayload(request.runtime || 'core'); b.traceId = traceId; const res = { statusCode: b.status === 'down' ? 503 : 200, headers: { 'x-trace-id': traceId }, body: b }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
    if (path === '/ready'  && method === 'GET') { const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: { ready: true, edition: 'community', runtime: request.runtime || 'core', traceId } }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
    if (path === '/status' && method === 'GET') { const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: Object.assign({ traceId, os_level: OS_VERSION, edition: 'community', runtime: request.runtime || 'core' }, Observability.getSnapshot()) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
    if (path === '/metrics'&& method === 'GET') { const s = Observability.getSnapshot(); const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: Object.assign({ traceId }, s.observability, { runtime: s.runtime, telemetry: s.telemetry }) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
    if (path === '/otel/tracez'    && method === 'GET')  { const OTel = require('../backend/services/core/otel-lite.service'); const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: { success: true, items: OTel.listSpans(Number(query.limit || 50)), telemetry: OTel.getSnapshot().otel, traceId } }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
    if (path === '/otel/exporters' && method === 'GET')  { const OTel = require('../backend/services/core/otel-lite.service'); const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: { success: true, items: OTel.listExporters(), telemetry: OTel.getSnapshot().otel, traceId } }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
    if (path === '/otel/export/test' && method === 'POST') { const OTel = require('../backend/services/core/otel-lite.service'); const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: OTel.exportTest(body || {}) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }

    if (path.startsWith('/auth')) {
      const services = getServices();
      const result = await services.authController().handleAuthRequest(path, method, method === 'GET' ? query : body, headers);
      result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId });
      Observability.completeRequest(requestObs, { statusCode: result.statusCode });
      return result;
    }

    const pki = getPki();
    const authContext = await pki.extractAuth({ headers });
    if (isTestAuthOverrideAllowed(request) && headers['x-role']) {
      authContext.role = String(headers['x-role']).toLowerCase();
      authContext.authenticated = headers['x-user-id'] ? true : authContext.authenticated;
      authContext.userId   = headers['x-user-id']   || authContext.userId;
      authContext.tenantId = headers['x-tenant-id'] || headers['X-Tenant-Id'] || authContext.tenantId;
    }
    const ctx      = { headers, pki: authContext, traceId, requestId: genId('req'), runtime: request.runtime || 'core' };
    const services = getServices();

    try {
      if (path !== '/health' && path !== '/ready') {
        assertRateLimit({ path, method, headers, ctx });
      }

      const webhookRoute = matchHubRoute(path, '/v1/hubs/webhook');
      if (webhookRoute && method === 'POST') {
        const decision = evaluatePolicy({ tool: 'webhook_trigger', action: 'trigger', ctx, payload: body });
        if (decision.decision === 'deny') { const res = { statusCode: 403, headers: { 'x-trace-id': traceId }, body: { success: false, error: 'forbidden_by_policy', policy: decision, traceId } }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
        if (decision.decision === 'escalate') { const approval = createApprovalRequest({ traceId, tool: 'webhook_trigger', action: 'trigger', reason: decision.reason, requestedBy: authContext.userId || 'guest', tenantId: 'default', role: authContext.role || 'guest', payload: body }); Observability.emit('governance.approval.requested', { approvalId: approval.approvalId }); const res = { statusCode: 202, headers: { 'x-trace-id': traceId }, body: { success: true, approvalRequired: true, approval, policy: decision } }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
        const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.automation().triggerHubWebhook(webhookRoute.hub, webhookRoute.flowId, { data: body, user: authContext, source: 'http_api' }) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res;
      }

      const callbackRoute = matchHubRoute(path, '/v1/hubs/callback');
      if (callbackRoute && method === 'POST') { const result = await services.automation().handleHubCallback(callbackRoute.hub, callbackRoute.flowId, body, ctx); const res = { statusCode: result.success ? 200 : 401, headers: { 'x-trace-id': traceId }, body: result }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }

      if (path === '/automation/webhook' && method === 'POST') { const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.automation().handleAutomationWebhook(body, ctx) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }

      if (path === '/connectors' || path === '/connectors/fabric' || path === '/connectors/capabilities' || path === '/connectors/resolve' || path === '/connectors/health' || path.startsWith('/connectors/')) { const result = await services.connectors().handleConnectorRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }
      if (path === '/mcp' || path === '/mcp/capabilities' || path === '/mcp/health' || path === '/mcp/invoke' || path === '/mcp/manifest') { const result = await services.mcp().handleMcpRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }
      if (path === '/files' || path === '/files/upload' || path === '/files/fabric' || path.startsWith('/files/')) { const result = await services.files().handleFileRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }
      if (path === '/routing' || path === '/routing/resolve' || path === '/routing/profiles' || path === '/routing/decisions' || path === '/routing/scorecards') { const result = await services.routing().handleRoutingRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }
      if (path === '/supervisor' || path === '/supervisor/escalations' || path === '/supervisor/recoveries' || path === '/supervisor/playbooks' || path === '/supervisor/mesh' || path === '/supervisor/recover') { const result = await services.supervisor().handleSupervisorRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }
      if (path === '/governance/policies' || path === '/governance/registry' || path === '/governance/simulate') { const result = await services.governance().handleGovernanceRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }
      if (path === '/privacy' || path === '/privacy/analyze' || path === '/privacy/mask' || path === '/privacy/demask') { const result = await services.privacy().handlePrivacyRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }

      if (path === '/agents' || path === '/agents/stats' || path.startsWith('/agents/')) { const result = services.agentRegistry().handleAgentRegistryRequest(path, method, method === 'GET' ? query : body); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return { statusCode: result.statusCode, headers: { 'x-trace-id': traceId }, body: result.body }; }

      if (path.startsWith('/agentmesh')) {
        if (path === '/agentmesh/runs' || path.startsWith('/agentmesh/runs/')) { const result = await services.meshRuntime().handleMeshRuntimeRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }
        const result = await services.agentmesh().handleAgentMeshRequest(path, method, method === 'GET' ? query : body); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result;
      }
      if (path.startsWith('/simulations')) { const result = await services.simulations().handleSimulationsRequest(path, method, method === 'GET' ? query : body); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }

      if (path === '/__worker' && method === 'POST') { const { runWorker } = require('../backend/services/worker'); const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await runWorker(body) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
      if ((path === '/chat' || path === '/' || path === '/v1/chat') && method === 'POST') { const r = await services.handleChat()(body, ctx); const sc = r.success ? 200 : (/security policy|blocked|trust gate|unauthorized|supervisor_escalated/i.test(r.error || '') ? 403 : /input_text required/i.test(r.error || '') ? 400 : 500); const res = { statusCode: sc, headers: { 'x-trace-id': traceId }, body: r }; Observability.completeRequest(requestObs, { statusCode: res.statusCode, runId: r?.meta?.runId }); return res; }

      if (path.startsWith('/admin')) { assertRole(ctx, ['admin']); const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.handleAdminRequest()(path, method, body) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
      if (path === '/feedback')      { const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.handleFeedback()(body) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
      if (path.startsWith('/jobs'))  { const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.handleJobsQuery()({ id: body.id || query.id }) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
      if (path === '/memory/retrieve' || path.startsWith('/memory')) { const effectiveMethod = path === '/memory/retrieve' && method === 'GET' ? 'GET' : method; const payload = path === '/memory/retrieve' && method === 'POST' ? Object.assign({}, body, { action: 'retrieve' }) : body; const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.handleMemory()(effectiveMethod, payload, { search: new URLSearchParams(query) }) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
      if (path === '/document/process') { const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.handleDocProcess()(body) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
      if (path === '/media/image')  { const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.media().handleMediaImage(body) };  Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
      if (path === '/media/video')  { const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.media().handleMediaVideo(body) };  Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }
      if (path === '/media/status') { const res = { statusCode: 200, headers: { 'x-trace-id': traceId }, body: await services.media().handleMediaStatus(query) }; Observability.completeRequest(requestObs, { statusCode: res.statusCode }); return res; }

      if (path === '/selfrepair' || path === '/selfrepair/stats' || path === '/selfrepair/trigger' || path.startsWith('/selfrepair/')) { const result = await services.selfRepair().handleSelfRepairRequest(path, method, method === 'GET' ? query : body, ctx); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return { statusCode: result.statusCode, headers: { 'x-trace-id': traceId }, body: result.body }; }
      if (path === '/campaign' || path.startsWith('/campaign/')) { const result = await services.campaigns().handleCampaignRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }
      if (path === '/notifications' || path === '/notifications/feed' || path === '/notifications/count' || path === '/notifications/mark-all-read' || path.startsWith('/notifications/')) { const result = await services.notifications().handleNotificationRequest(path, method, method === 'GET' ? query : body, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }
      if (path.startsWith('/efficiency')) { const effCtrl = services.efficiency(); const fakeRes = { json: (data) => ({ statusCode: 200, headers: { 'x-trace-id': traceId }, body: data }), status: (code) => ({ json: (data) => ({ statusCode: code, headers: { 'x-trace-id': traceId }, body: data }) }) }; const result = await effCtrl.handleRequest({ url: path, method, query, body }, fakeRes); Observability.completeRequest(requestObs, { statusCode: result?.statusCode || 200 }); return result || { statusCode: 200, headers: { 'x-trace-id': traceId }, body: {} }; }

      if (path === '/console' || path === '/console/app.js' || path === '/console/style.css' || path.startsWith('/ui/')) { const uiBody = method === 'GET' ? query : body; const result = await services.ui().handleUiRequest(path, method, uiBody, ctx); result.headers = Object.assign({}, result.headers || {}, { 'x-trace-id': traceId }); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return result; }

      if (path.startsWith('/starter')) { const result = await services.starter().handleStarterRequest(path, method); Observability.completeRequest(requestObs, { statusCode: result.statusCode }); return { statusCode: result.statusCode, headers: { 'x-trace-id': traceId }, body: result.body }; }

      const res = { statusCode: 404, headers: { 'x-trace-id': traceId }, body: { error: 'Not Found', path, method } };
      Observability.completeRequest(requestObs, { statusCode: res.statusCode });
      return res;

    } catch (error) {
      const statusCode = error.statusCode || (/unauthorized/i.test(error.message) ? 401 : /forbidden/i.test(error.message) ? 403 : 500);
      const errorClass = Observability.failRequest(requestObs, error, { statusCode });
      const logLevel = (statusCode === 401 || statusCode === 403) ? 'warn' : 'error';
      logger[logLevel]('http.request.failed', { traceId, path, method, statusCode, errorClass, error: error.message });
      if (statusCode >= 500) {
        try { const { captureError } = require('../backend/services/selfrepair/selfrepair.service'); captureError({ error: error.message, stack: error.stack || '', source: path, context: { traceId, method, statusCode } }).catch(() => {}); } catch {}
      }
      return { statusCode, headers: { 'x-trace-id': traceId }, body: { success: false, error: error.message, errorClass, traceId } };
    }
  }

  return { OS_VERSION, handleHttp };
}

module.exports = { createApp, OS_VERSION, matchHubRoute };

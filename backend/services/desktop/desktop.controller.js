/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const {
  getDesktopStatus,
  captureScreenshot,
  observeDesktop,
  performDesktopAction,
  stopDesktopActions,
  clearStopFlag,
  lockDesktopSession,
  unlockDesktopSession
} = require('./desktop.service');
const { push } = require('../ui/ui.eventbus');
const { writeAudit } = require('../ui/ui.audit');
const { createRun, transitionRun, appendError, appendOutput, setExpectedOutcome, appendObservedOutcome } = require('../ui/runtime.store');
const { assertRole } = require('../ui/ui.auth');
const { evaluatePolicy } = require('../governance/policy.engine');
const { createApprovalRequest } = require('../governance/approvals.store');
const Observability = require('../core/observability.service');

function statusFromResult(result) {
  if (result?.approvalRequired) return 202;
  if (result?.success) return 200;
  const error = String(result?.error || '');
  if (/missing_parameter|invalid_parameter|unsupported_action/.test(error)) return 400;
  if (/locked/.test(error)) return 423;
  if (/disabled|unsupported/.test(error)) return 503;
  if (/user_active|takeover|stop_requested/.test(error)) return 409;
  if (/unauthorized|forbidden/.test(error)) return 403;
  return 500;
}

function assertDesktopAccess(path, method, ctx = {}) {
  if (path === '/desktop/status' && method === 'GET') return assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);
  return assertRole(ctx, ['admin', 'operator']);
}

function resolveTool(path, body = {}) {
  if (path === '/desktop/status') return { tool: 'desktop_status', action: 'status' };
  if (path === '/desktop/observe') return { tool: 'desktop_observe', action: 'observe' };
  if (path === '/desktop/screenshot') return { tool: 'desktop_screenshot', action: 'screenshot' };
  if (path === '/desktop/action') return { tool: 'desktop_action', action: body?.action || 'unknown' };
  if (path === '/desktop/stop') return { tool: 'desktop_stop', action: 'stop' };
  if (path === '/desktop/session/lock') return { tool: 'desktop_session_lock', action: 'lock' };
  if (path === '/desktop/session/unlock') return { tool: 'desktop_session_unlock', action: 'unlock' };
  return { tool: 'desktop_unknown', action: 'unknown' };
}

async function handleDesktopRequest(path, method, body = {}, ctx = {}) {
  assertDesktopAccess(path, method, ctx);
  const identity = resolveTool(path, body);
  const run = createRun({
    traceId: ctx.traceId,
    sessionId: body?.sessionId || null,
    agentId: body?.sessionId || 'desktop',
    userId: ctx?.pki?.userId || 'guest',
    tenantId: ctx?.pki?.tenantId || 'default',
    type: 'desktop',
    task: `${method} ${path}`
  });

  push('desktop.status', { runId: run.runId, agentId: body?.sessionId || 'desktop', type: 'desktop', step: `${method} ${path}` });
  setExpectedOutcome(run.runId, { key: `${identity.tool}.completed`, path, action: identity.action });
  transitionRun(run.runId, 'EXECUTING', { stepName: path, worker: 'desktop' });

  if (path === '/desktop/status' && method === 'GET') {
    const result = await getDesktopStatus();
    appendOutput(run.runId, { type: 'status', status: result });
    appendObservedOutcome(run.runId, { key: 'desktop_status.completed', success: !!result?.enabled || result?.success !== false });
    transitionRun(run.runId, 'COMPLETED', { stepName: 'status', worker: 'desktop' });
    return { statusCode: 200, body: result };
  }

  const decision = evaluatePolicy({ tool: identity.tool, action: identity.action, ctx, payload: body });
  if (decision.decision === 'deny') {
    appendError(run.runId, { message: 'governance_denied', policy: decision });
    transitionRun(run.runId, 'FAILED', { stepName: 'policy_denied', worker: 'governance' });
    return { statusCode: 403, body: { success: false, error: 'forbidden_by_policy', policy: decision, runId: run.runId } };
  }
  if (decision.decision === 'escalate') {
    const approval = createApprovalRequest({
      runId: run.runId,
      traceId: ctx.traceId,
      tool: identity.tool,
      action: identity.action,
      reason: decision.reason,
      requestedBy: ctx?.pki?.userId || 'guest',
      tenantId: ctx?.pki?.tenantId || 'default',
      role: ctx?.pki?.role || 'guest',
      payload: body
    });
    Observability.emit('governance.approval.requested', { runId: run.runId, approvalId: approval.approvalId, tool: identity.tool, action: identity.action });
    appendOutput(run.runId, { type: 'approval_request', approval });
    transitionRun(run.runId, 'WAITING_APPROVAL', { stepName: 'approval_required', worker: 'governance' });
    return { statusCode: 202, body: { success: true, approvalRequired: true, approval, policy: decision, runId: run.runId } };
  }

  let result;
  if (path === '/desktop/observe' && method === 'POST') result = await observeDesktop(body || {});
  else if (path === '/desktop/screenshot' && method === 'POST') result = await captureScreenshot(body || {});
  else if (path === '/desktop/action' && method === 'POST') result = await performDesktopAction(body || {}, ctx);
  else if (path === '/desktop/stop' && method === 'POST') result = await stopDesktopActions(body?.reason || 'manual_stop');
  else if (path === '/desktop/session/lock' && method === 'POST') result = await lockDesktopSession(body || {});
  else if (path === '/desktop/session/unlock' && method === 'POST') result = body?.clearStop ? await clearStopFlag() : await unlockDesktopSession(body || {});
  else {
    transitionRun(run.runId, 'FAILED', { stepName: 'unsupported_route', worker: 'desktop' });
    return { statusCode: 404, body: { success: false, error: 'Unsupported desktop route', path, method } };
  }

  if (['/desktop/action', '/desktop/stop', '/desktop/session/lock', '/desktop/session/unlock'].includes(path) && method === 'POST') {
    writeAudit(`desktop.${path.split('/').filter(Boolean).slice(-1)[0]}`, { type: 'desktop', path, body, policy: decision }, ctx);
  }
  if (result?.success) {
    appendOutput(run.runId, { type: 'desktop_result', result });
    appendObservedOutcome(run.runId, { key: `${identity.tool}.completed`, success: true, action: identity.action });
    transitionRun(run.runId, 'COMPLETED', { stepName: path, worker: 'desktop' });
  } else {
    appendError(run.runId, { message: result?.error || 'desktop_failed' });
    transitionRun(run.runId, 'FAILED', { stepName: path, worker: 'desktop' });
  }
  push(result?.success ? 'desktop.completed' : 'desktop.failed', { runId: run.runId, agentId: body?.sessionId || 'desktop', type: 'desktop', step: path, details: { success: !!result?.success } });
  return { statusCode: statusFromResult(result), body: { ...result, runId: run.runId, policy: decision } };
}

module.exports = { handleDesktopRequest, statusFromResult };

/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const fs = require('fs');
const path = require('path');

function getStorePath() {
  return process.env.APPROVALS_STORE_PATH || path.join(process.cwd(), '.ki-os-approvals.json');
}

let store = { approvals: [] };

function now() { return new Date().toISOString(); }

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function load() {
  try {
    store = JSON.parse(fs.readFileSync(getStorePath(), 'utf8'));
    if (!Array.isArray(store.approvals)) store = { approvals: [] };
  } catch {
    store = { approvals: [] };
  }
  return store;
}

function persist() {
  ensureDirFor(getStorePath());
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf8');
}

function createApprovalRequest(payload = {}) {
  load();
  const item = {
    approvalId: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'PENDING',
    createdAt: now(),
    updatedAt: now(),
    runId: payload.runId || null,
    traceId: payload.traceId || null,
    tool: payload.tool || 'unknown',
    action: payload.action || null,
    reason: payload.reason || 'approval_required',
    requestedBy: payload.requestedBy || 'guest',
    tenantId: payload.tenantId || 'default',
    role: payload.role || 'guest',
    payload: payload.payload || {}
  };
  store.approvals.push(item);
  persist();
  return item;
}

function listApprovals(limit = 100) {
  load();
  return store.approvals.slice(-Math.max(1, Number(limit || 100))).reverse();
}

function resetApprovals() {
  store = { approvals: [] };
  try { fs.rmSync(getStorePath(), { force: true }); } catch {}
}

load();

module.exports = { createApprovalRequest, listApprovals, resetApprovals, _storePath: getStorePath };

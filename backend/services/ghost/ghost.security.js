/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Ghost Control — Plan security, persistence and audit helpers.
 *
 * @module services/ghost/ghost.security.js
 * @license AGPL-3.0-only
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const PLAN_SIGNATURE_VERSION = 'hmac-sha256-v1';

function getStorePath() {
  return process.env.GHOST_SESSION_STORE_FILE || path.join(process.cwd(), '.ki-os-ghost-sessions.json');
}

function getAuditPath() {
  return process.env.GHOST_AUDIT_FILE || process.env.UI_AUDIT_PATH || path.join(process.cwd(), '.ki-os-audit.ndjson');
}

function getSecret() {
  return process.env.GHOST_PLAN_SECRET
    || process.env.KI_OS_SERVER_SECRET
    || process.env.JWT_SECRET
    || 'ki-os-dev-ghost-secret-change-me';
}

function safeCtx(ctx = {}) {
  const headers = ctx.headers || {};
  const pki = ctx.pki || {};
  const forwardedFor = String(headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '').split(',')[0].trim();
  return {
    userId: pki.userId || ctx.userId || 'ghost-system',
    tenantId: pki.tenantId || ctx.tenantId || 'default',
    role: pki.role || ctx.role || 'user',
    traceId: ctx.traceId || headers['x-trace-id'] || headers['X-Trace-Id'] || null,
    ip: ctx.ip || forwardedFor || headers['x-real-ip'] || headers['X-Real-IP'] || 'unknown',
    route: ctx.route || ctx.path || null,
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function unsignedPlan(plan = {}) {
  const { signature, signatureVersion, ...rest } = plan;
  return rest;
}

function signingPayload(plan, ctx = {}) {
  const safe = safeCtx(ctx);
  return stableJson({
    plan: unsignedPlan(plan),
    binding: {
      userId: safe.userId,
      tenantId: safe.tenantId,
      sessionId: plan.sessionId || null,
    },
  });
}

function createPlanSignature(plan, ctx = {}) {
  return crypto.createHmac('sha256', getSecret()).update(signingPayload(plan, ctx)).digest('hex');
}

function signPlan(plan, ctx = {}) {
  const signed = {
    ...plan,
    signatureVersion: PLAN_SIGNATURE_VERSION,
  };
  signed.signature = createPlanSignature(signed, ctx);
  return signed;
}

function assertValidPlanSignature(plan, ctx = {}) {
  if (!plan || typeof plan !== 'object') throw new Error('plan_missing');
  if (plan.signatureVersion !== PLAN_SIGNATURE_VERSION) throw new Error('plan_signature_version_invalid');
  if (!/^[a-f0-9]{64}$/i.test(String(plan.signature || ''))) throw new Error('plan_signature_missing');

  const expected = createPlanSignature(plan, ctx);
  const actual = String(plan.signature);
  const ok = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
  if (!ok) throw new Error('plan_signature_invalid');
  return true;
}

async function atomicWriteJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

async function readStore() {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf-8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeStore(store) {
  await atomicWriteJson(getStorePath(), store);
}

async function storePlan(plan, ctx = {}, metadata = {}) {
  const safe = safeCtx(ctx);
  const signedPlan = signPlan(plan, safe);
  const store = await readStore();
  store[signedPlan.sessionId] = {
    ...(store[signedPlan.sessionId] || {}),
    sessionId: signedPlan.sessionId,
    planId: signedPlan.id,
    plan: signedPlan,
    userId: safe.userId,
    tenantId: safe.tenantId,
    role: safe.role,
    status: metadata.status || 'planned',
    mode: signedPlan.mode,
    goal: metadata.goal || null,
    route: safe.route,
    ip: safe.ip,
    createdAt: store[signedPlan.sessionId]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return signedPlan;
}

function assertSessionBinding(record, ctx = {}) {
  const safe = safeCtx(ctx);
  if (!record) throw new Error('plan_not_found');
  if (record.userId !== safe.userId || record.tenantId !== safe.tenantId) {
    throw new Error('plan_session_binding_mismatch');
  }
}

async function loadStoredPlan({ plan, planId, sessionId } = {}, ctx = {}) {
  const store = await readStore();
  const wantedSessionId = sessionId || plan?.sessionId || null;
  const wantedPlanId = planId || plan?.id || null;
  const record = wantedSessionId
    ? store[wantedSessionId]
    : Object.values(store).find(item => item && item.planId === wantedPlanId);

  if (!record || !record.plan) throw new Error('plan_not_found');
  if (wantedPlanId && record.planId !== wantedPlanId) throw new Error('plan_id_mismatch');
  if (wantedSessionId && record.sessionId !== wantedSessionId) throw new Error('plan_session_mismatch');

  assertSessionBinding(record, ctx);
  assertValidPlanSignature(record.plan, ctx);

  if (plan && plan.signature && plan.signature !== record.plan.signature) {
    throw new Error('plan_signature_mismatch');
  }

  return { plan: record.plan, record, store };
}

async function updateSession(sessionId, patch = {}) {
  const store = await readStore();
  if (!store[sessionId]) throw new Error('Session not found');
  store[sessionId] = {
    ...store[sessionId],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return store[sessionId];
}

async function writeGhostAudit(action, details = {}, ctx = {}) {
  const safe = safeCtx(ctx);
  const entry = {
    id: `ghost-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    timestamp: new Date().toISOString(),
    userId: safe.userId,
    tenantId: safe.tenantId,
    role: safe.role,
    ip: safe.ip,
    route: safe.route,
    traceId: safe.traceId,
    details,
  };
  await fs.mkdir(path.dirname(getAuditPath()), { recursive: true });
  await fs.appendFile(getAuditPath(), `${JSON.stringify(entry)}\n`, 'utf-8');
  return entry;
}

module.exports = {
  PLAN_SIGNATURE_VERSION,
  atomicWriteJson,
  assertSessionBinding,
  assertValidPlanSignature,
  createPlanSignature,
  loadStoredPlan,
  readStore,
  safeCtx,
  signPlan,
  storePlan,
  updateSession,
  writeGhostAudit,
  writeStore,
};

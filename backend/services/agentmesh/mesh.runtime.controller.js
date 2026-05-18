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
/**
 * (c) 2026 KI-OS.org — AgentMesh Runtime Controller
 * Handles HTTP routes for the real AgentMesh execution runtime (mode=runtime).
 * Simulation routes (/agentmesh/analyze) are still handled by agentmesh.controller.js.
 *
 * Routes:
 *   POST   /agentmesh/runs                    — start new run
 *   GET    /agentmesh/runs                    — list runs
 *   GET    /agentmesh/runs/:runId             — run detail
 *   GET    /agentmesh/runs/:runId/events      — SSE / polling events
 *   POST   /agentmesh/runs/:runId/cancel      — cancel run
 *   POST   /agentmesh/runs/:runId/retry       — retry a FAILED or CANCELLED run
 */
'use strict';

const store                = require('./mesh.store');
const { createMeshRun }    = require('./mesh.models');
const { executeMeshRun, requestCancel } = require('./mesh.runtime');
const { enforceConcurrentLimit } = require('../core/runtime.policy');
const { list: listEvents } = require('../ui/ui.eventbus');
const logger               = require('../core/logger.service');
const { isEnterprise }     = require('../blauer-elefant/edition.guard');

function now() { return new Date().toISOString(); }

function genRunId() {
  return `meshrun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Extract :runId from a path of the form /agentmesh/runs/<runId>[/...] */
function extractRunId(path) {
  const m = String(path || '').match(/^\/agentmesh\/runs\/([^/]+)/);
  return m ? m[1] : null;
}

/** Detect sub-path after :runId */
function extractSubPath(path) {
  const m = String(path || '').match(/^\/agentmesh\/runs\/[^/]+(\/.+)$/);
  return m ? m[1] : '';
}

// ─── route handlers ───────────────────────────────────────────────────────────

/**
 * POST /agentmesh/runs
 * Body: { task, userId?, tenantId? }
 * Returns: { runId, status, mode }
 */
// Max. 3 parallele Runs — Performance-Schutz für lokale Hardware, kein künstliches Feature-Gate.
// Wer das erhöhen will: hier ändern, eigene Verantwortung.
const COMMUNITY_PARALLEL_LIMIT = 3;

async function startRun(body, ctx) {
  const task = String(body.task || body.taskDescription || '').trim();
  if (!task) {
    return { statusCode: 400, body: { success: false, error: 'Field "task" is required.' } };
  }

  const { activeRuns } = store.getStoreStats();
  const limit = enforceConcurrentLimit(activeRuns);
  if (!limit.ok) {
    return { statusCode: limit.code || 429, body: { success: false, error: limit.message } };
  }

  // Community Edition: max 3 parallele Runs (PENDING + RUNNING)
  if (!isEnterprise()) {
    const active = store.listRuns({ limit: 100 }).runs
      .filter(r => r.status === 'PENDING' || r.status === 'RUNNING');
    if (active.length >= COMMUNITY_PARALLEL_LIMIT) {
      return {
        statusCode: 429,
        body: {
          success: false,
          error: `Community Edition: maximal ${COMMUNITY_PARALLEL_LIMIT} Agents können gleichzeitig laufen. Warte bis ein laufender Agent fertig ist.`,
          code:  'COMMUNITY_PARALLEL_LIMIT_EXCEEDED',
          limit: COMMUNITY_PARALLEL_LIMIT,
          active: active.length,
        },
      };
    }
  }

  const userId   = String(body.userId   || (ctx && ctx.pki && ctx.pki.userId)   || 'guest');
  const tenantId = String(body.tenantId || (ctx && ctx.pki && ctx.pki.tenantId) || 'default');
  const traceId  = String((ctx && ctx.traceId) || '');
  const runId    = genRunId();

  const runData = createMeshRun({ runId, taskDescription: task, userId, tenantId, traceId, mode: 'runtime' });
  store.createRun(runData);

  logger.info('mesh.run.queued', { runId, userId, tenantId });

  // Fire-and-forget execution — response is immediate with runId
  setImmediate(() => {
    executeMeshRun(runId, task, { userId, tenantId, traceId, pki: ctx ? ctx.pki : {} })
      .catch(err => logger.error('mesh.run.unhandled_error', { runId, error: err.message }));
  });

  return {
    statusCode: 202,
    body: { success: true, runId, status: 'PENDING', mode: 'runtime' }
  };
}

/**
 * GET /agentmesh/runs
 * Query: { limit?, status?, userId?, tenantId? }
 */
function listRunsHandler(query, ctx) {
  const limit    = Number(query.limit || 50);
  const status   = query.status   || undefined;
  const userId   = query.userId   || undefined;
  const tenantId = query.tenantId || undefined;
  const result   = store.listRuns({ limit, status, userId, tenantId });
  return {
    statusCode: 200,
    body: { success: true, runs: result.runs, total: result.total }
  };
}

/**
 * GET /agentmesh/runs/:runId
 */
function getRunHandler(runId) {
  const run = store.getRun(runId);
  if (!run) {
    return { statusCode: 404, body: { success: false, error: `Run ${runId} not found.` } };
  }
  return {
    statusCode: 200,
    body: { success: true, run, steps: run.steps || [] }
  };
}

/**
 * GET /agentmesh/runs/:runId/events
 * Returns the most recent UI event bus entries filtered by runId.
 * Polling fallback (no SSE transport in this handler layer).
 */
function getRunEvents(runId, query) {
  const limit  = Number(query.limit || 50);
  const events = listEvents(200).filter(e => e.runId === runId);
  return {
    statusCode: 200,
    body: {
      success: true,
      runId,
      events: events.slice(-limit),
      total:  events.length
    }
  };
}

/**
 * POST /agentmesh/runs/:runId/cancel
 * Sets run status to CANCELLED and signals the runtime to stop processing.
 */
function cancelRun(runId) {
  const run = store.getRun(runId);
  if (!run) {
    return { statusCode: 404, body: { success: false, error: `Run ${runId} not found.` } };
  }
  const terminal = ['COMPLETED', 'FAILED', 'CANCELLED'];
  if (terminal.includes(run.status)) {
    return { statusCode: 409, body: { success: false, error: `Run is already in terminal state: ${run.status}.` } };
  }
  // Signal the runtime execution loop to abort between agent calls
  requestCancel(runId);
  store.updateRun(runId, { status: 'CANCELLED', completedAt: now(), error: 'Cancelled by user request.' });
  logger.info('mesh.run.cancelled', { runId });
  return {
    statusCode: 200,
    body: { success: true, runId, status: 'CANCELLED' }
  };
}

/**
 * POST /agentmesh/runs/:runId/retry
 * Creates a new run with the same task for FAILED or CANCELLED runs.
 */
function retryRun(runId, body, ctx) {
  const run = store.getRun(runId);
  if (!run) {
    return { statusCode: 404, body: { success: false, error: `Run ${runId} not found.` } };
  }
  if (!['FAILED', 'CANCELLED'].includes(run.status)) {
    return { statusCode: 409, body: { success: false, error: `Only FAILED or CANCELLED runs can be retried. Current: ${run.status}` } };
  }

  const newRunId = genRunId();
  const newRun   = createMeshRun({
    runId:           newRunId,
    taskDescription: run.taskDescription,
    userId:          run.userId,
    tenantId:        run.tenantId,
    traceId:         run.traceId,
    mode:            'runtime',
    retryOf:         runId
  });
  store.createRun(newRun);

  logger.info('mesh.run.retry', { newRunId, retryOf: runId });

  setImmediate(() => {
    executeMeshRun(newRunId, run.taskDescription, { userId: run.userId, tenantId: run.tenantId })
      .catch(err => logger.error('mesh.run.retry.error', { newRunId, error: err.message }));
  });

  return { statusCode: 202, body: { success: true, runId: newRunId, status: 'PENDING', retryOf: runId } };
}

// ─── main request dispatcher ──────────────────────────────────────────────────

/**
 * @param {string} path
 * @param {string} method
 * @param {object} body - request body (POST) or query params (GET)
 * @param {object} ctx  - auth context from app.js
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function handleMeshRuntimeRequest(path, method, body, ctx) {
  try {
    const normalizedPath   = String(path   || '');
    const normalizedMethod = String(method || 'GET').toUpperCase();

    // POST /agentmesh/runs
    if (normalizedPath === '/agentmesh/runs' && normalizedMethod === 'POST') {
      return await startRun(body || {}, ctx);
    }

    // GET /agentmesh/runs
    if (normalizedPath === '/agentmesh/runs' && normalizedMethod === 'GET') {
      return listRunsHandler(body || {}, ctx);
    }

    const runId   = extractRunId(normalizedPath);
    const subPath = extractSubPath(normalizedPath);

    if (runId) {
      // GET /agentmesh/runs/:runId/events
      if (subPath === '/events' && normalizedMethod === 'GET') {
        return getRunEvents(runId, body || {});
      }

      // POST /agentmesh/runs/:runId/cancel
      if (subPath === '/cancel' && normalizedMethod === 'POST') {
        return cancelRun(runId);
      }

      // POST /agentmesh/runs/:runId/retry
      if (subPath === '/retry' && normalizedMethod === 'POST') {
        return retryRun(runId, body || {}, ctx);
      }

      // GET /agentmesh/runs/:runId
      if (subPath === '' && normalizedMethod === 'GET') {
        return getRunHandler(runId);
      }
    }

    return { statusCode: 404, body: { success: false, error: 'Route not found.' } };
  } catch (err) {
    logger.error('mesh.runtime.controller.error', { path, method, error: err.message });
    return {
      statusCode: err.statusCode || 500,
      body: { success: false, error: err.message }
    };
  }
}

module.exports = { handleMeshRuntimeRequest };

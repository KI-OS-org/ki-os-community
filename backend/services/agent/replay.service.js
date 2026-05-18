/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: replay.service.js
 * Replay / Re-Run light — Neustart eines AgentMesh-Runs ab LangGraph-Checkpoint oder Run-Registry.
 * @license AGPL-3.0-only
 */

'use strict';

const logger = require('../core/logger.service');

let langGraphModule = null;
let runRegistry = null;

try {
  langGraphModule = require('./langgraph.adapter');
} catch {
  logger.warn('replay.service: LangGraph adapter not available — replay limited to registry mode');
}

try {
  runRegistry = require('../registry/run.registry.service');
} catch {
  logger.warn('replay.service: Run registry not available');
}

const REPLAY_ENABLED = process.env.REPLAY_ENABLED !== 'false';

async function getCheckpoints(runId) {
  // Try run registry first (persistent)
  if (runRegistry) {
    try {
      const detail = runRegistry.getRunDetail(runId);
      if (detail && detail.stepCount > 0) {
        return Array.from({ length: detail.stepCount }, (_, i) => ({
          step: `step-${i + 1}`,
          success: detail.status === 'COMPLETED',
          ts: detail.finishedAt ? new Date(detail.finishedAt).getTime() : null,
        }));
      }
    } catch { /* graceful */ }
  }
  return [];
}

async function isReplayable(runId) {
  if (!REPLAY_ENABLED) return false;
  try {
    if (runRegistry) {
      const detail = runRegistry.getRunDetail(runId);
      if (!detail) return false;
      return ['COMPLETED', 'FAILED', 'ERROR'].includes(detail.status);
    }
  } catch { /* graceful */ }
  return false;
}

async function replay(runId, fromStep) {
  if (!REPLAY_ENABLED) throw new Error('Replay is disabled (REPLAY_ENABLED=false)');

  // Require run registry for metadata lookup
  if (!runRegistry) throw new Error('Run registry not available — cannot replay without run metadata');

  let detail;
  try {
    detail = runRegistry.getRunDetail(runId);
  } catch (err) {
    throw new Error(`Failed to load run ${runId}: ${err.message}`);
  }
  if (!detail) throw new Error(`Run ${runId} not found in registry`);

  logger.info('replay.start', { runId, fromStep: fromStep || 'last', originalGoal: detail.goal });

  // If LangGraph is available and AGENT_RUNTIME=langgraph, try graph-level resume
  if (langGraphModule && langGraphModule.isLangGraphEnabled && langGraphModule.isLangGraphEnabled()) {
    // Note: Graph-level resume requires the adapter instance from mesh.runtime.js.
    // Light replay falls back to re-queuing the run from scratch.
    logger.info('replay.langgraph_detected', { runId, note: 'full graph resume requires active adapter — using re-queue' });
  }

  // Light replay: record a new run entry as replay-triggered
  const replayRunId = `${runId}-replay-${Date.now().toString(36)}`;
  if (runRegistry) {
    try {
      runRegistry.recordRun({
        runId: replayRunId,
        goal: detail.goal,
        userId: detail.userId || 'system',
        status: 'REPLAY_QUEUED',
        stepCount: 0,
        costUsd: 0,
        startedAt: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }
  }

  logger.info('replay.queued', { originalRunId: runId, replayRunId, fromStep: fromStep || 'start' });

  return {
    success: true,
    replayRunId,
    originalRunId: runId,
    fromStep: fromStep || 'start',
    status: 'REPLAY_QUEUED',
    note: 'Re-queue light replay. Full LangGraph graph-resume available when adapter is passed in.',
  };
}

async function getReplayStatus(runId) {
  const checkpoints = await getCheckpoints(runId);
  const replayable = await isReplayable(runId);
  const lastStep = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].step : null;

  let status = 'unknown';
  if (runRegistry) {
    try {
      const detail = runRegistry.getRunDetail(runId);
      if (detail) status = detail.status;
    } catch { /* graceful */ }
  }

  return { runId, checkpoints, lastStep, replayable, status };
}

module.exports = { getCheckpoints, isReplayable, replay, getReplayStatus };

/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * @file    intent.router.js
 * @desc    Dispatcht erkannte User-Intents an dedizierte Handler (Ghost Control,
 *          AgentMesh, Agent-Factory). Gibt null zurück wenn kein Handler greift
 *          → chat.controller übernimmt als LLM-Fallback.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 */

'use strict';

const logger = require('../core/logger.service');
const { INTENT_TYPES } = require('./intent.parser.service');

// ---------------------------------------------------------------------------
// Handler: AGENT_CREATE
// ---------------------------------------------------------------------------
async function handleAgentCreate(intent, ctx, run) {
  const { transitionRun, appendOutput, appendError } = require('../ui/runtime.store');
  const { createDynamicAgent } = require('../agent/agent.factory.service');

  const description = intent.entities.agentDescription || intent.entities.raw || '';
  const name        = intent.entities.agentName || null;
  const category    = intent.entities.agentCategory || null;

  if (!description) return null; // Slot still missing — fall through to slot-filling

  try {
    transitionRun(run.runId, 'EXECUTING', { stepName: 'agent_create', worker: 'agent_factory' });
    const agent = await createDynamicAgent(description, { name, category, ctx });

    appendOutput(run.runId, { type: 'agent_created', agentId: agent.id, agentName: agent.name });
    transitionRun(run.runId, 'COMPLETED', { stepName: 'agent_created', worker: 'agent_factory' });

    return {
      success: true,
      content: `✅ Agent **${agent.name}** wurde erstellt.\n\nKategorie: ${agent.category} · Domain: ${agent.domain}\n\n${agent.description || ''}`,
      meta: {
        runId: run.runId,
        traceId: ctx.traceId,
        intentType: INTENT_TYPES.AGENT_CREATE,
        agentCreated: { id: agent.id, name: agent.name, category: agent.category },
      },
    };
  } catch (e) {
    appendError(run.runId, { message: e.message });
    transitionRun(run.runId, 'FAILED', { stepName: 'agent_create_failed', worker: 'agent_factory' });

    if (e.code === 'COMMUNITY_LIMIT_EXCEEDED') {
      return {
        success: false,
        content: `⚠️ **Community Edition Limit erreicht** — du hast bereits 3 Agents (Maximum für Community Edition).\n\nBitte lösche einen bestehenden Agent unter [/agents](/agents) oder upgrade auf Enterprise für unbegrenzte Agents.`,
        meta: { runId: run.runId, traceId: ctx.traceId, intentType: INTENT_TYPES.AGENT_CREATE, limitExceeded: true },
      };
    }
    logger.error('intent.router.agent_create_failed', { error: e.message, runId: run.runId });
    return null; // Fall through to normal chat on unexpected errors
  }
}

// ---------------------------------------------------------------------------
// Handler: AGENTMESH_RUN
// ---------------------------------------------------------------------------
async function handleAgentMeshRun(intent, ctx, run) {
  const { transitionRun, appendOutput } = require('../ui/runtime.store');
  const task = intent.entities.meshTask || intent.entities.raw || '';
  if (!task) return null;

  try {
    const { startMeshRun } = require('../agentmesh/mesh.runtime.controller');
    transitionRun(run.runId, 'EXECUTING', { stepName: 'agentmesh_dispatch', worker: 'agentmesh' });
    const meshRun = await startMeshRun({ task, ctx });
    appendOutput(run.runId, { type: 'agentmesh_run_started', runId: meshRun.runId });
    transitionRun(run.runId, 'COMPLETED', { stepName: 'agentmesh_dispatched', worker: 'agentmesh' });

    return {
      success: true,
      content: `🔀 AgentMesh Run gestartet (ID: \`${meshRun.runId}\`).\n\nDu kannst den Fortschritt unter [/agentmesh/runs](/agentmesh/runs) verfolgen.`,
      meta: {
        runId: run.runId,
        traceId: ctx.traceId,
        intentType: INTENT_TYPES.AGENTMESH_RUN,
        meshRunId: meshRun.runId,
      },
    };
  } catch (e) {
    logger.warn('intent.router.agentmesh_failed', { error: e.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handler: GHOST_CONTROL
// ---------------------------------------------------------------------------
async function handleGhostControl(intent, ctx, run) {
  const { transitionRun, appendOutput } = require('../ui/runtime.store');
  const goal = intent.entities.goalDescription || intent.entities.raw || '';
  const mode = intent.entities.mode || 'demo';

  if (!goal) return null;

  try {
    const { generatePlan } = require('../ghost/ghost.plan.service');
    transitionRun(run.runId, 'EXECUTING', { stepName: 'ghost_plan_generate', worker: 'ghost' });
    const result = await generatePlan(goal, mode);

    if (result.needsClarification) {
      appendOutput(run.runId, { type: 'ghost_clarification_needed', question: result.question });
      transitionRun(run.runId, 'COMPLETED', { stepName: 'ghost_clarification_needed', worker: 'ghost' });
      return {
        success: true,
        content: result.question,
        meta: { runId: run.runId, intentType: INTENT_TYPES.GHOST_CONTROL }
      };
    }

    appendOutput(run.runId, { type: 'ghost_plan_ready', plan: result.plan, needsClarification: false });
    transitionRun(run.runId, 'COMPLETED', { stepName: 'ghost_plan_generated', worker: 'ghost' });
    return {
      success: true,
      content: `Ich führe dich jetzt Schritt für Schritt: **${result.plan?.title || goal}**`,
      meta: { runId: run.runId, intentType: INTENT_TYPES.GHOST_CONTROL, planId: result.plan?.id }
    };
  } catch (e) {
    logger.warn('intent.router.ghost_control', { error: e.message, runId: run?.runId });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dispatch-Map
// ---------------------------------------------------------------------------
const HANDLERS = {
  [INTENT_TYPES.AGENT_CREATE]:  handleAgentCreate,
  [INTENT_TYPES.AGENTMESH_RUN]: handleAgentMeshRun,
  [INTENT_TYPES.GHOST_CONTROL]: handleGhostControl,
  // DAG_EXECUTE, DOCUMENT_PROCESS, DESKTOP_ACTION, MEMORY_SEARCH:
  // Kein dedizierter Handler — Chat-LLM antwortet mit kontextueller Hilfe
};

async function dispatch(intent, ctx, run) {
  const handler = HANDLERS[intent.intentType];
  if (!handler) return null;

  logger.info('intent.router.dispatch', {
    intentType: intent.intentType,
    confidence: intent.confidence,
    runId: run?.runId,
  });

  return handler(intent, ctx, run);
}

module.exports = { dispatch, HANDLERS };

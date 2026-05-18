/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: chat.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';
const { verifyAnswer } = require('./verifier.service');
const { applyTrustPolicy } = require('../policy/trust.policy');
const { frameTask } = require('./mesh/task.framing.service');
const { reviewOutput } = require('./mesh/critical.review.service');
const { resolveAgentRuntimeModels } = require('./providers/models-services');
const { push } = require('./ui/ui.eventbus');
const { createRun, transitionRun, appendOutput, appendError, getRun } = require('./ui/runtime.store');
const logger = require('./core/logger.service');
const Observability = require('./core/observability.service');

function isAgentMeshEnabled() {
  return String(process.env.AGENT_LAYER_ENABLED || process.env.AGENT_MESH_ENABLED || 'false').toLowerCase() === 'true';
}

function isIntakeEnabled() {
  return String(process.env.AGENT_INTAKE_ENABLED || 'false').toLowerCase() === 'true';
}

function isIntentRoutingEnabled() {
  return String(process.env.INTENT_ROUTING_ENABLED || 'false').toLowerCase() === 'true';
}


function safeFinalizeRun(runId, targetStatus, details = {}) {
  const current = typeof getRun === 'function' ? getRun(runId) : null;
  if (!current) return;
  if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(current.status)) return;
  const status = current.status;
  if (status === 'INTENT_RESOLVED') {
    transitionRun(runId, 'ROUTED', { stepName: 'chat_direct_routed', worker: 'chat' });
    transitionRun(runId, 'EXECUTING', { stepName: 'chat_direct_executing', worker: 'chat' });
  } else if (status === 'PLANNING') {
    transitionRun(runId, 'EXECUTING', { stepName: 'chat_direct_executing', worker: 'chat' });
  } else if (status === 'ROUTED') {
    transitionRun(runId, 'EXECUTING', { stepName: 'chat_direct_executing', worker: 'chat' });
  }
  transitionRun(runId, targetStatus, details);
}

function sanitizePrompt(text) {
  return String(text || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above)?\s*instructions/gi, '[filtered-instruction]')
    .replace(/(?:system|developer)\s+prompt/gi, '[filtered-system-prompt]')
    .trim();
}

async function handleChat(body, ctx = {}) {
  const rawQuery = body.message || body.query || body.input_text || '';
  const query = sanitizePrompt(rawQuery);
  const run = createRun({
    traceId: ctx.traceId,
    agentId: `chat-${Date.now()}`,
    userId: ctx?.pki?.userId || body.userId || 'guest',
    tenantId: ctx?.pki?.tenantId || body.tenantId || 'default',
    type: 'chat',
    task: query
  });
  try {
    if (!query.trim()) return { success: false, error: 'input_text required' };
    let framedTask = null;
    push('agent.started', { runId: run.runId, traceId: ctx.traceId, agentId: run.agentId, type: 'chat', task: query, step: 'intake' });
    transitionRun(run.runId, 'INTENT_RESOLVED', { stepName: 'intake', worker: 'chat' });
    logger.info('chat.started', { traceId: ctx.traceId, runId: run.runId, userId: run.userId });
    Observability.emit('chat.started', { traceId: ctx.traceId, runId: run.runId, agentId: run.agentId, userId: run.userId }, { runId: run.runId });

    // ── Intent-Routing (opt-in via INTENT_ROUTING_ENABLED=true) ──────────────
    if (isIntentRoutingEnabled() && query) {
      const intentParser = require('./routing/intent.parser.service');
      const intentRouter = require('./routing/intent.router');
      const parsed = await intentParser.parseIntent(query);

      if (parsed.isActionable) {
        // Missing required slots → ask user before dispatching
        if (parsed.missingSlots.length > 0) {
          transitionRun(run.runId, 'WAITING_APPROVAL', { stepName: 'slot_filling' });
          appendOutput(run.runId, { type: 'slot_question', intentType: parsed.intentType, question: parsed.slotQuestion });
          return {
            success: true,
            mode: 'slot_filling',
            intentType: parsed.intentType,
            content: parsed.slotQuestion,
            meta: { runId: run.runId, traceId: ctx.traceId, intentType: parsed.intentType },
          };
        }

        // All slots present — try dispatch
        const dispatched = await intentRouter.dispatch(parsed, ctx, run);
        if (dispatched !== null) {
          return Object.assign({}, dispatched, {
            meta: Object.assign({}, dispatched.meta || {}, { runId: run.runId, traceId: ctx.traceId }),
          });
        }
        // dispatch returned null → fall through to normal chat/agent flow
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (isIntakeEnabled() && query) {
      framedTask = frameTask({ ...body, message: query, query, input_text: query }, {
        language: ctx?.pki?.language || body.language || 'de',
        userDefaults: body.userDefaults || {},
        styleSamples: body.styleSamples || [],
        reviewerPersona: body.reviewerPersona || null
      });
      if (String(process.env.DOMAIN_AGENTS_ENABLED || 'false').toLowerCase() === 'true') {
        const { routeDomainTask } = require('./domain/domain.router');
        const domainRouting = routeDomainTask(framedTask, body);
        framedTask.domain_agent = domainRouting.selected;
        Object.assign(framedTask, domainRouting.enrichment || {});
      }
      if (framedTask.needs_clarification) {
        transitionRun(run.runId, 'WAITING_APPROVAL', { stepName: 'clarification' });
        appendOutput(run.runId, { type: 'clarification', questions: framedTask.questions || [] });
        return {
          success: true,
          mode: 'clarification',
          clarification: {
            domain: framedTask.domain,
            assumptions: framedTask.assumptions,
            summary: framedTask.summary,
            questions: framedTask.questions
          }
        };
      }
    }

    if (isAgentMeshEnabled() && query) {
      transitionRun(run.runId, 'PLANNING', { stepName: 'agent_planning', worker: 'multi' });
      const { getAgentLayer } = require('./agent/agent.layer');
      const runtimeModels = await resolveAgentRuntimeModels();
      const agentLayer = getAgentLayer({
        enabled: true,
        plannerModel: runtimeModels.plannerModel,
        synthesizerModel: runtimeModels.synthesizerModel,
        agenticThreshold: Number(process.env.AGENT_AGENTIC_THRESHOLD || 0.6)
      });
      const agentResult = await agentLayer.processQuery(query, {
        userId: ctx?.pki?.userId || body.userId || 'guest',
        tenantId: ctx?.pki?.tenantId || body.tenantId || 'default',
        language: ctx?.pki?.language || body.language || 'de',
        framedTask,
        traceId: ctx.traceId,
        runId: run.runId
      });

      if (agentResult.agentic && agentResult.success) {
        transitionRun(run.runId, 'VERIFYING', { stepName: 'verify', worker: 'verifier', model: runtimeModels?.synthesizerModel || null });
        const verification = await verifyAnswer({ answer: agentResult.answer.reply, sources: agentResult.execution?.result?.step_1?.sources || [], tier: 'KI+' });
        const trust = applyTrustPolicy(verification, { worker_type: 'multi', intent: framedTask?.domain === 'research' ? 'research' : 'general' }, { sources: agentResult.execution?.result?.step_1?.sources || [] });
        const review = reviewOutput({ task: framedTask || { task: query, domain: 'business' }, answer: agentResult.answer.reply, sources: agentResult.execution?.result?.step_1?.sources || [] }, { reviewerPersona: body.reviewerPersona || framedTask?.review_lens || null });
        if (trust.action === 'reject' || (review.status === 'revise' && String(process.env.AGENT_REVIEW_STRICT || 'false') === 'true')) {
          transitionRun(run.runId, 'FAILED', { stepName: 'trust_gate_reject', worker: 'verifier' });
          appendError(run.runId, { message: 'Agent Mesh blocked by trust/review policy' });
          return { success: false, error: 'Agent Mesh blocked by trust/review policy', meta: { verification, trust, review, mesh: agentResult.mesh } };
        }
        transitionRun(run.runId, 'COMPLETED', { stepName: 'answer_ready', worker: 'multi', model: runtimeModels?.synthesizerModel || null });
        appendOutput(run.runId, { type: 'answer', content: agentResult.answer.reply });
        push('agent.completed', { runId: run.runId, agentId: agentResult.mesh?.requestId || run.agentId, type: 'chat', task: query, worker: 'multi', model: runtimeModels?.synthesizerModel || null, step: 'answer_ready' });
        Observability.emit('chat.completed', { traceId: ctx.traceId, runId: run.runId, mode: 'agent_mesh', worker: 'multi' }, { runId: run.runId });
        return {
          success: true,
          content: agentResult.answer.reply,
          meta: {
            runId: run.runId,
            traceId: ctx.traceId,
            agentic: true,
            framedTask,
            mesh: agentResult.mesh,
            plan: agentResult.plan,
            execution: agentResult.execution,
            verification,
            trust,
            review
          }
        };
      }
    }
    const Kernel = require('../core/kernel');
    const result = await Kernel.executeRequest({ ...body, message: query, query, input_text: query }, { ...ctx, runId: run.runId });
    if (result?.success) {
      appendOutput(run.runId, { type: 'answer', content: result.content || result.reply || null });
      safeFinalizeRun(run.runId, 'COMPLETED', { stepName: 'kernel_complete', worker: 'kernel' });
    } else {
      appendError(run.runId, { message: result?.error || 'kernel_failed' });
      safeFinalizeRun(run.runId, 'FAILED', { stepName: 'kernel_failed', worker: 'kernel' });
    }
    push('agent.completed', { runId: run.runId, agentId: run.agentId, type: 'chat', task: query, worker: 'kernel', step: 'kernel_complete' });
    if (result?.success) Observability.emit('chat.completed', { traceId: ctx.traceId, runId: run.runId, mode: 'kernel', worker: 'kernel' }, { runId: run.runId });
    return Object.assign({}, result, { meta: Object.assign({}, result.meta || {}, { runId: run.runId, traceId: ctx.traceId }) });
  } catch (e) {
    transitionRun(run.runId, 'FAILED', { stepName: 'error', worker: 'chat' });
    appendError(run.runId, { message: e.message });
    push('agent.failed', { runId: run.runId, agentId: run.agentId, type: 'chat', step: 'error', details: { message: e.message } });
    logger.error('chat.failed', { traceId: ctx.traceId, runId: run.runId, error: e.message });
    Observability.emit('chat.failed', { traceId: ctx.traceId, runId: run.runId, error: e.message }, { runId: run.runId });
    return { success: false, error: e.message, meta: { runId: run.runId, traceId: ctx.traceId } };
  }
}
module.exports = { handleChat, isAgentMeshEnabled, isIntakeEnabled, sanitizePrompt };

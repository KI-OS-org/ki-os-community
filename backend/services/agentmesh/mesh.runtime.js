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
 * (c) 2026 KI-OS.org — AgentMesh Runtime Engine
 * Real multi-agent execution runtime — orchestrates 8 specialised agents:
 *   supervisor-v1 → policy-v1 → planner-v1 → researcher-v1 → memory-v1
 *   → executor-v1 → reviewer-v1 → synthesizer-v1
 *
 * Each agent writes its result back to the mesh store and emits UI events.
 * Error isolation: a failing agent marks its step FAILED but execution continues.
 *
 * Hardening features:
 *   - Run-level timeout (MESH_RUN_TIMEOUT_MS, default 5 min)
 *   - Cancellation signals (requestCancel / isCancelled)
 *   - Orphan recovery on startup (recoverOrphanRuns)
 *   - Execution strategy control (MESH_EXECUTION_STRATEGY: full|reduced|minimal)
 *   - Per-call model override support in llmCall()
 */
'use strict';

const store              = require('./mesh.store');
const { createMeshStep } = require('./mesh.models');
const { push: emitUI }   = require('../ui/ui.eventbus');
const { checkAgentLimit } = require('../../middleware/license.gate');
const logger             = require('../core/logger.service');
const { evaluatePolicy, evaluateToolPolicy } = require('../governance/policy.engine');
const { PlanningEngine } = require('../agent/planning.engine');
const { ExecutionEngine } = require('../agent/execution.engine');
const { evaluateReflection } = require('./reflection.service');
const memoryBroker       = require('../memory/memory.broker');
const runRegistry        = require('../registry/run.registry.service');
const reflectionEngine   = require('../reflection/reflection.service');
const roleRegistry       = require('./role-registry');
const writeFileTool      = require('./tools/write-file.tool');
const { writeAudit }     = require('../ui/ui.audit');

// Providers now handled by llm.router.js (with fallback chains + circuit breaker)

// ─── config ──────────────────────────────────────────────────────────────────

const RUN_TIMEOUT_MS = Number(process.env.MESH_RUN_TIMEOUT_MS || 300000); // 5 min default
const STRATEGY       = process.env.MESH_EXECUTION_STRATEGY || 'full';
const REFLECTION_MIN_SCORE = parseFloat(process.env.REFLECTION_MIN_SCORE || '0.7');
const REFLECTION_MAX_RETRIES = 2;

// ─── cancellation signals ────────────────────────────────────────────────────

/** @type {Map<string, boolean>} */
const cancelSignals = new Map();

function requestCancel(runId) {
  cancelSignals.set(runId, true);
}

function isCancelled(runId) {
  return !!cancelSignals.get(runId);
}

function clearCancel(runId) {
  cancelSignals.delete(runId);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }

function genStepId(role) {
  return `step-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── cost table (per 1K tokens) — Quelle: openrouter.ai, Stand: 2026-04-11 ──
// Input/Output separat für Genauigkeit. Blended = 40% Input / 60% Output (Faustregel Mesh).
// WICHTIG: Bei Budget-Reviews live von OpenRouter abrufen — Preise ändern sich.
const COST_INPUT_PER_1K = {
  'claude-haiku-4-5-20251001':  0.00100,  // Anthropic direkt: $1.00/1M
  'claude-sonnet-4-6':          0.00300,  // Anthropic direkt: $3.00/1M
  'gpt-4o-mini':                0.000150, // OpenAI direkt: $0.15/1M
  'qwen/qwen-2.5-72b-instruct': 0.000120, // OpenRouter: $0.12/1M
  'deepseek/deepseek-chat':     0.000320, // OpenRouter: $0.32/1M
  'deepseek/deepseek-r1':       0.000700, // OpenRouter: $0.70/1M
};
const COST_OUTPUT_PER_1K = {
  'claude-haiku-4-5-20251001':  0.00500,  // Anthropic direkt: $5.00/1M
  'claude-sonnet-4-6':          0.01500,  // Anthropic direkt: $15.00/1M
  'gpt-4o-mini':                0.000600, // OpenAI direkt: $0.60/1M
  'qwen/qwen-2.5-72b-instruct': 0.000390, // OpenRouter: $0.39/1M
  'deepseek/deepseek-chat':     0.000890, // OpenRouter: $0.89/1M
  'deepseek/deepseek-r1':       0.002500, // OpenRouter: $2.50/1M
};
// Blended (40% input / 60% output) für schnelle Schätzung ohne Token-Split
const COST_PER_1K = Object.fromEntries(
  Object.keys(COST_INPUT_PER_1K).map(m => [
    m,
    (COST_INPUT_PER_1K[m] * 0.4) + (COST_OUTPUT_PER_1K[m] * 0.6)
  ])
);

/** In-memory cost log: runId → [{ agent, model, provider, estimatedUSD }] */
const runCostLog = new Map();

function logCost(runId, agent, model, estimatedTokens) {
  const rate = COST_PER_1K[model] || 0.001; // unknown model → conservative fallback
  const estimatedUSD = (estimatedTokens / 1000) * rate;
  if (!runCostLog.has(runId)) runCostLog.set(runId, []);
  runCostLog.get(runId).push({ agent, model, provider: resolveProvider(model), estimatedTokens, estimatedUSD });
}

function resolveProvider(model) {
  if (!model) return 'anthropic';
  if (model.startsWith('qwen/') || model.startsWith('deepseek/')) return 'openrouter';
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  return 'anthropic';
}

function getCostSummary(runId) {
  const entries = runCostLog.get(runId) || [];
  const totalUSD = entries.reduce((s, e) => s + e.estimatedUSD, 0);
  // Compare against if all calls used Claude Haiku
  const claudeCost = entries.reduce((s, e) => s + (e.estimatedTokens / 1000) * COST_PER_1K['claude-haiku-4-5-20251001'], 0);
  const savedUSD   = Math.max(0, claudeCost - totalUSD);
  const savedPct   = claudeCost > 0 ? Math.round((savedUSD / claudeCost) * 100) : 0;
  const byAgent = entries.map(e => ({ agent: e.agent, model: e.model, costUSD: e.estimatedUSD, tokens: e.estimatedTokens }));
  return { entries, byAgent, totalUSD: +totalUSD.toFixed(6), savedUSD: +savedUSD.toFixed(6), savedPct, baseline: 'claude-haiku-4-5-20251001' };
}

const llmRouter = require('../core/llm.router');

/**
 * Calls the LLM Router — direct APIs first, OpenRouter fallback, circuit breaker + retry built in.
 * Cost tracking uses the requested model as billing approximation.
 */
async function llmCall({ systemPrompt, userPrompt, maxTokens = 1024, temperature = 0.3, model, runId, agent }) {
  const estimatedTokens = Math.round((systemPrompt || '').length / 4) + Math.round(userPrompt.length / 4) + maxTokens;
  const text = await llmRouter.call({ systemPrompt, userPrompt, maxTokens, temperature, model, runId, agent });
  if (runId) logCost(runId, agent, model || 'claude-haiku-4-5-20251001', estimatedTokens);
  return text;
}

/**
 * Parse JSON from an LLM response, stripping markdown code fences.
 */
function parseJson(text) {
  const stripped = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(stripped); } catch {
    const m = stripped.match(/\{[\s\S]+\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('LLM did not return valid JSON');
  }
}

// ─── execution strategy resolver ─────────────────────────────────────────────

/**
 * Resolve execution config from strategy and supervisor output.
 * MESH_EXECUTION_STRATEGY: full | reduced | minimal
 *
 * full    : all 8 agents
 * reduced : skip researcher/memory unless supervisor says otherwise; cheaper models for low complexity
 * minimal : supervisor → policy → executor → synthesizer only (4 agents, cheapest path)
 *
 * @param {object} supervisorOutput
 * @returns {{ runResearch: boolean, runMemory: boolean, runReviewer: boolean, model: string }}
 */
function getExecutionConfig(supervisorOutput) {
  // Role-specific model overrides (routed via OpenRouter if qwen/* or deepseek/*)
  const reviewerModel    = process.env.MESH_REVIEWER_MODEL    || null; // e.g. deepseek/deepseek-chat
  const researcherModel  = process.env.MESH_RESEARCHER_MODEL  || null; // e.g. qwen/qwen-2.5-72b-instruct

  if (STRATEGY === 'minimal') {
    return {
      runResearch: false,
      runMemory:   false,
      runReviewer: false,
      model:        process.env.MESH_MODEL_CHEAP || 'claude-haiku-4-5-20251001',
      reviewerModel,
      researcherModel
    };
  }
  if (STRATEGY === 'reduced') {
    return {
      runResearch:    !!(supervisorOutput && supervisorOutput.requiresResearch),
      runMemory:      !!(supervisorOutput && supervisorOutput.requiresMemory),
      runReviewer:    supervisorOutput ? supervisorOutput.complexity !== 'low' : true,
      model:          (supervisorOutput && supervisorOutput.complexity === 'high')
        ? (process.env.MESH_MODEL_FULL  || 'claude-haiku-4-5-20251001')
        : (process.env.MESH_MODEL_CHEAP || 'claude-haiku-4-5-20251001'),
      reviewerModel,
      researcherModel
    };
  }
  // full
  return {
    runResearch:    !!(supervisorOutput && supervisorOutput.requiresResearch),
    runMemory:      !!(supervisorOutput && supervisorOutput.requiresMemory),
    runReviewer:    true,
    model:          process.env.MESH_MODEL_FULL || 'claude-haiku-4-5-20251001',
    reviewerModel,
    researcherModel
  };
}

// ─── step lifecycle helpers ───────────────────────────────────────────────────

function beginStep(runId, role, description, inputs = {}) {
  const stepId = genStepId(role);
  const step = createMeshStep({ runId, stepId, agentId: `${role}-v1`, role, description, inputs });
  step.status = 'RUNNING';
  step.startedAt = now();
  store.addStep(runId, step);
  emitUI('mesh.step.started', { runId, stepId, role, description });
  logger.info('mesh.step.started', { runId, stepId, role });
  return stepId;
}

function completeStep(runId, stepId, outputs) {
  const completed = now();
  const updatedStep = store.updateStep(runId, stepId, { status: 'COMPLETED', completedAt: completed, outputs });
  emitUI('mesh.step.completed', { runId, stepId, outputs });
  logger.info('mesh.step.completed', { runId, stepId });
  const run = store.getRun(runId);
  const index = Array.isArray(run?.steps) ? run.steps.findIndex((step) => step.stepId === stepId) : -1;
  const startedMs = updatedStep?.startedAt ? Date.parse(updatedStep.startedAt) : NaN;
  const completedMs = completed ? Date.parse(completed) : NaN;
  writeAudit('agentmesh.step.completed', {
    runId,
    stepId: updatedStep?.stepId || stepId || `step-${index >= 0 ? index : 0}`,
    model: updatedStep?.model || updatedStep?.agentId || updatedStep?.role || null,
    inputLength: JSON.stringify(updatedStep?.input || updatedStep?.inputs || updatedStep?.prompt || '').length,
    outputLength: JSON.stringify(updatedStep?.output || updatedStep?.outputs || updatedStep?.result || '').length,
    durationMs: Number.isFinite(completedMs - startedMs) ? (completedMs - startedMs) : (updatedStep?.durationMs || 0),
    costUSD: updatedStep?.cost || updatedStep?.costUSD || 0
  });
  return outputs;
}

function failStep(runId, stepId, error) {
  const completed = now();
  const msg = error instanceof Error ? error.message : String(error || 'unknown');
  store.updateStep(runId, stepId, { status: 'FAILED', completedAt: completed, error: msg });
  emitUI('mesh.step.failed', { runId, stepId, error: msg });
  logger.error('mesh.step.failed', { runId, stepId, error: msg });
}

function skipStep(runId, stepId, role) {
  store.updateStep(runId, stepId, { status: 'SKIPPED', completedAt: now(), outputs: { skipped: true } });
  emitUI('mesh.step.skipped', { runId, stepId, role });
}

function extractDirectToolCall(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null;
  if (plan.tool !== 'write_file') return null;
  if (typeof plan.path !== 'string' || typeof plan.content !== 'string') return null;
  return {
    tool: plan.tool,
    path: plan.path,
    content: plan.content,
    mode: typeof plan.mode === 'string' ? plan.mode : 'overwrite'
  };
}

// ─── individual agent implementations ────────────────────────────────────────

/**
 * supervisor-v1: Assess the task and determine execution strategy.
 * Returns { strategy, requiresResearch, requiresMemory, complexity, estimatedSteps }
 */
async function runSupervisor(runId, taskDescription, ctx, model) {
  const stepId = beginStep(runId, 'supervisor', 'Validate task and set execution strategy', { taskDescription });
  try {
    const systemPrompt = `You are the Supervisor agent of KI-OS AgentMesh. Analyse the task and return ONLY valid JSON with no markdown.
Required format:
{
  "strategy": "research|analysis|execution|mixed",
  "requiresResearch": true|false,
  "requiresMemory": true|false,
  "complexity": "low|medium|high",
  "estimatedSteps": <number 1-8>
}`;
    const userPrompt = `Task: ${taskDescription.slice(0, 1500)}`;
    const text = await llmCall({ systemPrompt, userPrompt, maxTokens: 256, temperature: 0.1, model, runId, agent: 'supervisor' });
    const result = parseJson(text);
    return completeStep(runId, stepId, result);
  } catch (err) {
    failStep(runId, stepId, err);
    // Provide a safe default so the run can continue
    return { strategy: 'mixed', requiresResearch: false, requiresMemory: false, complexity: 'medium', estimatedSteps: 4 };
  }
}

/**
 * policy-v1: Evaluate task against governance rules.
 * Throws if policy denies the task.
 */
async function runPolicy(runId, taskDescription, ctx) {
  const stepId = beginStep(runId, 'policy', 'Check task against governance rules', { taskDescription });
  try {
    const decision = evaluatePolicy({
      tool:    'mesh_run',
      action:  'execute',
      ctx:     ctx || {},
      payload: { task: taskDescription }
    });
    const result = {
      allowed:        decision.decision === 'allow' || decision.decision === 'escalate',
      constraints:    [],
      reason:         decision.reason,
      policyDecision: decision
    };
    store.updateStep(runId, stepId, { policyDecision: decision });
    completeStep(runId, stepId, result);
    if (decision.decision === 'deny') {
      const err = new Error(`Policy denied: ${decision.reason}`);
      err.statusCode = 403;
      throw err;
    }
    return result;
  } catch (err) {
    if (err.statusCode === 403) throw err;
    // Policy engine unavailable — allow but warn
    failStep(runId, stepId, err);
    return { allowed: true, constraints: [], reason: 'policy_engine_unavailable' };
  }
}

/**
 * planner-v1: Create a step-by-step execution plan.
 */
async function runPlanner(runId, taskDescription, strategy, ctx) {
  const stepId = beginStep(runId, 'planner', 'Create step-by-step execution plan', { strategy });
  try {
    const planner = new PlanningEngine({ model: process.env.AGENT_PLANNER_MODEL || 'gpt-4o-mini' });
    const plan = await planner.createPlan(taskDescription, ctx || {});
    return completeStep(runId, stepId, plan);
  } catch (err) {
    failStep(runId, stepId, err);
    return { reasoning: 'Planner failed', steps: [], coordination_agents: [] };
  }
}

/**
 * researcher-v1: Perform web search and synthesise sources.
 * Skipped when requiresResearch is false.
 */
async function runResearcher(runId, taskDescription, requiresResearch, ctx, model) {
  const stepId = beginStep(runId, 'researcher', requiresResearch ? 'Web search and synthesis' : 'Research skipped (not required)', { requiresResearch });
  if (!requiresResearch) {
    store.updateStep(runId, stepId, { status: 'SKIPPED', completedAt: now(), outputs: { skipped: true } });
    emitUI('mesh.step.skipped', { runId, stepId, role: 'researcher' });
    return { sources: [], summary: '', skipped: true };
  }
  try {
    const webSearch = require('../websearch.service');
    const searchResult = await webSearch.search(taskDescription, 5);
    const sources = searchResult.sources || [];

    let summary = '';
    if (sources.length > 0) {
      const sourcesText = sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.description}`).join('\n');
      const systemPrompt = 'You are a research synthesizer. Summarise the following search results in 3-5 sentences relevant to the task.';
      const userPrompt   = `Task: ${taskDescription.slice(0, 500)}\n\nSearch results:\n${sourcesText}`;
      summary = await llmCall({ systemPrompt, userPrompt, maxTokens: 512, temperature: 0.3, model, runId, agent: 'researcher' });
    } else {
      summary = 'No search results available.';
    }

    return completeStep(runId, stepId, { sources, summary, provider: searchResult.provider });
  } catch (err) {
    failStep(runId, stepId, err);
    return { sources: [], summary: '', error: err.message };
  }
}

/**
 * memory-v1: Load relevant memory context for the user.
 * Skipped when requiresMemory is false.
 */
async function runMemory(runId, taskDescription, requiresMemory, ctx) {
  const stepId = beginStep(runId, 'memory', requiresMemory ? 'Load relevant memory context' : 'Memory skipped (not required)', { requiresMemory });
  if (!requiresMemory) {
    store.updateStep(runId, stepId, { status: 'SKIPPED', completedAt: now(), outputs: { skipped: true } });
    emitUI('mesh.step.skipped', { runId, stepId, role: 'memory' });
    return { context: '', memories: [], skipped: true };
  }
  try {
    const userId = (ctx && ctx.pki && ctx.pki.userId) || (ctx && ctx.userId) || 'guest';
    const enriched = await memoryBroker.enrichContext(runId, taskDescription, 'memory-v1', userId);
    const memories = await memoryBroker.retrieve(taskDescription.slice(0, 200), { userId, runId, agentRole: 'memory-v1' });
    return completeStep(runId, stepId, { context: enriched, memories: Array.isArray(memories) ? memories : [] });
  } catch (err) {
    failStep(runId, stepId, err);
    return { context: '', memories: [], error: err.message };
  }
}

/**
 * executor-v1: Execute the plan steps using the ExecutionEngine.
 */
async function runExecutor(runId, taskDescription, plan, ctx) {
  const stepId = beginStep(runId, 'executor', 'Execute plan steps', { planSteps: (plan.steps || []).length });
  try {
    const directToolCall = extractDirectToolCall(plan);
    if (directToolCall) {
      const policy = evaluateToolPolicy({
        tool: directToolCall.tool,
        action: 'executor',
        ctx: ctx || {},
        payload: {
          path: directToolCall.path,
          mode: directToolCall.mode,
          bytes: Buffer.byteLength(directToolCall.content, 'utf8')
        }
      });
      if (policy.decision === 'deny') {
        const denied = new Error(`tool_policy_denied:${policy.reason}`);
        denied.statusCode = 403;
        throw denied;
      }
      if (policy.decision === 'escalate') {
        const escalated = new Error(`tool_policy_escalated:${policy.reason}`);
        escalated.statusCode = 403;
        throw escalated;
      }
      const toolResult = await writeFileTool.execute(directToolCall, ctx || {});
      return completeStep(runId, stepId, {
        success: true,
        result: { direct_write_file: toolResult },
        checkpoints: [{ step: 'direct_write_file', tool: directToolCall.tool, agent_role: 'executor', attempt: 1, success: true }],
        ordered_steps: ['direct_write_file']
      });
    }

    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      const err = new Error('Executor received an empty or invalid plan — no steps to execute.');
      logger.warn('mesh.executor.empty_plan', { runId, taskLength: taskDescription.length });
      failStep(runId, stepId, err);
      return { success: false, result: {}, checkpoints: [], error: err.message };
    }
    const executor = new ExecutionEngine({
      maxRetries:     Number(process.env.AGENT_MAX_RETRIES || 1),
      continueOnError: true,
      totalTimeoutMs: Number(process.env.AGENT_EXECUTION_TIMEOUT || 60000)
    });
    const executionCtx = Object.assign({}, ctx, {
      query:    taskDescription,
      userId:   (ctx && ctx.pki && ctx.pki.userId)   || (ctx && ctx.userId)   || 'guest',
      tenantId: (ctx && ctx.pki && ctx.pki.tenantId) || (ctx && ctx.tenantId) || 'default'
    });
    const result = await executor.executePlan(plan, executionCtx);
    return completeStep(runId, stepId, result);
  } catch (err) {
    failStep(runId, stepId, err);
    return { success: false, result: {}, checkpoints: [], error: err.message };
  }
}

/**
 * reviewer-v1: Review the quality and accuracy of the execution result.
 * Returns { approved, score, issues, suggestions }
 */
async function runReviewer(runId, taskDescription, executionResult, ctx, model) {
  const stepId = beginStep(runId, 'reviewer', 'Review output quality and accuracy', {});
  try {
    const systemPrompt = `You are a quality reviewer for KI-OS AgentMesh. Evaluate the execution result against the original task. Return ONLY valid JSON with no markdown.
Required format:
{
  "approved": true|false,
  "score": <number 0.0-1.0>,
  "issues": ["<issue1>", ...],
  "suggestions": ["<suggestion1>", ...]
}`;
    const resultText = JSON.stringify(executionResult && executionResult.result ? executionResult.result : executionResult || {}).slice(0, 2000);
    const userPrompt = `Task: ${taskDescription.slice(0, 800)}\n\nExecution result:\n${resultText}`;
    const text = await llmCall({ systemPrompt, userPrompt, maxTokens: 512, temperature: 0.2, model, runId, agent: 'reviewer' });
    const result = parseJson(text);
    return completeStep(runId, stepId, result);
  } catch (err) {
    failStep(runId, stepId, err);
    // Do NOT auto-approve on error — flag as unapproved so synthesizer is aware
    logger.warn('mesh.reviewer.llm_failed', { runId, error: err.message });
    return { approved: false, score: 0, issues: ['Reviewer LLM call failed — output unreviewed'], suggestions: [], error: err.message };
  }
}

/**
 * synthesizer-v1: Combine all agent results into a final answer.
 * Returns { reply, confidence, sources }
 */
async function runSynthesizer(runId, taskDescription, agentOutputs, ctx, model) {
  const stepId = beginStep(runId, 'synthesizer', 'Synthesize all results into final answer', {});
  try {
    const systemPrompt = `You are the Synthesizer agent of KI-OS AgentMesh. Combine all available results and produce a clear, comprehensive final answer for the user. Return ONLY valid JSON with no markdown.
Required format:
{
  "reply": "<final answer text>",
  "confidence": <number 0.0-1.0>,
  "sources": ["<source1>", ...]
}`;

    const contextSummary = {
      strategy:        agentOutputs.supervisor ? agentOutputs.supervisor.strategy : 'unknown',
      planSteps:       agentOutputs.planner    ? (agentOutputs.planner.steps || []).length : 0,
      researchSummary: agentOutputs.researcher ? agentOutputs.researcher.summary : '',
      memoryContext:   agentOutputs.memory     ? agentOutputs.memory.context : '',
      executionResult: agentOutputs.executor   ? JSON.stringify(agentOutputs.executor.result || {}).slice(0, 1500) : '',
      reviewScore:     agentOutputs.reviewer   ? agentOutputs.reviewer.score    : null,
      reviewApproved:  agentOutputs.reviewer   ? agentOutputs.reviewer.approved : null
    };

    const userPrompt = `Task: ${taskDescription.slice(0, 800)}\n\nContext:\n${JSON.stringify(contextSummary, null, 2)}`;
    const text = await llmCall({ systemPrompt, userPrompt, maxTokens: 1024, temperature: 0.4, model, runId, agent: 'synthesizer' });
    const result = parseJson(text);
    return completeStep(runId, stepId, result);
  } catch (err) {
    failStep(runId, stepId, err);
    logger.warn('mesh.synthesizer.llm_failed', { runId, error: err.message });
    return { reply: '[Synthesis failed — the LLM synthesizer could not produce a final answer. Check run logs for details.]', confidence: 0, sources: [], error: err.message };
  }
}

// ─── orphan recovery ──────────────────────────────────────────────────────────

/**
 * Find all runs stuck in active states and mark them FAILED.
 * Called on module init (and exportable for startup hooks).
 */
function recoverOrphanRuns() {
  const activeStatuses = ['PLANNING', 'EXECUTING', 'REVIEWING', 'SYNTHESIZING'];
  const cutoff = Date.now() - RUN_TIMEOUT_MS;
  const { runs: allRuns } = store.listRuns({ limit: 10000 });
  for (const run of allRuns) {
    if (!activeStatuses.includes(run.status)) continue;
    const startedTs = run.startedAt ? new Date(run.startedAt).getTime() : 0;
    if (startedTs < cutoff) {
      store.updateRun(run.runId, {
        status:      'FAILED',
        completedAt: now(),
        error:       'orphan_recovered_on_restart'
      });
      logger.warn('mesh.run.orphan_recovered', { runId: run.runId, startedAt: run.startedAt });
    }
  }
}

// ─── main orchestrator ────────────────────────────────────────────────────────

/**
 * Execute a full AgentMesh run through all 8 agents (or fewer with reduced/minimal strategy).
 *
 * @param {string} runId
 * @param {string} taskDescription
 * @param {object} [context] - { userId, tenantId, traceId, pki, ... }
 * @returns {Promise<{ success: boolean, finalAnswer: string, steps: object[], metrics: object }>}
 */
async function executeMeshRun(runId, taskDescription, context = {}) {
  const startedAt = Date.now();
  const run = store.getRun(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found in store`);
  }

  // License Gate: Live-Check aktiver Runs gegen Community-Limit (3)
  const { activeRuns } = store.getStoreStats();
  const limitCheck = checkAgentLimit(activeRuns);
  if (!limitCheck.allowed) {
    const err = new Error(`Agent limit reached: ${limitCheck.current}/${limitCheck.max} concurrent runs active. Upgrade to KI-OS Business to remove this limit.`);
    err.statusCode = 429;
    store.updateRun(runId, { status: 'FAILED', error: err.message });
    throw err;
  }

  store.updateRun(runId, { status: 'PLANNING', startedAt: now() });
  emitUI('mesh.run.started', { runId, taskDescription });
  logger.info('mesh.run.started', { runId, taskDescription: taskDescription.slice(0, 100) });

  // Run-level timeout wrapper
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(Object.assign(new Error('Run timeout exceeded'), { runTimeout: true }));
    }, RUN_TIMEOUT_MS);
  });

  async function actualExecution() {
    const agentOutputs  = {};
    const skippedAgents = [];

    // ── cancellation check helper ──
    function checkCancel() {
      if (isCancelled(runId)) {
        clearCancel(runId);
        throw Object.assign(new Error('Run cancelled by user request'), { statusCode: 409, cancelled: true });
      }
    }

    try {
      // 1. supervisor-v1
      agentOutputs.supervisor = await runSupervisor(runId, taskDescription, context);
      checkCancel();

      // Resolve execution config after supervisor
      const execConfig = getExecutionConfig(agentOutputs.supervisor);
      const { runResearch, runMemory: doMemory, runReviewer: doReviewer, model, reviewerModel, researcherModel } = execConfig;

      // 2. policy-v1 — may throw 403
      agentOutputs.policy = await runPolicy(runId, taskDescription, context);
      checkCancel();

      // 3. planner-v1 (skip in minimal — use inline fallback)
      if (STRATEGY === 'minimal') {
        agentOutputs.planner = { reasoning: 'minimal strategy', steps: [], coordination_agents: [] };
        skippedAgents.push('planner');
      } else {
        store.updateRun(runId, { status: 'PLANNING' });
        agentOutputs.planner = await runPlanner(runId, taskDescription, agentOutputs.supervisor.strategy, context);
        checkCancel();
      }

      // 4. researcher-v1 (conditional) — uses MESH_RESEARCHER_MODEL if set (e.g. qwen via OpenRouter)
      agentOutputs.researcher = await runResearcher(runId, taskDescription, runResearch, context, researcherModel || model);
      if (!runResearch) skippedAgents.push('researcher');
      checkCancel();

      // 5. memory-v1 (conditional)
      agentOutputs.memory = await runMemory(runId, taskDescription, doMemory, context);
      if (!doMemory) skippedAgents.push('memory');
      checkCancel();

      // 6. executor-v1
      store.updateRun(runId, { status: 'EXECUTING' });
      agentOutputs.executor = await runExecutor(runId, taskDescription, agentOutputs.planner, context);
      checkCancel();

      // 7. reviewer-v1 — uses MESH_REVIEWER_MODEL if set (e.g. deepseek via OpenRouter)
      if (doReviewer) {
        store.updateRun(runId, { status: 'REVIEWING' });
        agentOutputs.reviewer = await runReviewer(runId, taskDescription, agentOutputs.executor, context, reviewerModel || model);
        checkCancel();
      } else {
        // Mark reviewer as SKIPPED with a placeholder step
        const stepId = genStepId('reviewer');
        const step = createMeshStep({ runId, stepId, agentId: 'reviewer-v1', role: 'reviewer', description: 'Reviewer skipped by execution strategy', inputs: {} });
        step.status    = 'SKIPPED';
        step.startedAt = now();
        store.addStep(runId, step);
        skipStep(runId, stepId, 'reviewer');
        agentOutputs.reviewer = { approved: true, score: 1.0, issues: [], suggestions: [], skipped: true };
        skippedAgents.push('reviewer');
      }

      // 8. synthesizer-v1
      store.updateRun(runId, { status: 'SYNTHESIZING' });
      agentOutputs.synthesizer = await runSynthesizer(runId, taskDescription, agentOutputs, context, model);

      // ─── Reflection Loop ────────────────────────────────────────────
      let reflectionResult = evaluateReflection(taskDescription, agentOutputs.synthesizer?.reply || '');
      let retryCount = 0;
      while (reflectionResult.score < REFLECTION_MIN_SCORE && retryCount < REFLECTION_MAX_RETRIES) {
        retryCount++;
        store.updateRun(runId, { status: 'REFLECTING' });
        emitUI('mesh.run.reflecting', { runId, retryCount, score: reflectionResult.score });
        const retryPrompt = `Vorheriger Output unzureichend (Score: ${reflectionResult.score}). Verbesserungsgründe: ${reflectionResult.reasons.join(', ') || 'keine'}. Überarbeite: ${taskDescription}`;
        agentOutputs.synthesizer = await runSynthesizer(runId, retryPrompt, agentOutputs, context, model);
        reflectionResult = evaluateReflection(taskDescription, agentOutputs.synthesizer?.reply || '');
      }
      agentOutputs.reflection = { score: reflectionResult.score, passed: reflectionResult.passed, retryCount, reasons: reflectionResult.reasons };

    } catch (err) {
      // Policy denial, cancellation, or unrecoverable error
      const durationMs = Date.now() - startedAt;
      store.updateRun(runId, {
        status:      'FAILED',
        completedAt: now(),
        error:       err.message,
        durationMs
      });
      emitUI('mesh.run.failed', { runId, error: err.message, durationMs });
      logger.error('mesh.run.failed', { runId, error: err.message });
      return { success: false, finalAnswer: '', steps: store.getRun(runId)?.steps || [], metrics: { durationMs }, error: err.message };
    }

    const durationMs  = Date.now() - startedAt;
    const finalAnswer = agentOutputs.synthesizer ? (agentOutputs.synthesizer.reply || '') : '';
    const reviewScore = agentOutputs.reviewer    ? (agentOutputs.reviewer.score    || 0) : 0;
    const reflectionScore = agentOutputs.reflection ? agentOutputs.reflection.score : null;
    const reflectionPassed = agentOutputs.reflection ? agentOutputs.reflection.passed : null;
    const retryCount = agentOutputs.reflection ? (agentOutputs.reflection.retryCount || 0) : 0;
    const costSummary = getCostSummary(runId);
    let reflectionEvaluation = null;

    runRegistry.recordRun({ runId, goal: store.getRun(runId)?.goal, userId: store.getRun(runId)?.userId || 'system', status: 'COMPLETED', stepCount: store.getRun(runId)?.steps?.length || 0, costUsd: costSummary?.totalUSD || 0, finishedAt: now(), startedAt: new Date(Date.now() - durationMs).toISOString() });

    try {
      reflectionEvaluation = await reflectionEngine.evaluateRun({
        ...(store.getRun(runId) || {}),
        runId,
        taskDescription,
        status: 'COMPLETED',
        durationMs,
        steps: store.getRun(runId)?.steps || [],
        result: {
          finalAnswer,
          reviewScore,
          reflectionScore,
          reflectionPassed,
          retryCount,
          reflectionRetries: retryCount,
          confidence: agentOutputs.synthesizer ? (agentOutputs.synthesizer.confidence || 0) : 0,
          sources: agentOutputs.synthesizer ? (agentOutputs.synthesizer.sources || []) : [],
          agentOutputs,
          costSummary
        },
        costSummary
      });
      agentOutputs.runReflection = reflectionEvaluation;
      emitUI('mesh.run.reflection.completed', {
        runId,
        scorecard: reflectionEvaluation.scorecard,
        source: reflectionEvaluation.source
      });
    } catch (err) {
      logger.warn('mesh.run.reflection.failed', { runId, error: err.message });
    } finally {
      runCostLog.delete(runId); // cleanup
    }

    store.updateRun(runId, {
      status:            'COMPLETED',
      completedAt:       now(),
      durationMs,
      executionStrategy: STRATEGY,
      result: {
        finalAnswer,
        reviewScore,
        reflectionScore,
        reflectionPassed,
        retryCount,
        reflectionRetries: retryCount,
        confidence:  agentOutputs.synthesizer ? (agentOutputs.synthesizer.confidence || 0) : 0,
        sources:     agentOutputs.synthesizer ? (agentOutputs.synthesizer.sources     || []) : [],
        agentOutputs,
        costSummary,
        reflectionEvaluation
      }
    });

    emitUI('mesh.run.completed', { runId, durationMs, reviewScore, reflectionScore, retryCount });
    logger.info('mesh.run.completed', {
      runId, durationMs, reviewScore, reflectionScore, retryCount, executionStrategy: STRATEGY, skippedAgents,
      cost: { totalUSD: costSummary.totalUSD, savedPct: costSummary.savedPct }
    });

    return {
      success:           true,
      finalAnswer,
      steps:             store.getRun(runId)?.steps || [],
      metrics:           { durationMs, reviewScore, reflectionScore, reflectionPassed, retryCount, costSummary, reflectionEvaluation },
      executionStrategy: STRATEGY,
      skippedAgents,
      reflectionScore,
      reflectionPassed,
      retryCount,
      reflectionEvaluation
    };
  }

  try {
    const result = await Promise.race([actualExecution(), timeoutPromise]);
    clearTimeout(timeoutHandle);
    return result;
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (err.runTimeout) {
      const durationMs = Date.now() - startedAt;
      store.updateRun(runId, { status: 'FAILED', completedAt: now(), error: 'Run timeout exceeded', durationMs });
      emitUI('mesh.run.failed', { runId, error: 'Run timeout exceeded', durationMs });
      logger.error('mesh.run.timeout', { runId, durationMs });
      return { success: false, finalAnswer: '', steps: store.getRun(runId)?.steps || [], metrics: { durationMs }, error: 'Run timeout exceeded' };
    }
    throw err;
  }
}

// ─── module init: orphan recovery ─────────────────────────────────────────────

recoverOrphanRuns();

function getRecommendedRoles(taskDescription) {
  return roleRegistry.getRolesForTask(taskDescription || '');
}

module.exports = { executeMeshRun, requestCancel, recoverOrphanRuns, getExecutionConfig, getCostSummary, getRecommendedRoles };

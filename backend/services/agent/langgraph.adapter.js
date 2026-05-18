/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: langgraph.adapter.js
 * LangGraph Runtime Adapter — bridges KI-OS AgentMesh runs to LangGraph StateGraph.
 * Aktivierung: AGENT_RUNTIME=langgraph in .env
 * Optionale Dependency — KI-OS läuft ohne LangGraph weiterhin mit der eigenen Runtime.
 * @desc Translates KI-OS run configs into LangGraph StateGraphs with checkpoint + HITL support.
 * @license AGPL-3.0-only
 */

'use strict';

// ─── optional dependency guard ────────────────────────────────────────────────
let StateGraph, END, START, MemorySaver, Annotation;
try {
  const lg = require('@langchain/langgraph');
  StateGraph  = lg.StateGraph;
  END         = lg.END;
  START       = lg.START;
  MemorySaver = lg.MemorySaver;
  Annotation  = lg.Annotation;
} catch {
  // optional — no crash on import
}

const logger = require('../core/logger.service');

// ─── state schema ──────────────────────────────────────────────────────────────
// Each graph run carries this state through all nodes.
function buildAnnotation() {
  return Annotation.Root({
    runId:       Annotation({ reducer: (_, v) => v }),
    goal:        Annotation({ reducer: (_, v) => v }),
    context:     Annotation({ reducer: (prev, v) => ({ ...prev, ...v }) }),
    stepResults: Annotation({ reducer: (prev, v) => ({ ...prev, ...v }) }),
    checkpoints: Annotation({ reducer: (prev, v) => [...(prev || []), ...v] }),
    status:      Annotation({ reducer: (_, v) => v }),
    hitlPending: Annotation({ reducer: (_, v) => v }),
    error:       Annotation({ reducer: (_, v) => v }),
  });
}

// ─── node factory ─────────────────────────────────────────────────────────────
/**
 * Wrap a KI-OS mesh step as a LangGraph node function.
 * Calls the provided executor, writes result to stepResults.
 */
function makeNode(stepDef, executor) {
  return async function kiosNode(state) {
    const { runId, context } = state;
    logger.info('langgraph.node.start', { runId, step: stepDef.id, role: stepDef.agent_role });
    try {
      const result = await executor(stepDef, state);
      logger.info('langgraph.node.done', { runId, step: stepDef.id });
      return {
        stepResults: { [stepDef.id]: result },
        checkpoints: [{ step: stepDef.id, role: stepDef.agent_role, success: true, ts: Date.now() }],
        status: 'running',
      };
    } catch (err) {
      logger.error('langgraph.node.error', { runId, step: stepDef.id, error: err.message });
      return {
        stepResults: { [stepDef.id]: { success: false, error: err.message } },
        checkpoints: [{ step: stepDef.id, role: stepDef.agent_role, success: false, error: err.message, ts: Date.now() }],
        status: 'running',
        error: err.message,
      };
    }
  };
}

// ─── main adapter class ────────────────────────────────────────────────────────
class LangGraphAdapter {
  /**
   * @param {object} opts
   * @param {Function} opts.stepExecutor  async (stepDef, state) => result
   * @param {boolean}  [opts.persistent]  use MemorySaver for checkpoints (default: true)
   */
  constructor(opts = {}) {
    if (!StateGraph) {
      throw new Error('LangGraph nicht installiert. npm install @langchain/langgraph');
    }
    this._executor  = opts.stepExecutor;
    this._saver     = opts.persistent !== false ? new MemorySaver() : null;
    /** @type {Map<string, object>} compiled graphs keyed by schema hash */
    this._graphs    = new Map();
    /** @type {Map<string, Function>} hitl resume callbacks keyed by runId */
    this._hitlWait  = new Map();
    /** @type {Set<string>} active resume locks */
    this._resumeLocks = new Set();
    /** @type {string[]} tracked thread_ids for checkpoint pruning */
    this._threadIds = [];
  }

  // ─── graph builder ────────────────────────────────────────────────────────────
  /**
   * Build (or return cached) compiled graph for a given step list.
   * @param {Array}    steps         KI-OS step definitions
   * @param {string[]} [hitlSteps]   step IDs that require human approval before execution
   */
  _buildGraph(steps, hitlSteps = []) {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('Steps must be a non-empty array.');
    }
    steps.forEach(step => {
      if (typeof step.id !== 'string' || typeof step.agent_role !== 'string') {
        throw new Error('Each step must have a string id and agent_role.');
      }
    });

    const key = steps.map(s => s.id).join(',') + '|' + hitlSteps.join(',');
    if (this._graphs.has(key)) return this._graphs.get(key);

    const schema = buildAnnotation();
    const graph  = new StateGraph(schema);

    // Register nodes
    for (const step of steps) {
      graph.addNode(step.id, makeNode(step, this._executor));
    }

    // Wire edges: simple linear chain by dependency order
    // Steps with depends_on get conditional edges; others get sequential edges.
    const sorted = topoSort(steps);
    for (let i = 0; i < sorted.length; i++) {
      const cur  = sorted[i];
      const next = sorted[i + 1];
      if (i === 0) graph.addEdge(START, cur.id);
      if (next)    graph.addEdge(cur.id, next.id);
      else         graph.addEdge(cur.id, END);
    }

    try {
      const compiled = graph.compile({
        checkpointer:    this._saver || undefined,
        interruptBefore: hitlSteps.length ? hitlSteps : undefined,
      });
      this._graphs.set(key, compiled);
      this._pruneCheckpoints();
      return compiled;
    } catch (err) {
      logger.error('langgraph.graph.compile.error', { error: err.message });
      throw err;
    }
  }

  // ─── public API ──────────────────────────────────────────────────────────────
  /**
   * Execute a KI-OS plan via LangGraph.
   * @param {string} runId
   * @param {string} goal
   * @param {Array}  steps       KI-OS step definitions
   * @param {object} [context]
   * @param {string[]} [hitlSteps]  step IDs that need human approval
   * @returns {Promise<object>}  { runId, status, stepResults, checkpoints, error? }
   */
  async run(runId, goal, steps, context = {}, hitlSteps = []) {
    const graph = this._buildGraph(steps, hitlSteps);
    const config = { configurable: { thread_id: runId } };
    const initial = { runId, goal, context, stepResults: {}, checkpoints: [], status: 'running', hitlPending: null, error: null };

    logger.info('langgraph.run.start', { runId, steps: steps.map(s => s.id), hitlSteps });

    try {
      const finalState = await graph.invoke(initial, config);

      if (hitlSteps.length && finalState.__interruptInfo) {
        logger.info('langgraph.run.hitl_pause', { runId, interrupt: finalState.__interruptInfo });
        return {
          runId,
          status:      'paused_hitl',
          stepResults: finalState.stepResults,
          checkpoints: finalState.checkpoints,
          hitlPending: finalState.__interruptInfo,
        };
      }

      logger.info('langgraph.run.complete', { runId, status: finalState.status });
      return {
        runId,
        status:      finalState.error ? 'failed' : 'completed',
        stepResults: finalState.stepResults,
        checkpoints: finalState.checkpoints,
        error:       finalState.error || null,
      };
    } finally {
      if (this._saver && !this._threadIds.includes(runId)) {
        this._threadIds.push(runId);
        this._pruneCheckpoints();
      }
    }
  }

  /**
   * Resume a paused (HITL) run after human approval.
   * @param {string} runId
   * @param {string} stepId      the approved step
   * @param {object} [approval]  optional payload from approver
   */
  async resume(runId, stepId, approval = {}) {
    if (this._resumeLocks.has(runId)) {
      throw new Error(`RunId ${runId} is already locked for resuming.`);
    }

    this._resumeLocks.add(runId);

    try {
      const existingSteps = this._getStepsForRun(runId);
      if (!existingSteps) throw new Error(`No graph found for runId ${runId}`);

      const graph  = this._graphs.get(existingSteps);
      const config = { configurable: { thread_id: runId } };
      const patch   = { context: { hitlApproval: { stepId, ...approval, approvedAt: Date.now() } } };

      logger.info('langgraph.run.resume', { runId, stepId });
      const finalState = await graph.invoke(patch, config);
      return {
        runId,
        status:      finalState.error ? 'failed' : 'completed',
        stepResults: finalState.stepResults,
        checkpoints: finalState.checkpoints,
        error:       finalState.error || null,
      };
    } finally {
      this._resumeLocks.delete(runId);
    }
  }

  /**
   * Get the current checkpoint state for a run (read-only).
   */
  async getState(runId) {
    if (!this._saver) return null;
    // MemorySaver stores by thread_id — look through all graphs
    for (const [, graph] of this._graphs) {
      try {
        const snap = await graph.getState({ configurable: { thread_id: runId } });
        if (snap && snap.values) return snap.values;
      } catch { /* graph may not have this runId */ }
    }
    return null;
  }

  // ─── internal ────────────────────────────────────────────────────────────────
  _getStepsForRun(runId) {
    // Return the cache key that matches this runId by checking saver
    // Best-effort: return first graph key (assumes single active graph shape per run)
    return this._graphs.keys().next().value || null;
  }

  _pruneCheckpoints() {
    const MAX_CHECKPOINT_RUNS = parseInt(process.env.MAX_CHECKPOINT_RUNS) || 50;
    while (this._threadIds.length > MAX_CHECKPOINT_RUNS) {
      this._threadIds.shift();
    }
  }
}

// ─── topo sort (same logic as execution.engine, kept local) ──────────────────
function topoSort(steps) {
  const byId   = new Map(steps.map(s => [s.id, s]));
  const visited = new Set();
  const temp    = new Set();
  const out     = [];
  function visit(step) {
    if (!step || visited.has(step.id)) return;
    if (temp.has(step.id)) throw new Error(`Cyclic dependency at ${step.id}`);
    temp.add(step.id);
    for (const dep of (step.depends_on || [])) visit(byId.get(dep));
    temp.delete(step.id); visited.add(step.id); out.push(step);
  }
  for (const step of steps) visit(step);
  return out;
}

// ─── factory ──────────────────────────────────────────────────────────────────
/**
 * Returns true if LangGraph is installed and AGENT_RUNTIME=langgraph.
 */
function isLangGraphEnabled() {
  return !!StateGraph && process.env.AGENT_RUNTIME === 'langgraph';
}

/**
 * Create a LangGraphAdapter wired to the AgentMesh step executor.
 * Pass in a stepExecutor function from mesh.runtime.js.
 */
function createAdapter(stepExecutor, opts = {}) {
  return new LangGraphAdapter({ stepExecutor, ...opts });
}

module.exports = { LangGraphAdapter, createAdapter, isLangGraphEnabled };
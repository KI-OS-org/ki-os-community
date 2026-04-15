/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: execution.engine.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { registry } = require('./tools.registry');
const { evaluateToolPolicy } = require('../governance/policy.engine');

function replaceTokens(value, results, context) {
  if (typeof value === 'string') {
    return value
      .replace(/\{USER_ID\}/g, context.userId || 'guest')
      .replace(/\{TENANT_ID\}/g, context.tenantId || 'default')
      .replace(/\{QUERY\}/g, context.query || '')
      .replace(/\{RESULT_FROM_(STEP_[A-Z0-9_]+|step_\d+)\}/gi, (_, key) => JSON.stringify(results[key] || {}));
  }
  if (Array.isArray(value)) return value.map(v => replaceTokens(v, results, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, replaceTokens(v, results, context)]));
  }
  return value;
}

function sortSteps(steps = []) {
  const byId = new Map(steps.map(s => [s.id, s]));
  const visited = new Set();
  const temp = new Set();
  const out = [];
  function visit(step) {
    if (!step || visited.has(step.id)) return;
    if (temp.has(step.id)) throw new Error(`Cyclic dependency at ${step.id}`);
    temp.add(step.id);
    for (const dep of (step.depends_on || [])) visit(byId.get(dep));
    temp.delete(step.id);
    visited.add(step.id);
    out.push(step);
  }
  for (const step of steps) visit(step);
  return out;
}

class ExecutionEngine {
  constructor(options = {}) {
    this.options = {
      maxRetries: Number(options.maxRetries || process.env.AGENT_MAX_RETRIES || 2),
      continueOnError: options.continueOnError !== false,
      totalTimeoutMs: Number(options.totalTimeoutMs || process.env.AGENT_EXECUTION_TIMEOUT || 120000)
    };
  }

  async executePlan(plan, context = {}) {
    const startedAt = Date.now();
    const results = {};
    const checkpoints = [];
    const orderedSteps = sortSteps(plan.steps || []);

    for (const step of orderedSteps) {
      if (Date.now() - startedAt > this.options.totalTimeoutMs) {
        throw new Error(`Agent execution timeout after ${this.options.totalTimeoutMs}ms`);
      }
      let attempt = 0;
      let lastError = null;
      while (attempt <= this.options.maxRetries) {
        attempt += 1;
        try {
          const params = replaceTokens(step.parameters || {}, results, { ...context, query: context.query || context.message || '' });
          const policy = evaluateToolPolicy({ tool: step.tool, action: step.agent_role || 'executor', ctx: context, payload: params });
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
          const toolResult = await registry.executeTool(step.tool, params);
          results[step.id] = toolResult;
          checkpoints.push({ step: step.id, tool: step.tool, agent_role: step.agent_role || 'executor', attempt, success: true });
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          checkpoints.push({ step: step.id, tool: step.tool, agent_role: step.agent_role || 'executor', attempt, success: false, error: e.message });
          if (attempt > this.options.maxRetries) break;
        }
      }
      if (lastError) {
        results[step.id] = { success: false, error: lastError.message };
        if (!this.options.continueOnError) throw lastError;
      }
    }

    return { success: true, result: results, checkpoints, ordered_steps: orderedSteps.map(s => s.id) };
  }
}
module.exports = { ExecutionEngine, sortSteps, replaceTokens };

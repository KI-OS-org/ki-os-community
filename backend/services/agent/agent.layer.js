/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: agent.layer.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { PlanningEngine } = require('./planning.engine');
const { ExecutionEngine } = require('./execution.engine');
const OpenAI = require('../providers/openai.provider');
const Anthropic = require('../providers/anthropic.provider');
const Gemini = require('../providers/gemini.provider');
const DeepSeek = require('../providers/deepseek.provider');
const OpenRouter = require('../providers/openrouter.provider');
const { resolveCapabilityRoute, inferRoleFromTask } = require('../providers/capability-router.service');
const { buildMeshMeta, UNIVERSAL_COORDINATION_AGENTS } = require('./universal.coordination.agents');
const logger = require('../core/logger.service');

class AgentLayer {
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      plannerModel: options.plannerModel || process.env.AGENT_PLANNER_MODEL || 'gpt-5.4',
      synthesizerModel: options.synthesizerModel || process.env.AGENT_SYNTHESIZER_MODEL || 'gpt-5.4',
      agenticThreshold: Number((options.agenticThreshold ?? process.env.AGENT_AGENTIC_THRESHOLD) ?? 0.6)
    };
    this.planner = new PlanningEngine({ model: this.options.plannerModel });
    this.executor = new ExecutionEngine({ maxRetries: Number(process.env.AGENT_MAX_RETRIES || 2), totalTimeoutMs: Number(process.env.AGENT_EXECUTION_TIMEOUT || 120000) });
  }

  async processQuery(query, context = {}) {
    if (!this.options.enabled) return { agentic: false, reason: 'Disabled' };
    try {
      const intent = await this._analyzeIntent(query);
      if (!intent.isAgentic) return { agentic: false, reason: intent.reason || 'Simple query', score: intent.score };

      const framedTask = context.framedTask || null;
      const plan = await this.planner.createPlan(query, { ...context, framedTask });
      if (!plan || !plan.steps || !plan.steps.length) return { agentic: false, reason: 'No plan' };

      const execution = await this.executor.executePlan(plan, { ...context, query });
      const answer = await this._synthesizeAnswer(query, plan, execution, framedTask);

      return {
        agentic: true,
        success: true,
        intent,
        plan,
        execution,
        answer,
        mesh: buildMeshMeta({
          threshold: this.options.agenticThreshold,
          active_roles: this._deriveActiveRoles(plan),
          supervisor: UNIVERSAL_COORDINATION_AGENTS.supervisor.id
        })
      };
    } catch (error) {
      logger.error('agent.layer.error', { error: error.message, runId: context.runId || null, traceId: context.traceId || null });
      return { agentic: true, success: false, error: error.message, mesh: buildMeshMeta({ failed: true }) };
    }
  }

  async _analyzeIntent(query) {
    const q = String(query || '').toLowerCase();
    const triggers = ['suche', 'analysiere', 'plane', 'vergleiche', 'report', 'speichere', 'fasse', 'research', 'finde', 'koordiniere'];
    const hitCount = triggers.filter(k => q.includes(k)).length;
    const complexityBonus = q.length > 120 ? 0.25 : q.length > 60 ? 0.15 : 0;
    const stepBonus = /\bund\b|\bdann\b|\bdanach\b|\banschlie[ßs]end\b/i.test(q) ? 0.25 : 0;
    const score = Math.min(1, hitCount * 0.18 + complexityBonus + stepBonus);
    return {
      isAgentic: score >= this.options.agenticThreshold,
      score,
      reason: score >= this.options.agenticThreshold ? 'Agentic threshold reached' : 'Below threshold'
    };
  }

  _deriveActiveRoles(plan) {
    const roles = new Set(['supervisor', 'planner', 'executor', 'synthesizer']);
    for (const step of plan.steps || []) {
      if (step.agent_role) roles.add(step.agent_role);
      if (step.tool === 'web_search') roles.add('researcher');
      if (String(step.tool || '').startsWith('memory_')) roles.add('memory');
    }
    roles.add('reviewer');
    roles.add('policy');
    return Array.from(roles);
  }
  
  async _synthesizeAnswer(query, plan, execution, framedTask = null) {
    const summaryPrompt = `Du bist der Synthesizer eines KI-OS Agent Mesh. Fasse die Ausführung für die Anfrage ${JSON.stringify(String(query || ''))} in einer klaren, hilfreichen Antwort zusammen. Erwähne nur relevante Tool-Ergebnisse.
Plan: ${JSON.stringify((plan.steps || []).map(s => ({ id: s.id, description: s.description, tool: s.tool, agent_role: s.agent_role })))}
Ergebnisse: ${JSON.stringify(execution.result)}
Task Frame: ${JSON.stringify(framedTask)}`;
    const role = inferRoleFromTask(framedTask?.domain || 'default', query);
    const route = await resolveCapabilityRoute(role === 'websearch' ? 'research' : role, { query });
    const res = await this._callProvider(route.provider, { model: route.model || this.options.synthesizerModel, messages: [{ role: 'user', content: summaryPrompt }] });
    return { reply: res.text || res.reply || '', model: route.model || this.options.synthesizerModel, provider: route.provider, route };
  }

  async _callProvider(provider, params) {
    switch (provider) {
      case 'anthropic':
        return Anthropic.chat(params);
      case 'gemini':
        return Gemini.chat(params);
      case 'deepseek':
        return DeepSeek.chat(params);
      case 'openrouter':
        return OpenRouter.chat(params);
      case 'openai':
      default:
        return OpenAI.callOpenAI(params);
    }
  }
}


let instance = null;
function getAgentLayer(opts = {}) {
  if (!instance) instance = new AgentLayer(opts);
  return instance;
}
module.exports = { AgentLayer, getAgentLayer };

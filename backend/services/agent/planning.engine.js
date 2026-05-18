/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: planning.engine.js
 * Diese Datei erzeugt und bewertet Ausführungspläne im AgentMesh und entscheidet, welche Tools und Schritte verwendet werden.
 * @license AGPL-3.0-only
 */

'use strict';
const logger = require('../core/logger.service');
const { registry } = require('./tools.registry');
const { listCoordinationAgents } = require('./universal.coordination.agents');

function slugifyFlowId(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'generic-flow';
}

function inferWebhookStep(query, context = {}) {
  const lower = String(query || '').toLowerCase();
  if (!/webhook|workflow|trigger|crm|lead|alert|n8n|zapier|make|sap|shopify|hub/i.test(lower)) return null;

  let hub = context.defaultWebhookHub || null;
  if (!hub) {
    if (lower.includes('n8n')) hub = 'n8n';
    else if (lower.includes('zapier')) hub = 'zapier';
    else if (lower.includes('make')) hub = 'make';
    else if (lower.includes('sap') || lower.includes('http')) hub = 'http';
  }
  if (!hub) return null;

  const flowId = context.defaultWebhookFlowId ||
    (lower.includes('customer-sync') ? 'customer-sync' :
      lower.includes('order alert') || lower.includes('order-alert') ? 'order-alert' :
      lower.includes('sap') ? 'sap-proxy' :
      slugifyFlowId(query));

  return {
    id: `step_webhook_${hub}`,
    tool: 'webhook_trigger',
    parameters: {
      hub,
      flowId,
      data: {
        query: '{QUERY}',
        userId: '{USER_ID}',
        tenantId: '{TENANT_ID}'
      },
      testMode: !!context.testMode
    },
    description: `Trigger ${hub} webhook flow ${flowId}`,
    depends_on: [],
    agent_role: 'integration'
  };
}


function inferDesktopSteps(query, context = {}) {
  const lower = String(query || '').toLowerCase();
  if (!/desktop|bildschirm|screen|screenshot|maus|cursor|klick|hotkey|taste|tastenkombination|fenster/.test(lower)) return [];

  const steps = [
    {
      id: 'step_desktop_status',
      tool: 'desktop_status',
      parameters: {},
      description: 'Prüfe Desktop Readiness und Guard-Status',
      depends_on: [],
      agent_role: 'desktop_guard'
    },
    {
      id: 'step_desktop_observe',
      tool: 'desktop_observe',
      parameters: { withScreenshot: true },
      description: 'Beobachte Desktop und erfasse Screenshot',
      depends_on: ['step_desktop_status'],
      agent_role: 'desktop_observer'
    }
  ];

  let action = null;
  if (/klick|click/.test(lower)) action = { action: 'click', x: context.desktopX || 0, y: context.desktopY || 0, userGuard: true, sessionId: context.sessionId || 'default-session' };
  else if (/doppelklick|double click/.test(lower)) action = { action: 'doubleClick', x: context.desktopX || 0, y: context.desktopY || 0, userGuard: true, sessionId: context.sessionId || 'default-session' };
  else if (/rechtsklick|right click/.test(lower)) action = { action: 'rightClick', x: context.desktopX || 0, y: context.desktopY || 0, userGuard: true, sessionId: context.sessionId || 'default-session' };
  else if (/bewege|move/.test(lower)) action = { action: 'move', x: context.desktopX || 0, y: context.desktopY || 0, userGuard: true, sessionId: context.sessionId || 'default-session' };
  else if (/tippe|schreibe|type/.test(lower)) action = { action: 'type', text: context.desktopText || String(query || ''), userGuard: true, sessionId: context.sessionId || 'default-session' };
  else if (/hotkey|tastenkombination/.test(lower)) action = { action: 'hotkey', keys: context.desktopKeys || ['ctrl','l'], userGuard: true, sessionId: context.sessionId || 'default-session' };
  else if (/taste|key/.test(lower)) action = { action: 'key', key: context.desktopKey || 'enter', userGuard: true, sessionId: context.sessionId || 'default-session' };
  else if (/warte|wait/.test(lower)) action = { action: 'wait', durationMs: context.desktopWaitMs || 250, userGuard: true, sessionId: context.sessionId || 'default-session' };

  if (action) {
    steps.push({
      id: 'step_desktop_action',
      tool: 'desktop_action',
      parameters: action,
      description: 'Führe Desktop-Aktion mit serverseitigem Guard aus',
      depends_on: ['step_desktop_observe'],
      agent_role: 'desktop_actor'
    });
  }
  return steps;
}

function fallbackPlan(query, context = {}) {
  const q = String(query || '');
  const lower = q.toLowerCase();
  const steps = [];
  const webhookStep = inferWebhookStep(q, context);
  if (webhookStep) {
    steps.push(webhookStep);
  }
  const desktopSteps = inferDesktopSteps(q, context);
  if (desktopSteps.length) {
    steps.push(...desktopSteps);
  }
  if (/suche|recherche|vergleich|news|report|analyse/i.test(lower)) {
    steps.push({ id: `step_${steps.length + 1}`, tool: 'web_search', parameters: { query: q, count: 5 }, description: 'Sammle externe Informationen', depends_on: [], agent_role: 'researcher' });
  }
  if (/merke|speicher|memory|gedächtnis/i.test(lower)) {
    steps.push({ id: `step_${steps.length + 1}`, tool: 'memory_save', parameters: { userId: context.userId || 'guest', text: q, category: 'agent_mesh' }, description: 'Speichere relevantes Ergebnis im Memory', depends_on: steps.length ? [steps[steps.length - 1].id] : [], agent_role: 'memory' });
  }
  if (steps.length === 0) {
    steps.push({ id: 'step_1', tool: 'analyze_query_intent', parameters: { query: q }, description: 'Bestimme Query-Intent', depends_on: [], agent_role: 'planner' });
  }
  return {
    reasoning: 'Fallback heuristic plan',
    coordination_agents: listCoordinationAgents().map(a => a.id),
    steps
  };
}

class PlanningEngine {
  constructor(options = {}) {
    this.options = { model: options.model || 'gemini-2.0-flash' };
  }

  async createPlan(query, context = {}) {
    const toolDescriptions = registry.getAllTools().map(t => `${t.name}: ${t.description}`).join('; ');
    const coordination = listCoordinationAgents().map(a => `${a.id}:${a.title}`).join(', ');
    const prompt = `Du bist der Planner eines KI-OS Agent Mesh.
Verfügbare Tools: ${toolDescriptions}
Koordinations-Agenten: ${coordination}
Erstelle NUR JSON im Format {"reasoning":"...","steps":[{"id":"step_1","tool":"web_search","parameters":{},"description":"...","depends_on":[],"agent_role":"researcher"}]} für die Anfrage: ${JSON.stringify(String(query || ''))}.
Nutze nur vorhandene Tools. Maximal 4 Schritte.`;
    try {
      const { callOpenAI } = require('../providers/openai.provider');
      const res = await callOpenAI({ model: this.options.model, messages: [{ role: 'user', content: prompt }], temperature: 0.1 });
      const jsonStr = String(res.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.tool === 'write_file' && typeof parsed.path === 'string' && typeof parsed.content === 'string') {
        return {
          tool: parsed.tool,
          path: parsed.path,
          content: parsed.content,
          mode: parsed.mode || 'overwrite',
          reasoning: parsed.reasoning || 'LLM direct tool output'
        };
      }
      if (!parsed || !Array.isArray(parsed.steps) || !parsed.steps.length) return fallbackPlan(query, context);
      return {
        reasoning: parsed.reasoning || 'LLM generated plan',
        coordination_agents: listCoordinationAgents().map(a => a.id),
        steps: parsed.steps.slice(0, 4).map((step, idx) => ({
          id: step.id || `step_${idx + 1}`,
          tool: step.tool,
          parameters: step.parameters || {},
          description: step.description || `Execute ${step.tool}`,
          depends_on: Array.isArray(step.depends_on) ? step.depends_on : [],
          agent_role: step.agent_role || 'executor'
        }))
      };
    } catch (e) {
      logger.warn('planning.engine.fallback', { message: e.message });
      return fallbackPlan(query, context);
    }
  }
}
module.exports = { PlanningEngine, fallbackPlan, inferWebhookStep, inferDesktopSteps, slugifyFlowId };

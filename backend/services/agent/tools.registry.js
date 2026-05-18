/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: tools.registry.js
 * Diese Datei registriert die im AgentMesh verfügbaren Tools und verbindet die Tool-Namen mit ihrer Ausführungslogik.
 * @license AGPL-3.0-only
 */

'use strict';
const WebSearch = require('../websearch.service');
const { handleMemory } = require('../memory.controller');
const { triggerConfiguredAutomation, triggerHubWebhook } = require('../automation.webhook.service');
const { getDesktopStatus, observeDesktop, captureScreenshot, performDesktopAction, stopDesktopActions } = require('../desktop/desktop.service');
const writeFileTool = require('../agentmesh/tools/write-file.tool');

function normalizeMemorySearchResponse(res) {
  if (res && Array.isArray(res.items)) return res;
  return { items: [], adapter: 'unknown', raw: res };
}

const TOOLS = {
  web_search: {
    name: 'web_search',
    description: 'Sucht im Internet via Brave Search',
    parameters: { type: 'object', properties: { query: { type: 'string' }, count: { type: 'number' } }, required: ['query'] },
    execute: async ({ query, count }) => {
      const out = await WebSearch.search(query, count || 5);
      return { success: true, ...out };
    }
  },
  memory_search: {
    name: 'memory_search',
    description: 'Sucht im lokalen oder AWS-Memory',
    parameters: { type: 'object', properties: { userId: { type: 'string' }, query: { type: 'string' }, limit: { type: 'number' } }, required: ['userId'] },
    execute: async ({ userId, query, limit }) => {
      const params = new URLSearchParams({ userId, limit: String(limit || 5) });
      if (query) params.set('q', query);
      const out = await handleMemory('GET', {}, { search: params });
      return { success: true, ...normalizeMemorySearchResponse(out) };
    }
  },
  memory_save: {
    name: 'memory_save',
    description: 'Speichert relevante Informationen im Memory',
    parameters: { type: 'object', properties: { userId: { type: 'string' }, text: { type: 'string' }, category: { type: 'string' } }, required: ['userId', 'text'] },
    execute: async ({ userId, text, category, metadata }) => {
      const out = await handleMemory('POST', { userId, text, category, metadata }, { search: new URLSearchParams() });
      return { success: !!out?.success, ...out };
    }
  },
  get_system_status: {
    name: 'get_system_status',
    description: 'Liefert knappen KI-OS Systemstatus für die Agent-Koordination.',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({ success: true, status: 'ok', runtime: process.env.AWS_EXECUTION_ENV ? 'aws' : 'local', agent_mesh: process.env.AGENT_LAYER_ENABLED === 'true' || process.env.AGENT_MESH_ENABLED === 'true' })
  },
  analyze_query_intent: {
    name: 'analyze_query_intent',
    description: 'Klassifiziert eine Query grob für Planning/Fallback.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    execute: async ({ query }) => {
      const q = String(query || '').toLowerCase();
      const type = /suche|recherche|vergleich|analys/i.test(q) ? 'research' : /speicher|erinnere|memory/i.test(q) ? 'memory' : 'chat';
      return { success: true, intent: type, length: q.length, has_steps: /und|dann|danach|anschließend/i.test(q) };
    }
  },
  desktop_status: {
    name: 'desktop_status',
    description: 'Liefert Desktop-Control Status und Readiness.',
    parameters: { type: 'object', properties: {} },
    execute: async () => await getDesktopStatus()
  },
  desktop_observe: {
    name: 'desktop_observe',
    description: 'Erfasst Desktop-Status und optional Screenshot.',
    parameters: { type: 'object', properties: { withScreenshot: { type: 'boolean' }, filename: { type: 'string' } } },
    execute: async (params) => await observeDesktop(params || {})
  },
  desktop_screenshot: {
    name: 'desktop_screenshot',
    description: 'Erstellt einen Desktop-Screenshot im Runtime-Verzeichnis.',
    parameters: { type: 'object', properties: { filename: { type: 'string' } } },
    execute: async (params) => await captureScreenshot(params || {})
  },
  desktop_action: {
    name: 'desktop_action',
    description: 'Führt eine Desktop-Aktion aus, inklusive serverseitigem Guard.',
    parameters: { type: 'object', properties: { action: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, toX: { type: 'number' }, toY: { type: 'number' }, text: { type: 'string' }, key: { type: 'string' }, keys: { type: 'array', items: { type: 'string' } }, button: { type: 'string' }, durationMs: { type: 'number' }, userGuard: { type: 'boolean' }, sessionId: { type: 'string' } }, required: ['action'] },
    execute: async (params) => await performDesktopAction(params || {}, { role: params?.role || 'guest' })
  },
  desktop_stop: {
    name: 'desktop_stop',
    description: 'Setzt einen Emergency-Stop für Desktop-Aktionen.',
    parameters: { type: 'object', properties: { reason: { type: 'string' } } },
    execute: async (params) => await stopDesktopActions(params?.reason || 'manual_stop')
  },

  webhook_trigger: {
    name: 'webhook_trigger',
    description: 'Löst einen konfigurierten Hub-Webhook-Flow aus.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        hub: { type: 'string' },
        flowId: { type: 'string' },
        data: { type: 'object' },
        testMode: { type: 'boolean' }
      }
    },
    execute: async ({ id, hub, flowId, data, testMode }) => {
      if (id) {
        return await triggerConfiguredAutomation(id, { data, testMode, source: 'agent_mesh' });
      }
      if (hub && flowId) {
        return await triggerHubWebhook(hub, flowId, { data, testMode, source: 'agent_mesh' });
      }
      throw new Error('webhook_trigger requires either id or hub + flowId');
    }
  },
  write_file: {
    name: writeFileTool.TOOL_NAME,
    description: 'Schreibt AgentMesh-Dateien in erlaubte KI-OS Projektpfade mit Governance-Guard.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        mode: { type: 'string' }
      },
      required: ['path', 'content']
    },
    execute: async (params, ctx) => await writeFileTool.execute(params || {}, ctx || {})
  },

  // ── Qwen Builder Tools (via OpenRouter) ──────────────────────────────────────
  qwen_build: {
    name: 'qwen_build',
    description: 'Generiert Code oder strukturierte Outputs mit Qwen 2.5 72B (60-80% günstiger als Claude für Execution).',
    parameters: {
      type: 'object',
      properties: {
        task:     { type: 'string', description: 'Aufgabenbeschreibung' },
        context:  { type: 'string', description: 'Zusätzlicher Kontext (bestehender Code, Daten)' },
        language: { type: 'string', description: 'Zielsprache (javascript, python, ...)' }
      },
      required: ['task']
    },
    execute: async ({ task, context, language }) => {
      const { build } = require('./qwen.builder.agent');
      return await build(task, { context, language });
    }
  },

  qwen_analyze: {
    name: 'qwen_analyze',
    description: 'Analysiert Code oder Daten mit Qwen 2.5 72B und beantwortet eine spezifische Frage.',
    parameters: {
      type: 'object',
      properties: {
        input:    { type: 'string', description: 'Code oder Daten zur Analyse' },
        question: { type: 'string', description: 'Analyse-Frage' }
      },
      required: ['input', 'question']
    },
    execute: async ({ input, question }) => {
      const { analyze } = require('./qwen.builder.agent');
      return await analyze(input, question);
    }
  },

  qwen_review: {
    name: 'qwen_review',
    description: 'Reviewed Code mit DeepSeek (Reviewer-Rolle in Kimba-Hierarchie). Gibt JSON zurück: approved, score, issues, suggestions.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code zum Reviewen' },
        task: { type: 'string', description: 'Ursprüngliche Aufgabenstellung' }
      },
      required: ['code', 'task']
    },
    execute: async ({ code, task }) => {
      const { review } = require('./qwen.builder.agent');
      return await review(code, task);
    }
  }
};

class ToolsRegistry {
  getAllTools() { return Object.values(TOOLS); }
  getTool(name) { return TOOLS[name]; }
  async executeTool(name, params, ctx) {
    const tool = TOOLS[name];
    if (!tool) throw new Error(`Tool ${name} missing`);
    return await tool.execute(params || {}, ctx || {});
  }
}
const registry = new ToolsRegistry();
module.exports = { registry, ToolsRegistry, TOOLS };

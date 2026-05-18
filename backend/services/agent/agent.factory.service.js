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
 * KI-OS Agent Factory Service (Kimba)
 * Erzeugt dynamisch Agent-Konfigurationen aus natürlichsprachigen Beschreibungen.
 *
 * Flow:
 *   1. LLM generiert strukturierte Agent-Config aus Freitext
 *   2. Config wird validiert (Pflichtfelder, Kategorie, Tools)
 *   3. `agent.registry.service.createAgent()` legt den Agent an
 *      → wirft COMMUNITY_LIMIT_EXCEEDED bei 3+ aktiven Agents
 */

'use strict';

const logger = require('../core/logger.service');
const { createAgent } = require('./agent.registry.service');

const VALID_CATEGORIES = ['Marketing', 'Sales', 'IT', 'Finance', 'Operations', 'Admin'];
const VALID_TOOLS = ['web_search', 'memory_search', 'memory_store', 'desktop_action', 'file_read', 'dag_trigger', 'agentmesh_run'];

const GENERATION_SYSTEM_PROMPT = `Du bist Kimba, der intelligente Agent-Designer von KI-OS.
Aus einer Beschreibung erzeugst du eine vollständige, sofort nutzbare Agent-Konfiguration.

Antworte NUR mit validem JSON ohne Markdown-Blöcke:
{
  "name": "<prägnanter Agent-Name, max 40 Zeichen>",
  "category": "<genau eines von: Marketing, Sales, IT, Finance, Operations, Admin>",
  "description": "<1-2 Sätze was der Agent tut>",
  "systemPrompt": "<Vollständiges System-Prompt für den Agent, 3-8 Sätze, präzise und handlungsorientiert>",
  "tools": ["<tool1>", "<tool2>"],
  "domain": "<executive|marketing|retail|it|research>",
  "tags": ["<tag1>", "<tag2>"]
}

Verfügbare Tools: web_search, memory_search, memory_store, desktop_action, file_read, dag_trigger, agentmesh_run
Wähle nur die Tools die für die Aufgabe wirklich sinnvoll sind (max 3).`;

// ---------------------------------------------------------------------------
// LLM-Aufruf zur Config-Generierung
// ---------------------------------------------------------------------------
async function generateAgentConfig(description, context = {}) {
  const { resolveCapabilityRoute } = require('../providers/capability-router.service');
  const route = await resolveCapabilityRoute('generation', { query: description });

  const userPrompt = `Erstelle eine Agent-Konfiguration für folgenden Einsatz:\n\n"${description.slice(0, 800)}"${
    context.name ? `\n\nGewünschter Name: ${context.name}` : ''
  }${
    context.category ? `\nGewünschte Kategorie: ${context.category}` : ''
  }`;

  let rawText = '';
  const provider = route.provider || 'anthropic';

  if (provider === 'anthropic') {
    const Anthropic = require('../providers/anthropic.provider');
    const res = await Anthropic.chat({
      model:     route.model,
      system:    GENERATION_SYSTEM_PROMPT,
      messages:  [{ role: 'user', content: userPrompt }],
      maxTokens: 600,
    });
    rawText = res.text || res.reply || '';
  } else {
    const OpenAI = require('../providers/openai.provider');
    const res = await OpenAI.callOpenAI({
      model:      route.model,
      messages:   [{ role: 'system', content: GENERATION_SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
      max_tokens: 600,
    });
    rawText = res.text || res.reply || '';
  }

  const config = JSON.parse(rawText.replace(/```json|```/g, '').trim());
  return config;
}

// ---------------------------------------------------------------------------
// Validierung + Sanitisierung der generierten Config
// ---------------------------------------------------------------------------
function sanitizeConfig(raw, fallbackDescription) {
  const name = String(raw.name || 'KI-OS Agent').slice(0, 40).trim() || 'KI-OS Agent';

  const category = VALID_CATEGORIES.includes(raw.category) ? raw.category : 'Admin';

  const tools = Array.isArray(raw.tools)
    ? raw.tools.filter(t => VALID_TOOLS.includes(t)).slice(0, 3)
    : ['web_search', 'memory_search'];

  if (!tools.length) tools.push('web_search');

  const systemPrompt = String(raw.systemPrompt || fallbackDescription || '').trim();

  return {
    name,
    category,
    description: String(raw.description || fallbackDescription || '').slice(0, 300),
    systemPrompt: systemPrompt.slice(0, 2000),
    tools,
    domain:  ['executive', 'marketing', 'retail', 'it', 'research'].includes(raw.domain) ? raw.domain : 'executive',
    tags:    Array.isArray(raw.tags) ? raw.tags.filter(t => typeof t === 'string').slice(0, 5) : [],
    visibleTo: [category, 'Admin'],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
async function createDynamicAgent(description, context = {}) {
  logger.info('agent.factory.generating', { descriptionLength: description.length });

  let rawConfig;
  try {
    rawConfig = await generateAgentConfig(description, context);
  } catch (e) {
    logger.warn('agent.factory.llm_failed', { error: e.message });
    // Fallback: minimal config from description
    const words = description.split(' ').slice(0, 4).join(' ');
    rawConfig = {
      name: context.name || `Agent: ${words}`,
      category: context.category || 'Admin',
      description: description.slice(0, 200),
      systemPrompt: `Du bist ein hilfreicher KI-OS Agent. ${description.slice(0, 500)}`,
      tools: ['web_search', 'memory_search'],
      domain: 'executive',
      tags: [],
    };
  }

  const config = sanitizeConfig(rawConfig, description);

  // Override with explicit context values if provided
  if (context.name)     config.name     = String(context.name).slice(0, 40);
  if (context.category && VALID_CATEGORIES.includes(context.category)) {
    config.category  = context.category;
    config.visibleTo = [context.category, 'Admin'];
  }

  logger.info('agent.factory.creating', { name: config.name, category: config.category, tools: config.tools });

  // createAgent() throws COMMUNITY_LIMIT_EXCEEDED if at 3-agent limit
  const agent = createAgent(config);

  logger.info('agent.factory.created', { agentId: agent.id, name: agent.name });
  return agent;
}

module.exports = { createDynamicAgent, generateAgentConfig, sanitizeConfig };

/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * @file    intent.parser.service.js
 * @desc    Parst Chat-Eingaben in strukturierte Intents mit Slot-Extraktion (NLU).
 *          Drei-Stufen-Strategie: Keyword-Heuristik (0 Kosten) → LLM bei Confidence < 0.7
 *          → Slot-Filling mit Rückfragen bei fehlenden Pflichtfeldern.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 */

'use strict';

const logger = require('../core/logger.service');

// ---------------------------------------------------------------------------
// Intent-Typ-Definitionen
// ---------------------------------------------------------------------------
const INTENT_TYPES = {
  AGENT_CREATE:      'AGENT_CREATE',
  DAG_EXECUTE:       'DAG_EXECUTE',
  AGENTMESH_RUN:     'AGENTMESH_RUN',
  DOCUMENT_PROCESS:  'DOCUMENT_PROCESS',
  DESKTOP_ACTION:    'DESKTOP_ACTION',
  MEMORY_SEARCH:     'MEMORY_SEARCH',
  GHOST_CONTROL:     'GHOST_CONTROL',
  CHAT_GENERAL:      'CHAT_GENERAL',
};

// Slot-Schemas: Pflichtfelder pro Intent
const SLOT_SCHEMAS = {
  [INTENT_TYPES.AGENT_CREATE]: [
    { key: 'agentDescription', question: 'Was soll der Agent tun? Bitte beschreibe Aufgabe und Bereich.', required: true },
    { key: 'agentName',        question: 'Wie soll der Agent heißen?', required: false },
    { key: 'agentCategory',    question: 'Welcher Bereich? (Marketing, Sales, IT, Finance, Operations, Admin)', required: false },
  ],
  [INTENT_TYPES.DAG_EXECUTE]: [
    { key: 'dagTask', question: 'Welchen Flow oder welche Automatisierung soll ich starten?', required: true },
  ],
  [INTENT_TYPES.AGENTMESH_RUN]: [
    { key: 'meshTask', question: 'Was ist die Aufgabe für den AgentMesh?', required: true },
  ],
  [INTENT_TYPES.DOCUMENT_PROCESS]: [
    { key: 'docHint', question: 'Welches Dokument soll verarbeitet werden (Dateiname oder Beschreibung)?', required: false },
  ],
  [INTENT_TYPES.DESKTOP_ACTION]: [
    { key: 'desktopAction', question: 'Was soll auf dem Desktop getan werden?', required: true },
  ],
  [INTENT_TYPES.MEMORY_SEARCH]: [
    { key: 'memoryQuery', question: 'Wonach soll im Memory gesucht werden?', required: true },
  ],
  [INTENT_TYPES.GHOST_CONTROL]: [
    { key: 'goalDescription', question: 'Was soll KIMBA dir zeigen oder wo soll ich dich hinführen?', required: true },
    { key: 'mode', question: '', required: false },
  ],
  [INTENT_TYPES.CHAT_GENERAL]: [],
};

// ---------------------------------------------------------------------------
// Keyword-Heuristik
// ---------------------------------------------------------------------------
const HEURISTIC_RULES = [
  {
    intentType: INTENT_TYPES.AGENT_CREATE,
    patterns: [
      /erstell[e]?\s+(mir\s+)?(?:einen?\s+)?(?:neuen?\s+)?agent/i,
      /neuen?\s+agent\s+(anlegen|erstellen|bauen)/i,
      /kimba[,\s]+(?:erstell|bau|mach)\s+(?:mir\s+)?(?:einen?\s+)?agent/i,
      /agent\s+(erstellen|anlegen|hinzufügen|create|new)/i,
      /create\s+(a\s+)?(?:new\s+)?agent/i,
    ],
    baseConfidence: 0.92,
  },
  {
    intentType: INTENT_TYPES.GHOST_CONTROL,
    patterns: [
      /zeig[e]?\s+(mir\s+)?(?:wie|wo)/i,
      /führ[e]?\s+(mich|uns)\s+/i,
      /ghost\s+control/i,
      /navigier[e]?\s+(mich|zu)/i,
      /demonstrier[e]?\s+/i,
      /schritt[\s-]+für[\s-]+schritt/i,
      /wie\s+(?:kann|könnte)\s+ich\s+(?:einen?\s+)?/i,
    ],
    baseConfidence: 0.88,
  },
  {
    intentType: INTENT_TYPES.DAG_EXECUTE,
    patterns: [
      /(?:führe|starte|execute|run)\s+(?:den?\s+)?(?:\w+-)?(?:flow|dag|workflow|automatisierung)/i,
      /(?:führe|starte|execute|run)\s+.{0,40}?\b(?:flow|dag|workflow|automatisierung)\b/i,
      /\b\w+-(?:flow|workflow)\b/i,
      /flow\s+(ausführen|starten|triggern)/i,
      /no[\s-]?code\s+(starten|ausführen)/i,
    ],
    baseConfidence: 0.88,
  },
  {
    intentType: INTENT_TYPES.AGENTMESH_RUN,
    patterns: [
      /(?:starte|run|execute)\s+(?:einen?\s+)?(?:agentmesh|mesh[- ]?run|mesh[- ]?task)/i,
      /agentmesh\s+(analysier|untersuch|bearbeit)/i,
      /mesh\s+(task|analyse|aufgabe)\s*(erstellen|starten)?/i,
    ],
    baseConfidence: 0.88,
  },
  {
    intentType: INTENT_TYPES.DOCUMENT_PROCESS,
    patterns: [
      /(?:verarbeit[e]?|extrahier[e]?|parse|lies?|les[e]?)\s+(?:das?\s+)?(?:dokument|pdf|excel|xlsx)/i,
      /(?:pdf|excel|xlsx)\s+(?:verarbeiten|einlesen|analysieren|öffnen)/i,
      /(?:pdf|excel|xlsx)\s+\w+/i,
      /\b\w+\.(?:pdf|xlsx?|docx?)\b/i,
    ],
    baseConfidence: 0.85,
  },
  {
    intentType: INTENT_TYPES.DESKTOP_ACTION,
    patterns: [
      /(?:klick|click)\s+(auf|den|die|das)/i,
      /(?:mach|nimm|erstell)\s+(einen?\s+)?screenshot/i,
      /(?:schreib|tippe|eingabe)\s+.{1,60}\s+(?:ins|in das|in die|in den)\s+(?:feld|input|formular|fenster)/i,
      /desktop\s+(aktion|action|steuerung|automation)/i,
    ],
    baseConfidence: 0.85,
  },
  {
    intentType: INTENT_TYPES.MEMORY_SEARCH,
    patterns: [
      /(?:such[e]?|finde|zeig)\s+(?:mir\s+)?(?:im\s+)?(?:memory|erinnerung|gedächtnis|kontext)/i,
      /(?:such[e]?|finde|zeig)\s+.{0,30}?\b(?:memory|erinnerung|gedächtnis|kontext)\b/i,
      /was\s+(?:weißt?|hat|kennt|erinnert)\s+(?:du|das\s+system|ki-os)\s+(?:über|zu|von)/i,
      /\b(?:memory|gedächtnis|erinnerung)\s+(?:nach|über|zu|hat)\b/i,
    ],
    baseConfidence: 0.82,
  },
];

function runHeuristic(text) {
  const q = String(text || '');
  for (const rule of HEURISTIC_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(q)) {
        return { intentType: rule.intentType, confidence: rule.baseConfidence, method: 'heuristic' };
      }
    }
  }
  return { intentType: INTENT_TYPES.CHAT_GENERAL, confidence: 1.0, method: 'heuristic' };
}

// ---------------------------------------------------------------------------
// LLM-Fallback (Stufe 2) — nur bei heuristischer Confidence < 0.7
// ---------------------------------------------------------------------------
async function runLlmClassification(text) {
  try {
    const { resolveCapabilityRoute } = require('../providers/capability-router.service');
    const route = await resolveCapabilityRoute('classification', { query: text });

    const systemPrompt = `You are an intent classifier for KI-OS. Classify the user message into exactly one intent.
Available intents: ${Object.values(INTENT_TYPES).join(', ')}
Return ONLY valid JSON, no markdown:
{"intentType": "<INTENT_TYPE>", "confidence": <0.0-1.0>, "entities": {"key": "value"}}`;

    const userPrompt = `Classify: "${text.slice(0, 400)}"`;

    let text_result = '';
    const provider = route.provider || 'anthropic';
    const model = route.model;

    if (provider === 'anthropic') {
      const Anthropic = require('../providers/anthropic.provider');
      const res = await Anthropic.chat({ model, messages: [{ role: 'user', content: userPrompt }], system: systemPrompt, maxTokens: 120 });
      text_result = res.text || res.reply || '';
    } else {
      const OpenAI = require('../providers/openai.provider');
      const res = await OpenAI.callOpenAI({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 120 });
      text_result = res.text || res.reply || '';
    }

    const parsed = JSON.parse(text_result.replace(/```json|```/g, '').trim());
    if (parsed.intentType && INTENT_TYPES[parsed.intentType]) {
      return { intentType: parsed.intentType, confidence: Number(parsed.confidence) || 0.75, entities: parsed.entities || {}, method: 'llm' };
    }
  } catch (e) {
    logger.warn('intent.parser.llm_failed', { error: e.message });
  }
  return { intentType: INTENT_TYPES.CHAT_GENERAL, confidence: 0.5, entities: {}, method: 'llm_fallback' };
}

// ---------------------------------------------------------------------------
// Slot-Filling
// ---------------------------------------------------------------------------
function extractSlots(intentType, text, entities = {}) {
  const schema = SLOT_SCHEMAS[intentType] || [];
  const filled = {};

  // Aus heuristischen Entities übernehmen
  Object.assign(filled, entities);

  // AGENT_CREATE: Beschreibung ist der Text selbst (wenn kein Keyword der Schema-Keys)
  if (intentType === INTENT_TYPES.AGENT_CREATE && !filled.agentDescription) {
    const cleaned = text
      .replace(/erstell[e]?\s+(mir\s+)?(?:einen?\s+)?(?:neuen?\s+)?agent[^\s]*/gi, '')
      .replace(/kimba[,\s]+(?:erstell|bau|mach)\s+(mir\s+)?(?:einen?\s+)?agent[^\s]*/gi, '')
      .replace(/neuen?\s+agent\s+(anlegen|erstellen|bauen)/gi, '')
      .trim();
    if (cleaned.length > 3) filled.agentDescription = cleaned;
  }

  const missing = schema
    .filter(s => s.required && !filled[s.key])
    .map(s => ({ key: s.key, question: s.question }));

  return { filled, missing };
}

function generateSlotQuestion(missingSlots, language = 'de') {
  if (!missingSlots.length) return null;
  return missingSlots[0].question; // Ask one at a time
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
async function parseIntent(text, _history = []) {
  const heuristic = runHeuristic(text);

  let result = heuristic;

  // Stufe 2: LLM bei niedriger Heuristik-Confidence
  if (heuristic.confidence < 0.7 && heuristic.intentType === INTENT_TYPES.CHAT_GENERAL) {
    result = await runLlmClassification(text);
  }

  const { filled, missing } = extractSlots(result.intentType, text, result.entities || {});

  logger.info('intent.parsed', {
    intentType: result.intentType,
    confidence: result.confidence,
    method: result.method,
    missingSlots: missing.length,
  });

  return {
    intentType:    result.intentType,
    confidence:    result.confidence,
    method:        result.method,
    entities:      filled,
    missingSlots:  missing,
    slotQuestion:  generateSlotQuestion(missing),
    isActionable:  result.confidence >= 0.8 && result.intentType !== INTENT_TYPES.CHAT_GENERAL,
  };
}

module.exports = {
  parseIntent,
  runHeuristic,
  extractSlots,
  generateSlotQuestion,
  INTENT_TYPES,
  SLOT_SCHEMAS,
};

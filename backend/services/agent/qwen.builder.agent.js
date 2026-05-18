/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * @file    qwen.builder.agent.js
 * @desc    Qwen 2.5 72B Execution Agent — spezialisiert auf Code-Generierung,
 *          Analyse und strukturierte Ausgaben. Läuft via OpenRouter (kein DashScope).
 *          60-80% günstiger als Claude für Execution-Aufgaben.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 */

'use strict';

const logger      = require('../core/logger.service');
const swarmMemory = require('../memory/swarm.memory');

const QWEN_MODEL  = process.env.QWEN_BUILDER_MODEL  || 'qwen/qwen-2.5-72b-instruct';
const REVIEW_MODEL = process.env.MESH_REVIEWER_MODEL || 'deepseek/deepseek-chat';

// ─── Provider-Auflösung ───────────────────────────────────────────────────────

function getOpenRouter() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY nicht gesetzt — Qwen Builder nicht verfügbar');
  }
  return require('../providers/openrouter.provider');
}

// ─── System-Prompts ───────────────────────────────────────────────────────────

const BUILD_SYSTEM_PROMPT = `Du bist ein präziser Code- und Execution-Agent (Qwen 2.5 72B).
Deine Aufgabe: Generiere exakten, lauffähigen Code oder strukturierte Ausgaben basierend auf der Aufgabe.

REGELN:
- Code immer in korrekten Sprachblöcken (z.B. \`\`\`javascript ... \`\`\`)
- Keine unnötigen Erklärungen — kurz, präzise, ausführbar
- Falls mehrere Dateien: jede in eigenem Codeblock mit Dateiname als Kommentar
- Immer vollständiger Code, keine Ellipsen (...)
- Node.js CommonJS-Standard für KI-OS Backend-Code`;

const ANALYZE_SYSTEM_PROMPT = `Du bist ein Code-Analyse-Agent (Qwen 2.5 72B).
Analysiere den gegebenen Code und beantworte die spezifische Frage präzise und strukturiert.
Antworte auf Deutsch, halte dich kurz.`;

const REVIEW_SYSTEM_PROMPT = `Du bist ein Code-Review-Agent (DeepSeek).
Prüfe den Code auf: Korrektheit, Sicherheit (OWASP Top 10), Performance, KI-OS Konventionen.
Antworte NUR als JSON:
{
  "approved": true|false,
  "score": 0.0-1.0,
  "issues": ["<Issue 1>"],
  "suggestions": ["<Verbesserung 1>"],
  "summary": "<1-2 Sätze Gesamtbewertung>"
}`;

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Generiert Code oder strukturierte Outputs mit Qwen 2.5 72B.
 *
 * @param {string} task        - Aufgabenbeschreibung
 * @param {object} [options]
 * @param {string} [options.context]   - Zusätzlicher Kontext (bestehender Code, Daten)
 * @param {string} [options.language]  - Zielsprache (javascript, python, ...)
 * @param {number} [options.maxTokens] - Max Output-Token (default: 2000)
 * @returns {Promise<{ success: boolean, output: string, model: string, tokens?: number }>}
 */
async function build(task, options = {}) {
  if (!task || !task.trim()) {
    return { success: false, output: '', error: 'Task darf nicht leer sein' };
  }

  const { context = '', language = 'javascript', maxTokens = 2000 } = options;

  // Swarm Memory: Relevante Patterns und Decisions aus dem Team-Gedächtnis laden
  const swarmContext = swarmMemory.retrieveAsContext(task, 5);

  const userPrompt = [
    swarmContext || '',
    context ? `KONTEXT:\n${context}\n` : '',
    language ? `ZIELSPRACHE: ${language}\n` : '',
    `AUFGABE:\n${task}`
  ].filter(Boolean).join('\n');

  logger.info('qwen.builder.build', { taskLength: task.length, language, model: QWEN_MODEL });

  try {
    const OpenRouter = getOpenRouter();
    const messages = [
      { role: 'system', content: BUILD_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ];

    const res = await OpenRouter.chat({ model: QWEN_MODEL, messages, temperature: 0.2 });
    const output = res.text || res.reply || '';

    logger.info('qwen.builder.build.done', { outputLength: output.length, model: QWEN_MODEL });
    return { success: true, output, model: QWEN_MODEL, provider: 'openrouter' };
  } catch (err) {
    logger.error('qwen.builder.build.error', { error: err.message });
    return { success: false, output: '', error: err.message, model: QWEN_MODEL };
  }
}

/**
 * Analysiert Code oder Daten mit Qwen 2.5 72B.
 *
 * @param {string} input    - Code oder Daten zur Analyse
 * @param {string} question - Spezifische Analyse-Frage
 * @returns {Promise<{ success: boolean, analysis: string, model: string }>}
 */
async function analyze(input, question) {
  const userPrompt = `CODE/DATEN:\n\`\`\`\n${input}\n\`\`\`\n\nFRAGE: ${question}`;

  logger.info('qwen.builder.analyze', { inputLength: input.length, model: QWEN_MODEL });

  try {
    const OpenRouter = getOpenRouter();
    const messages = [
      { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ];

    const res = await OpenRouter.chat({ model: QWEN_MODEL, messages, temperature: 0.1 });
    const analysis = res.text || res.reply || '';

    return { success: true, analysis, model: QWEN_MODEL, provider: 'openrouter' };
  } catch (err) {
    logger.error('qwen.builder.analyze.error', { error: err.message });
    return { success: false, analysis: '', error: err.message, model: QWEN_MODEL };
  }
}

/**
 * Reviewed Code mit DeepSeek — DeepSeek ist der Reviewer in der Kimba-Hierarchie.
 *
 * @param {string} code     - Code zum Reviewen
 * @param {string} task     - Ursprüngliche Aufgabenstellung
 * @returns {Promise<{ approved: boolean, score: number, issues: string[], suggestions: string[], summary: string }>}
 */
async function review(code, task) {
  const userPrompt = `AUFGABE: ${task}\n\nCODE ZUM REVIEW:\n\`\`\`\n${code}\n\`\`\``;

  logger.info('qwen.builder.review', { codeLength: code.length, model: REVIEW_MODEL });

  try {
    const OpenRouter = getOpenRouter();
    const messages = [
      { role: 'system', content: REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ];

    const res = await OpenRouter.chat({ model: REVIEW_MODEL, messages, temperature: 0.1 });
    const raw = String(res.text || res.reply || '{}');

    // JSON parsen — strip markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]+\}/);
      result = match ? JSON.parse(match[0]) : { approved: false, score: 0, issues: ['Review parse failed'], suggestions: [], summary: raw };
    }

    result.model    = REVIEW_MODEL;
    result.provider = 'openrouter';

    // Swarm Memory: Score-Gate — nur vertrauenswürdige Ergebnisse schreiben
    // Patterns:     nur bei score >= 0.90 (verhindert mittelmäßige Qualität als Norm)
    // Antipatterns: nur bei score <= 0.65 (verhindert DeepSeek-Fehlalarme)
    if (result.approved && result.score >= 0.90) {
      swarmMemory.store(`Task approved (score ${result.score}): ${task.slice(0, 120)}`, {
        type: 'pattern', author: 'deepseek', sprint: process.env.CURRENT_SPRINT || 'unknown'
      });
    } else if (!result.approved && result.score <= 0.65) {
      for (const issue of (result.issues || [])) {
        swarmMemory.store(issue, {
          type: 'antipattern', found_by: 'deepseek', sprint: process.env.CURRENT_SPRINT || 'unknown'
        });
      }
    }

    return result;
  } catch (err) {
    logger.error('qwen.builder.review.error', { error: err.message });
    return { approved: false, score: 0, issues: [err.message], suggestions: [], summary: 'Review failed', model: REVIEW_MODEL };
  }
}

function extractPrimaryCode(output = '') {
  const text = String(output || '').trim();
  const match = text.match(/```(?:javascript|js|json|markdown|md|txt)?\s*([\s\S]+?)```/i);
  return match ? match[1].trim() : text;
}

async function buildReviewGate(task, options = {}) {
  const buildFn = options.buildFn || build;
  const reviewFn = options.reviewFn || review;
  const gateFn = options.gateFn || require('./lokal-heros-team-gate.service').gateTeamOutput;
  const buildTask = typeof task === 'string'
    ? task
    : String(task?.task || task?.title || '').trim();

  const buildResult = await buildFn(buildTask, options);
  if (!buildResult?.success) {
    return {
      success: false,
      stage: 'build',
      build: buildResult,
      approved: false,
      gate: null
    };
  }

  const candidate = options.reviewOnRawOutput ? String(buildResult.output || '') : extractPrimaryCode(buildResult.output || '');
  const reviewTask = options.reviewTask || (typeof task === 'string' ? task : task?.task || 'KI-OS Team Task');
  const reviewResult = await reviewFn(candidate, reviewTask);
  const reviewApproved = Boolean(reviewResult?.approved);

  const gateInput = {
    task: typeof task === 'string'
      ? { task, domain: options.domain || 'business', reviewerPersona: options.reviewerPersona || null }
      : { ...(task || {}), reviewerPersona: options.reviewerPersona || task?.reviewerPersona || null },
    answer: String(buildResult.output || ''),
    sources: options.sources || [],
    reviewerPersona: options.reviewerPersona || null
  };
  const gateResult = await gateFn(gateInput, options.gateOptions || {});
  const approved = reviewApproved && gateResult?.ok;

  return {
    success: approved,
    stage: approved ? 'approved' : 'blocked',
    approved,
    build: buildResult,
    review: reviewResult,
    gate: gateResult,
    candidate
  };
}

// ─── Status ───────────────────────────────────────────────────────────────────

function getStatus() {
  return {
    agent: 'qwen-builder',
    version: '1.5.0',
    model: QWEN_MODEL,
    reviewModel: REVIEW_MODEL,
    provider: 'openrouter',
    available: !!process.env.OPENROUTER_API_KEY,
    capabilities: ['build', 'analyze', 'review']
  };
}

module.exports = { build, analyze, review, buildReviewGate, getStatus, QWEN_MODEL, REVIEW_MODEL };

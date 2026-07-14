/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Reflection-Engine v1.28.0
 * 
 * Auto-Optimization nach jedem Agent-Run.
 * Bewertet Qualität, Kosten, Latenz und Tool-Wahl.
 * Speichert Learnings im Swarm Memory.
 * 
 * @module services/reflection/reflection.service.js
 * @license AGPL-3.0
 */

'use strict';

const logger = require('../core/logger.service');
const { store: memoryStore } = require('../memory/swarm.memory');
const llmRouter = require('../core/llm.router');

// ─── Configuration ─────────────────────────────────────────────────────────────

const REFLECTION_MODEL = process.env.REFLECTION_MODEL || 'qwen/qwen-2.5-coder-480b-a35b';
const REFLECTION_ENABLED = process.env.REFLECTION_ENABLED !== 'false';
const REFLECTION_MIN_SCORE = Number(process.env.REFLECTION_MIN_SCORE || 0.6);

// ─── Scorecard ─────────────────────────────────────────────────────────────────

/**
 * Scorecard für Agent-Run.
 * Bewertet 0-1 in verschiedenen Kategorien.
 */
class ReflectionScorecard {
  constructor(runData) {
    this.runData = runData;
    this.scores = {
      quality_score: 0,
      cost_score: 0,
      latency_score: 0,
      tool_choice_score: 0,
      overall_score: 0,
    };
  }

  /**
   * Qualität bewerten (0-1)
   * - Output-Länge
   * - Task-Relevanz
   * - Vollständigkeit
   */
  evaluateQuality() {
    const { task, output, reviewerScore = 0 } = this.runData;
    
    let score = 0;
    const reasons = [];

    // Output-Länge (mindestens 50 Zeichen)
    if (output && output.length >= 50) {
      score += 0.2;
      reasons.push('output_length_ok');
    }

    // Satzstruktur (mindestens 3 Sätze)
    const sentences = (output || '').match(/[.!?]+/g) || [];
    if (sentences.length >= 3) {
      score += 0.2;
      reasons.push('sentence_count_ok');
    }

    // Task-Keyword-Matching
    const taskKeywords = Array.from(
      new Set((task || '').match(/\b[\p{L}\p{N}_-]{5,}\b/gu) || [])
    ).map(w => w.toLowerCase());
    
    const matchedKeywords = taskKeywords.filter(kw => 
      (output || '').toLowerCase().includes(kw)
    );
    
    if (matchedKeywords.length >= 2) {
      score += 0.3;
      reasons.push('task_keywords_ok');
    }

    // Output-Tiefe (länger als Task)
    if ((output || '').length > (task || '').length * 2) {
      score += 0.2;
      reasons.push('output_depth_ok');
    }

    // Keine Error-Markers
    if (!/(error|fehler|failed)/i.test(output || '')) {
      score += 0.1;
      reasons.push('no_error_markers');
    }

    // Reviewer-Score einbeziehen (wenn vorhanden)
    if (reviewerScore > 0) {
      score = (score + reviewerScore) / 2;
    }

    this.scores.quality_score = Math.max(0, Math.min(1, Number(score.toFixed(3))));
    return { score: this.scores.quality_score, reasons };
  }

  /**
   * Kosten bewerten (0-1)
   * - Im Budget geblieben?
   * - Günstige Modelle gewählt?
   */
  evaluateCosts() {
    const { budgetCapUSD = 10, actualCostUSD = 0 } = this.runData;
    
    let score = 0;
    const reasons = [];

    // Im Budget geblieben
    if (actualCostUSD <= budgetCapUSD) {
      score += 0.5;
      reasons.push('within_budget');
    }

    // Kosteneffizient (<50% des Budgets)
    if (actualCostUSD <= budgetCapUSD * 0.5) {
      score += 0.3;
      reasons.push('cost_efficient');
    }

    // Sehr kosteneffizient (<20% des Budgets)
    if (actualCostUSD <= budgetCapUSD * 0.2) {
      score += 0.2;
      reasons.push('very_cost_efficient');
    }

    this.scores.cost_score = Math.max(0, Math.min(1, Number(score.toFixed(3))));
    return { score: this.scores.cost_score, reasons, actualCostUSD, budgetCapUSD };
  }

  /**
   * Latenz bewerten (0-1)
   * - Unter 30s?
   * - Unter 10s?
   */
  evaluateLatency() {
    const { latencyMs = 0 } = this.runData;
    
    let score = 0;
    const reasons = [];

    // Unter 30 Sekunden
    if (latencyMs <= 30000) {
      score += 0.5;
      reasons.push('latency_under_30s');
    }

    // Unter 10 Sekunden
    if (latencyMs <= 10000) {
      score += 0.3;
      reasons.push('latency_under_10s');
    }

    // Unter 5 Sekunden (exzellent)
    if (latencyMs <= 5000) {
      score += 0.2;
      reasons.push('latency_excellent');
    }

    this.scores.latency_score = Math.max(0, Math.min(1, Number(score.toFixed(3))));
    return { score: this.scores.latency_score, reasons, latencyMs };
  }

  /**
   * Tool-Wahl bewerten (0-1)
   * - Passende Tools gewählt?
   * - Nicht zu viele Tools?
   */
  evaluateToolChoice() {
    const { toolsUsed = [], taskType = 'generic' } = this.runData;
    
    let score = 0.5; // Base score
    const reasons = [];

    // Nicht zu viele Tools (max 5)
    if (toolsUsed.length <= 5) {
      score += 0.3;
      reasons.push('tool_count_ok');
    }

    // Effizient (nur 1-2 Tools)
    if (toolsUsed.length <= 2) {
      score += 0.2;
      reasons.push('tool_count_efficient');
    }

    // Task-spezifische Tool-Wahl
    if (taskType === 'research' && toolsUsed.includes('web_search')) {
      score += 0.2;
      reasons.push('research_tool_used');
    }

    if (taskType === 'coding' && toolsUsed.includes('file_read')) {
      score += 0.2;
      reasons.push('coding_tool_used');
    }

    this.scores.tool_choice_score = Math.max(0, Math.min(1, Number(score.toFixed(3))));
    return { score: this.scores.tool_choice_score, reasons, toolsUsed };
  }

  /**
   * Gesamt-Score berechnen
   */
  calculateOverall() {
    const { quality_score, cost_score, latency_score, tool_choice_score } = this.scores;
    
    // Weighted average
    this.scores.overall_score = Number((
      quality_score * 0.4 +
      cost_score * 0.2 +
      latency_score * 0.2 +
      tool_choice_score * 0.2
    ).toFixed(3));

    return this.scores.overall_score;
  }

  /**
   * Vollständige Scorecard zurückgeben
   */
  getScorecard() {
    return {
      ...this.scores,
      runId: this.runData.runId,
      task: this.runData.task?.slice(0, 100),
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── LLM Reflection ────────────────────────────────────────────────────────────

/**
 * LLM-basierte Reflection generieren.
 * Bewertet Run und generiert Learnings.
 */
async function generateReflectionLLM(runData) {
  const systemPrompt = `Du bist die Reflection-Engine von KI-OS.
Analysiere den Agent-Run und generiere Learnings für zukünftige Runs.

Antworte NUR als JSON (kein Markdown):
{
  "whatWorked": ["Positives Beispiel 1", "Positives Beispiel 2"],
  "whatFailed": ["Negatives Beispiel 1"],
  "nextTime": ["Verbesserungsvorschlag 1", "Verbesserungsvorschlag 2"],
  "savedCosts": 0.50,
  "improvedLatency": 2000,
  "confidence": 0.85
}`;

  const userPrompt = `
Task: ${runData.task?.slice(0, 500) || 'unknown'}
Output: ${runData.output?.slice(0, 1000) || 'unknown'}
Tools Used: ${(runData.toolsUsed || []).join(', ')}
Actual Cost: $${runData.actualCostUSD?.toFixed(4) || '0'}
Budget: $${runData.budgetCapUSD?.toFixed(2) || '10'}
Latency: ${runData.latencyMs || 0}ms
Quality Score: ${runData.reviewerScore || 0}

Generiere jetzt die Reflection.`;

  try {
    const result = await llmRouter.call({
      systemPrompt,
      userPrompt,
      maxTokens: 512,
      temperature: 0.3,
      model: REFLECTION_MODEL,
      runId: runData.runId,
      agent: 'reflection',
    });

    // JSON parsen
    const cleaned = result.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    logger.error('reflection.llm_failed', { runId: runData.runId, error: error.message });
    return null;
  }
}

// ─── Main Reflection Service ───────────────────────────────────────────────────

/**
 * Reflection für Agent-Run durchführen.
 * 
 * @param {object} runData - Run-Daten
 * @returns {Promise<object>} Reflection-Ergebnis
 */
async function reflect(runData) {
  if (!REFLECTION_ENABLED) {
    logger.info('reflection.disabled', { runId: runData.runId });
    return { skipped: true, reason: 'reflection_disabled' };
  }

  logger.info('reflection.started', { runId: runData.runId });

  // 1. Scorecard auswerten
  const scorecard = new ReflectionScorecard(runData);
  const quality = scorecard.evaluateQuality();
  const costs = scorecard.evaluateCosts();
  const latency = scorecard.evaluateLatency();
  const tools = scorecard.evaluateToolChoice();
  const overall = scorecard.calculateOverall();

  // 2. LLM Reflection generieren
  const llmReflection = await generateReflectionLLM(runData);

  // 3. Learning im Swarm Memory speichern
  const learning = {
    runId: runData.runId,
    type: 'reflection',
    text: llmReflection 
      ? `Reflection: ${llmReflection.whatWorked?.join(', ') || 'N/A'} | Next: ${llmReflection.nextTime?.join(', ') || 'N/A'}`
      : `Scorecard: Quality ${quality.score}, Cost ${costs.score}, Latency ${latency.score}`,
    metadata: {
      scorecard: scorecard.getScorecard(),
      llmReflection,
      taskType: runData.taskType || 'unknown',
      agents: runData.agents || [],
    },
    confidence: llmReflection?.confidence || overall / 10,
  };

  try {
    const memoryResult = await memoryStore(learning.text, 'reflection', learning.metadata);
    logger.info('reflection.learning_stored', { 
      runId: runData.runId, 
      memoryId: memoryResult.id 
    });
  } catch (error) {
    logger.error('reflection.memory_failed', { 
      runId: runData.runId, 
      error: error.message 
    });
  }

  // 4. Ergebnis zusammenbauen
  const result = {
    runId: runData.runId,
    scorecard: scorecard.getScorecard(),
    llmReflection,
    passed: overall >= REFLECTION_MIN_SCORE,
    minScore: REFLECTION_MIN_SCORE,
    timestamp: new Date().toISOString(),
  };

  logger.info('reflection.completed', { 
    runId: runData.runId, 
    overall, 
    passed: result.passed 
  });

  return result;
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  reflect,
  ReflectionScorecard,
  generateReflectionLLM,
  REFLECTION_MIN_SCORE,
  REFLECTION_MAX_RETRIES: 2,
  REFLECTION_ENABLED,
};

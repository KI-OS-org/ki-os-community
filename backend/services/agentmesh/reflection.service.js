/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const REFLECTION_MIN_SCORE = Number(process.env.REFLECTION_MIN_SCORE || 0.7);
const REFLECTION_MAX_RETRIES = Number(process.env.REFLECTION_MAX_RETRIES || 2);

function evaluateReflection(task, output) {
  const taskText = String(task || '');
  const outputText = String(output || '');
  const reasons = [];
  let score = 0;

  if (outputText.length >= 50) {
    score += 0.2;
    reasons.push('output_length_ok');
  }

  const sentenceMatches = outputText.match(/[.!?]+/g) || [];
  if (sentenceMatches.length >= 3) {
    score += 0.2;
    reasons.push('sentence_count_ok');
  }

  const taskKeywords = Array.from(
    new Set((taskText.match(/\b[\p{L}\p{N}_-]{5,}\b/gu) || []).map((word) => word.toLowerCase()))
  );
  const matchedKeywords = taskKeywords.filter((word) => outputText.toLowerCase().includes(word));
  if (matchedKeywords.length >= 2) {
    score += 0.3;
    reasons.push('task_keywords_ok');
  }

  if (outputText.length > taskText.length * 2) {
    score += 0.2;
    reasons.push('output_depth_ok');
  }

  if (!/(error|fehler|failed)/i.test(outputText)) {
    score += 0.1;
    reasons.push('no_error_markers');
  }

  score = Math.max(0, Math.min(1, Number(score.toFixed(3))));

  return {
    score,
    passed: score >= REFLECTION_MIN_SCORE,
    reasons
  };
}

function shouldRetry(reflectionResult, retryCount) {
  return !reflectionResult.passed && retryCount < REFLECTION_MAX_RETRIES;
}

function buildRetryPrompt(task, output, reflectionResult) {
  void output;
  void reflectionResult;
  return `Vorherige Antwort war unvollständig (Score: ${reflectionResult.score}). Bitte beantworte erneut vollständiger: ${task}`;
}

module.exports = {
  evaluateReflection,
  shouldRetry,
  buildRetryPrompt,
  REFLECTION_MIN_SCORE,
  REFLECTION_MAX_RETRIES
};

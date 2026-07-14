/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const PROPOSE_SCORE = Number(process.env.INTELLIGENCE_PROPOSE_SCORE || 0.60);
const AUTO_BUILD_SCORE = Number(process.env.INTELLIGENCE_AUTO_BUILD_SCORE || 0.85);
const MAX_AUTO_COST_USD = Number(process.env.INTELLIGENCE_MAX_AUTO_COST_USD || 0.05);

function analyzeImpact(feature) {
  const description = String(feature?.description || '');
  const provider = String(feature?.provider || '').toLowerCase();
  const name = String(feature?.name || '').toLowerCase();
  const reasons = [];
  let score = 0.3;

  if (/\b(replace|faster|cheaper|better|free)\b/i.test(description)) {
    score += 0.2;
    reasons.push('description_contains_high_impact_keywords');
  }

  if (['anthropic', 'openai', 'google'].includes(provider)) {
    score += 0.2;
    reasons.push('trusted_major_provider');
  }

  if (description.length > 100) {
    score += 0.1;
    reasons.push('long_description_signal');
  }

  if (/(claude|gpt|gemini)/i.test(name)) {
    score += 0.2;
    reasons.push('flagship_model_name_signal');
  }

  score = Math.min(1, score);

  return {
    feature,
    score,
    action: score >= AUTO_BUILD_SCORE ? 'BUILD' : score >= PROPOSE_SCORE ? 'PROPOSE' : 'IGNORE',
    estimatedCostUsd: 0.01,
    reasons
  };
}

module.exports = { analyzeImpact, PROPOSE_SCORE, AUTO_BUILD_SCORE, MAX_AUTO_COST_USD };

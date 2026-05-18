/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';
const fs = require('fs');
const path = require('path');

const SCORECARD_PATH = process.env.OUTCOME_SCORECARD_PATH || path.join(process.cwd(), '.ki-os-outcome-scorecards.json');

// Laedt/speichert: { provider: { taskType: { runs, totalScore, avgScore, avgCostUsd } } }
function _load() {
  try { return JSON.parse(fs.readFileSync(SCORECARD_PATH, 'utf8')); } catch { return {}; }
}

function _save(data) {
  try { fs.writeFileSync(SCORECARD_PATH, JSON.stringify(data, null, 2)); } catch {}
}

function recordOutcome(provider, taskType, score, costUsd) {
  const normalizedProvider = String(provider || '');
  const normalizedTaskType = String(taskType || '').toLowerCase().slice(0, 64);
  const normalizedScore = Math.min(Math.max(Number(score) || 0, 0), 1);
  const normalizedCostUsd = Number(costUsd) || 0;

  const data = _load();
  const providerBucket = data[normalizedProvider] || {};
  const current = providerBucket[normalizedTaskType] || {
    runs: 0,
    totalScore: 0,
    avgScore: 0,
    avgCostUsd: 0
  };

  const runs = current.runs + 1;
  const totalScore = current.totalScore + normalizedScore;
  const avgScore = totalScore / runs;
  const avgCostUsd = ((current.avgCostUsd * (runs - 1)) + normalizedCostUsd) / runs;

  providerBucket[normalizedTaskType] = { runs, totalScore, avgScore, avgCostUsd };
  data[normalizedProvider] = providerBucket;
  _save(data);

  return providerBucket[normalizedTaskType];
}

function getRecommendation(taskType, maxCostUsd) {
  const normalizedTaskType = String(taskType || '').toLowerCase().slice(0, 64);
  const normalizedMaxCostUsd = Number(maxCostUsd) || 0;
  const data = _load();
  const recommendations = [];

  for (const [provider, taskTypes] of Object.entries(data)) {
    const entry = taskTypes && taskTypes[normalizedTaskType];
    if (!entry) continue;
    if (normalizedMaxCostUsd > 0 && entry.avgCostUsd > normalizedMaxCostUsd) continue;
    recommendations.push({
      provider,
      avgScore: entry.avgScore,
      avgCostUsd: entry.avgCostUsd,
      runs: entry.runs
    });
  }

  recommendations.sort((a, b) => b.avgScore - a.avgScore);
  return recommendations[0] || null;
}

function getScorecard() {
  return _load();
}

module.exports = { recordOutcome, getRecommendation, getScorecard };

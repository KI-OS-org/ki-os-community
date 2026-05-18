/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only

const swarm = require('../memory/swarm.memory');

const DEFAULT_RECOMMENDATION = Object.freeze({
  model: 'claude-haiku-4-5-20251001',
  provider: 'anthropic',
  avgScore: 0,
  avgCostUSD: 0,
  sampleSize: 0
});

function inferProvider(model) {
  const normalizedModel = String(model || '').toLowerCase();
  if (normalizedModel.includes('claude')) return 'anthropic';
  if (normalizedModel.includes('gpt') || normalizedModel.includes('openai')) return 'openai';
  return 'openrouter';
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function outcomeStore(runId, taskType, model, scoreFloat, costUSD) {
  const metadata = {
    type: 'routing_outcome',
    runId: String(runId || '').trim(),
    taskType: String(taskType || '').trim(),
    model: String(model || '').trim(),
    score: toFiniteNumber(scoreFloat, 0),
    costUSD: toFiniteNumber(costUSD, 0),
    timestamp: new Date().toISOString()
  };

  const text = `Routing outcome for ${metadata.taskType || 'unknown'} with ${metadata.model || 'unknown'} scored ${metadata.score}`;
  return swarm.store(text, metadata);
}

function getRecommendation(taskType, budgetUSD) {
  const normalizedTaskType = String(taskType || '').trim();
  const normalizedBudgetUSD = toFiniteNumber(budgetUSD, 0);
  const entries = swarm.retrieve(`routing outcome ${normalizedTaskType}`, 20);
  const grouped = new Map();

  for (const entry of entries) {
    const metadata = entry && entry.metadata ? entry.metadata : {};
    if (metadata.type !== 'routing_outcome') continue;
    if (normalizedTaskType && metadata.taskType !== normalizedTaskType) continue;

    const model = String(metadata.model || '').trim();
    if (!model) continue;

    const score = toFiniteNumber(metadata.score, NaN);
    const cost = toFiniteNumber(metadata.costUSD, NaN);
    if (!Number.isFinite(score) || !Number.isFinite(cost)) continue;

    if (!grouped.has(model)) {
      grouped.set(model, {
        model,
        provider: inferProvider(model),
        scoreSum: 0,
        costSum: 0,
        sampleSize: 0
      });
    }

    const bucket = grouped.get(model);
    bucket.scoreSum += score;
    bucket.costSum += cost;
    bucket.sampleSize += 1;
  }

  const recommendations = Array.from(grouped.values())
    .map((bucket) => ({
      model: bucket.model,
      provider: bucket.provider,
      avgScore: Number((bucket.scoreSum / bucket.sampleSize).toFixed(4)),
      avgCostUSD: Number((bucket.costSum / bucket.sampleSize).toFixed(4)),
      sampleSize: bucket.sampleSize
    }))
    .filter((item) => normalizedBudgetUSD <= 0 || item.avgCostUSD <= normalizedBudgetUSD)
    .sort((a, b) => {
      if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
      if (a.avgCostUSD !== b.avgCostUSD) return a.avgCostUSD - b.avgCostUSD;
      return b.sampleSize - a.sampleSize;
    });

  return recommendations[0] || { ...DEFAULT_RECOMMENDATION };
}

module.exports = { outcomeStore, getRecommendation };

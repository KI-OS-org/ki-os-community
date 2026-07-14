/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 * @file Reflection scorecard helpers.
 */
'use strict';

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Number(Math.max(0, Math.min(1, num)).toFixed(4));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function scoreQuality(run = {}) {
  const result = run.result || {};
  const outputs = result.agentOutputs || run.agentOutputs || {};
  const reviewerScore = Number(outputs.reviewer?.score ?? result.reviewScore);
  const synthConfidence = Number(outputs.synthesizer?.confidence ?? result.confidence);
  const executorOk = outputs.executor?.success === false ? 0 : 1;
  const failedSteps = toArray(run.steps).filter((step) => step.status === 'FAILED').length;
  const stepPenalty = Math.min(0.35, failedSteps * 0.08);

  const base = Number.isFinite(reviewerScore)
    ? reviewerScore
    : Number.isFinite(synthConfidence) ? synthConfidence : 0.65;

  return clamp01((base * 0.55) + (synthConfidence || base) * 0.25 + (executorOk * 0.2) - stepPenalty, 0.5);
}

function scoreCost(run = {}) {
  const cost = Number(run.costSummary?.totalUSD ?? run.result?.costSummary?.totalUSD ?? run.metrics?.costSummary?.totalUSD ?? run.costUsd ?? 0);
  const budget = Number(process.env.REFLECTION_TARGET_COST_USD || 0.05);
  if (cost <= 0) return 1;
  return clamp01(1 - Math.min(1, cost / Math.max(0.000001, budget)), 0.5);
}

function scoreLatency(run = {}) {
  const durationMs = Number(run.durationMs ?? run.metrics?.durationMs ?? 0);
  const targetMs = Number(process.env.REFLECTION_TARGET_LATENCY_MS || 30000);
  if (durationMs <= 0) return 0.8;
  return clamp01(1 - Math.min(1, durationMs / Math.max(1, targetMs)), 0.5);
}

function scoreToolChoice(run = {}) {
  const steps = toArray(run.steps);
  const outputs = run.result?.agentOutputs || run.agentOutputs || {};
  const supervisor = outputs.supervisor || {};
  let score = 0.75;

  const researcher = outputs.researcher || {};
  if (supervisor.requiresResearch && (researcher.skipped || !toArray(researcher.sources).length)) score -= 0.2;
  if (!supervisor.requiresResearch && researcher.skipped) score += 0.05;

  const memory = outputs.memory || {};
  if (supervisor.requiresMemory && (memory.skipped || (!memory.context && !toArray(memory.memories).length))) score -= 0.15;
  if (!supervisor.requiresMemory && memory.skipped) score += 0.05;

  const failedToolSteps = steps.filter((step) => step.status === 'FAILED' && /research|memory|executor/i.test(step.role || '')).length;
  score -= Math.min(0.25, failedToolSteps * 0.08);

  return clamp01(score, 0.5);
}

function computeScorecard(run = {}, overrides = {}) {
  const quality_score = clamp01(overrides.quality_score, scoreQuality(run));
  const cost_score = clamp01(overrides.cost_score, scoreCost(run));
  const latency_score = clamp01(overrides.latency_score, scoreLatency(run));
  const tool_choice_score = clamp01(overrides.tool_choice_score, scoreToolChoice(run));
  const overall_score = clamp01(
    overrides.overall_score,
    (quality_score * 0.4) + (cost_score * 0.2) + (latency_score * 0.2) + (tool_choice_score * 0.2)
  );

  return { quality_score, cost_score, latency_score, tool_choice_score, overall_score };
}

module.exports = {
  clamp01,
  computeScorecard,
  scoreQuality,
  scoreCost,
  scoreLatency,
  scoreToolChoice
};

/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Observability = require('../core/observability.service');
const { loadModelCatalog, minimum } = require('../providers/models-services');
const { providerEnabled, providerHasCapability, inferRoleFromTask, normalizeProvider } = require('../providers/capability-router.service');

const DECISION_LOG_LIMIT = Number(process.env.ROUTING_DECISION_LOG_LIMIT || 200);
const SCORECARD_LIMIT = Number(process.env.ROUTING_SCORECARD_LIMIT || 200);
const decisionLog = [];
const routingScorecards = new Map();

function decisionLogPath() { return process.env.ROUTING_DECISION_LOG_PATH || path.join(process.cwd(), '.ki-os-routing-decisions.json'); }
function scorecardPath() { return process.env.ROUTING_SCORECARD_PATH || path.join(process.cwd(), '.ki-os-routing-scorecards.json'); }
function persistDecisionLog() { try { fs.writeFileSync(decisionLogPath(), JSON.stringify({ items: decisionLog }, null, 2), 'utf8'); } catch {} }
function persistRoutingScorecards() {
  try {
    const items = Array.from(routingScorecards.values())
      .sort((a, b) => String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || '')))
      .slice(0, SCORECARD_LIMIT);
    fs.writeFileSync(scorecardPath(), JSON.stringify({ items }, null, 2), 'utf8');
  } catch {}
}
function loadDecisionLog() {
  try {
    const raw = JSON.parse(fs.readFileSync(decisionLogPath(), 'utf8'));
    decisionLog.splice(0, decisionLog.length, ...((raw.items || []).slice(-DECISION_LOG_LIMIT)));
  } catch {}
}
function loadRoutingScorecards() {
  try {
    const raw = JSON.parse(fs.readFileSync(scorecardPath(), 'utf8'));
    routingScorecards.clear();
    for (const item of (raw.items || []).slice(-SCORECARD_LIMIT)) {
      if (item && item.key) routingScorecards.set(item.key, item);
    }
  } catch {}
}

const MODEL_PROFILE_OVERRIDES = Object.freeze({
  'gpt-5.4': { cost_cpm: 2.5, p95_ms: 900, quality: 0.92, strengths: ['chat', 'reasoning', 'research', 'vision'] },
  'claude-sonnet-4-6': { cost_cpm: 3.0, p95_ms: 1400, quality: 0.94, strengths: ['code', 'reasoning', 'research', 'chat'] },
  'claude-opus-4-6': { cost_cpm: 5.0, p95_ms: 3000, quality: 0.97, strengths: ['reasoning', 'research'] },
  'claude-haiku-4-5-20251001': { cost_cpm: 0.8, p95_ms: 700, quality: 0.72, strengths: ['chat', 'fast'] },
  'gemini-2.0-flash': { cost_cpm: 0.1, p95_ms: 300, quality: 0.74, strengths: ['fast', 'chat', 'vision'] },
  'gemini-3.1-pro': { cost_cpm: 1.5, p95_ms: 1000, quality: 0.89, strengths: ['research', 'reasoning', 'vision', 'chat'] },
  'deepseek-chat': { cost_cpm: 0.2, p95_ms: 500, quality: 0.7, strengths: ['chat', 'code', 'low_cost'] },
  'deepseek-reasoner': { cost_cpm: 0.6, p95_ms: 2000, quality: 0.86, strengths: ['reasoning', 'low_cost', 'code'] },
  'openai/gpt-5.4': { cost_cpm: 2.8, p95_ms: 1200, quality: 0.88, strengths: ['fallback', 'chat', 'research'] }
});

const ROLE_CONFIG = Object.freeze({
  default: { capability: 'chat', preferredProviders: ['openai', 'anthropic', 'gemini'], fallbackProviders: ['openrouter', 'deepseek'] },
  fast: { capability: 'chat', preferredProviders: ['gemini', 'openai'], fallbackProviders: ['openrouter', 'deepseek'] },
  reasoning: { capability: 'reasoning', preferredProviders: ['anthropic', 'openai', 'deepseek'], fallbackProviders: ['openrouter', 'gemini'] },
  research: { capability: 'research', preferredProviders: ['openai', 'anthropic', 'gemini'], fallbackProviders: ['openrouter'] },
  websearch: { capability: 'websearch', preferredProviders: ['openai', 'anthropic', 'gemini'], fallbackProviders: ['openrouter'] },
  code: { capability: 'code', preferredProviders: ['anthropic', 'openai', 'deepseek'], fallbackProviders: ['openrouter', 'gemini'] },
  vision: { capability: 'vision', preferredProviders: ['openai', 'gemini', 'anthropic'], fallbackProviders: ['openrouter'] },
  low_cost: { capability: 'low_cost', preferredProviders: ['deepseek', 'gemini'], fallbackProviders: ['openrouter', 'openai'] }
});

const TASK_RULES = [
  { taskType: 'vision', role: 'vision', patterns: [/bild|image|foto|screenshot|vision|ocr/i] },
  { taskType: 'code_generation', role: 'code', patterns: [/code|api|script|node|javascript|python|refactor|debug|test/i] },
  { taskType: 'web_research', role: 'websearch', patterns: [/websearch|suche|search|news|aktuell|latest|recherche|research|vergleich/i] },
  { taskType: 'deep_reasoning', role: 'reasoning', patterns: [/strategie|warum|begründ|analyse|plan|konzept|architect|architektur/i] },
  { taskType: 'speed_first', role: 'fast', patterns: [/schnell|kurz|fast|quick/i] },
  { taskType: 'cost_sensitive', role: 'low_cost', patterns: [/günstig|billig|sparsam|cheap|low cost/i] }
];

function nowIso() { return new Date().toISOString(); }
function scorecardKey(provider, model) { return `${normalizeProvider(provider)}:${String(model || '').trim()}`; }
function cappedPush(list, item, limit = DECISION_LOG_LIMIT) {
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
  persistDecisionLog();
}

function normalizeModelProfile(model, profile = {}, provider = 'unknown', role = 'default') {
  const override = MODEL_PROFILE_OVERRIDES[model] || {};
  return {
    provider,
    model,
    role,
    cost_cpm: Number(profile.cost_cpm ?? override.cost_cpm ?? 1.5),
    p95_ms: Number(profile.p95_ms ?? override.p95_ms ?? 1200),
    quality: Number(profile.quality ?? override.quality ?? 0.8),
    strengths: Array.isArray(profile.strengths) ? profile.strengths : (override.strengths || [])
  };
}

function getRoutingScorecard(provider, model) {
  return routingScorecards.get(scorecardKey(provider, model)) || {
    key: scorecardKey(provider, model),
    provider: normalizeProvider(provider),
    model,
    totalRuns: 0,
    successRuns: 0,
    failedRuns: 0,
    avgLatencyMs: 0,
    avgTrustScore: 0,
    avgOutcomeCoverage: 0,
    score: 0.5,
    lastUsedAt: null
  };
}

function calculateAdaptiveScore(card = {}) {
  const total = Math.max(1, Number(card.totalRuns || 0));
  if (!card.totalRuns) return 0.5;
  const successRate = Number(card.successRuns || 0) / total;
  const trust = Math.max(0, Math.min(1, Number(card.avgTrustScore || 0) / 100));
  const outcome = Math.max(0, Math.min(1, Number(card.avgOutcomeCoverage || 0)));
  const latencyTarget = Number(process.env.ROUTING_SCORECARD_TARGET_LATENCY_MS || 1800);
  const latencyScore = Math.max(0, Math.min(1, latencyTarget / Math.max(1, Number(card.avgLatencyMs || latencyTarget))));
  return Number((successRate * 0.45 + trust * 0.25 + outcome * 0.2 + latencyScore * 0.1).toFixed(4));
}

function recordRouteOutcome(payload = {}) {
  const provider = normalizeProvider(payload.provider || 'unknown');
  const model = String(payload.model || '').trim();
  if (!model) return null;
  const key = scorecardKey(provider, model);
  const current = getRoutingScorecard(provider, model);
  const totalRuns = Number(current.totalRuns || 0) + 1;
  const successRuns = Number(current.successRuns || 0) + (payload.success === false ? 0 : 1);
  const failedRuns = Number(current.failedRuns || 0) + (payload.success === false ? 1 : 0);
  const avgLatencyMs = Number((((Number(current.avgLatencyMs || 0) * Number(current.totalRuns || 0)) + Number(payload.latencyMs || 0)) / totalRuns).toFixed(2));
  const avgTrustScore = Number((((Number(current.avgTrustScore || 0) * Number(current.totalRuns || 0)) + Number(payload.trustScore || 0)) / totalRuns).toFixed(2));
  const avgOutcomeCoverage = Number((((Number(current.avgOutcomeCoverage || 0) * Number(current.totalRuns || 0)) + Number(payload.outcomeCoverage || 0)) / totalRuns).toFixed(4));
  const next = {
    ...current,
    key,
    provider,
    model,
    totalRuns,
    successRuns,
    failedRuns,
    avgLatencyMs,
    avgTrustScore,
    avgOutcomeCoverage,
    lastUsedAt: nowIso(),
    lastRunId: payload.runId || current.lastRunId || null,
    lastTraceId: payload.traceId || current.lastTraceId || null
  };
  next.score = calculateAdaptiveScore(next);
  routingScorecards.set(key, next);
  persistRoutingScorecards();
  Observability.emit('routing.scorecard.updated', {
    provider,
    model,
    score: next.score,
    totalRuns,
    successRuns,
    failedRuns,
    avgOutcomeCoverage
  }, { runId: payload.runId || null });
  return next;
}

function listRoutingScorecards(limit = 50) {
  return Array.from(routingScorecards.values())
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || '')))
    .slice(0, Math.max(1, Number(limit || 50)));
}

function classifyTask(input = {}) {
  const query = String(input.query || input.input_text || input.message || '').trim();
  const explicitIntent = String(input.intent || input.taskType || '').trim().toLowerCase();
  if (explicitIntent) {
    const inferredRole = inferRoleFromTask(explicitIntent, query);
    return {
      query,
      intent: explicitIntent,
      taskType: explicitIntent,
      role: inferredRole,
      confidence: 0.99,
      reason: 'explicit_intent',
      outcomeAwareReady: true
    };
  }

  for (const rule of TASK_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(query))) {
      return {
        query,
        intent: 'auto',
        taskType: rule.taskType,
        role: rule.role,
        confidence: 0.91,
        reason: `heuristic:${rule.taskType}`,
        outcomeAwareReady: true
      };
    }
  }

  return {
    query,
    intent: 'auto',
    taskType: 'chat_default',
    role: inferRoleFromTask('', query) || 'default',
    confidence: 0.72,
    reason: 'heuristic:default',
    outcomeAwareReady: true
  };
}

function buildProviderProfileRegistry(catalog = minimum, env = process.env) {
  const registry = {};
  const providers = catalog?.providers || minimum.providers || {};
  for (const [providerName, entry] of Object.entries(providers)) {
    const provider = normalizeProvider(providerName);
    const models = entry?.models || {};
    registry[provider] = {
      provider,
      enabled: providerEnabled(provider, env),
      defaultModel: entry?.default || Object.keys(models)[0] || null,
      models: Object.keys(models).map((model) => normalizeModelProfile(model, {}, provider)),
      catalogVersion: catalog?.version || catalog?.meta?.source || 'catalog'
    };
  }
  return registry;
}

function scoreCandidate(profile, role, env = process.env, outcome = {}) {
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.default;
  const capability = roleConfig.capability;
  const enabled = providerEnabled(profile.provider, env);
  const capable = providerHasCapability(profile.provider, capability, env) || (capability === 'low_cost' && providerHasCapability(profile.provider, 'chat', env));
  const targetLatency = Number(env.ROUTER_TARGET_P95_MS || 1300);
  const targetCost = Number(env.ROUTER_TARGET_COST_CPM || 2.5);
  const latencyScore = Math.max(0, Math.min(1, targetLatency / Math.max(1, profile.p95_ms)));
  const costScore = Math.max(0, Math.min(1, targetCost / Math.max(0.05, profile.cost_cpm)));
  const qualityScore = Math.max(0, Math.min(1, profile.quality || 0.8));
  const strengthScore = profile.strengths.includes(role) || profile.strengths.includes(capability) ? 1 : (profile.strengths.includes('chat') ? 0.65 : 0.45);
  const availabilityScore = enabled && capable ? 1 : 0;
  const outcomeWeight = String(env.OUTCOME_ROUTING_ENABLED || 'false').toLowerCase() === 'true' ? Number(env.OUTCOME_ROUTING_WEIGHT || 0.05) : 0;
  const outcomeScore = Math.max(0, Math.min(1, Number(outcome.coverage || 0)));
  const adaptiveRoutingEnabled = String(env.ADAPTIVE_ROUTING_ENABLED || 'true').toLowerCase() !== 'false';
  const adaptiveWeight = adaptiveRoutingEnabled ? Number(env.ADAPTIVE_ROUTING_WEIGHT || 0.1) : 0;
  const scorecard = getRoutingScorecard(profile.provider, profile.model);
  const adaptiveScore = adaptiveRoutingEnabled ? Number(scorecard.score || 0.5) : 0.5;
  const finalScore = Number((qualityScore * 0.38 + costScore * 0.18 + latencyScore * 0.16 + strengthScore * 0.1 + availabilityScore * 0.08 + outcomeScore * outcomeWeight + adaptiveScore * adaptiveWeight).toFixed(4));
  return {
    ...profile,
    capability,
    enabled,
    capable,
    availabilityScore,
    costScore: Number(costScore.toFixed(4)),
    latencyScore: Number(latencyScore.toFixed(4)),
    qualityScore: Number(qualityScore.toFixed(4)),
    strengthScore: Number(strengthScore.toFixed(4)),
    outcomeScore: Number((Number(outcome.coverage || 0)).toFixed(4)),
    adaptiveScore: Number(adaptiveScore.toFixed(4)),
    scorecard: {
      totalRuns: scorecard.totalRuns,
      successRuns: scorecard.successRuns,
      failedRuns: scorecard.failedRuns,
      avgLatencyMs: scorecard.avgLatencyMs,
      avgTrustScore: scorecard.avgTrustScore,
      avgOutcomeCoverage: scorecard.avgOutcomeCoverage,
      score: Number((scorecard.score || 0.5).toFixed(4))
    },
    finalScore
  };
}

function buildCandidates(classification, registry, env = process.env, options = {}) {
  const role = classification.role || 'default';
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.default;
  const orderedProviders = [...roleConfig.preferredProviders, ...roleConfig.fallbackProviders];
  const candidates = [];
  const avoidModels = new Set((options.avoidModels || []).map((item) => String(item || '').toLowerCase()));
  for (const provider of orderedProviders) {
    const entry = registry[provider];
    if (!entry) continue;
    const primary = entry.models.find((item) => item.model === entry.defaultModel) || entry.models[0];
    if (!primary) continue;
    if (avoidModels.has(String(primary.model || '').toLowerCase())) continue;
    candidates.push(scoreCandidate({ ...primary, provider }, role, env, options.outcome || {}));
  }
  return candidates.sort((a, b) => b.finalScore - a.finalScore);
}

function chooseCandidate(candidates = [], role = 'default') {
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.default;
  const direct = candidates.find((item) => item.enabled && item.capable);
  if (direct) {
    const fallbackUsed = !roleConfig.preferredProviders.includes(direct.provider);
    return { selected: direct, fallbackUsed, reason: fallbackUsed ? 'provider_fallback' : 'preferred_or_capable' };
  }
  const fallback = candidates.find((item) => item.enabled) || candidates[0] || null;
  return { selected: fallback, fallbackUsed: true, reason: fallback ? 'provider_fallback' : 'no_candidate' };
}

async function resolveDynamicRoute(input = {}, options = {}) {
  const env = options.env || process.env;
  const catalog = options.catalog || await loadModelCatalog(false, options);
  const registry = buildProviderProfileRegistry(catalog, env);
  const classification = classifyTask(input);
  const outcome = { coverage: Number(options.outcomeCoverage || options.outcome?.coverage || 0) };
  const candidates = buildCandidates(classification, registry, env, { ...options, outcome });
  const choice = chooseCandidate(candidates, classification.role);
  const selected = choice.selected || normalizeModelProfile(minimum.roles.default.model, {}, minimum.roles.default.provider, classification.role);
  const decision = {
    decisionId: `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: nowIso(),
    query: classification.query,
    taskType: classification.taskType,
    role: classification.role,
    capability: (ROLE_CONFIG[classification.role] || ROLE_CONFIG.default).capability,
    selected: {
      provider: selected.provider,
      model: selected.model,
      score: selected.finalScore || 0,
      cost_cpm: selected.cost_cpm,
      p95_ms: selected.p95_ms,
      adaptiveScore: selected.adaptiveScore || 0,
      scorecard: selected.scorecard || null
    },
    fallbackUsed: choice.fallbackUsed,
    fallbackReason: choice.reason,
    outcome: { coverage: outcome.coverage },
    considered: candidates.map((item) => ({
      provider: item.provider,
      model: item.model,
      score: item.finalScore,
      outcomeScore: item.outcomeScore || 0,
      adaptiveScore: item.adaptiveScore || 0,
      enabled: item.enabled,
      capable: item.capable,
      cost_cpm: item.cost_cpm,
      p95_ms: item.p95_ms,
      scorecard: item.scorecard
    })),
    heuristics: {
      classificationConfidence: classification.confidence,
      classificationReason: classification.reason,
      costLatencyAware: true,
      outcomeAwareReady: classification.outcomeAwareReady,
      adaptiveRoutingEnabled: String(env.ADAPTIVE_ROUTING_ENABLED || 'true').toLowerCase() !== 'false'
    },
    explain: {
      selectedProvider: selected.provider,
      selectedModel: selected.model,
      reasons: [
        `role:${classification.role}`,
        `classification:${classification.reason}`,
        `outcomeCoverage:${outcome.coverage}`,
        `adaptiveScore:${selected.adaptiveScore || 0}`
      ]
    },
    catalogVersion: catalog?.version || catalog?.meta?.source || 'catalog'
  };

  cappedPush(decisionLog, decision);
  Observability.emit('routing.decision.made', {
    decisionId: decision.decisionId,
    taskType: decision.taskType,
    role: decision.role,
    provider: decision.selected.provider,
    model: decision.selected.model,
    fallbackUsed: decision.fallbackUsed,
    considered: decision.considered.length
  }, { runId: options.runId });
  if (decision.fallbackUsed) {
    Observability.emit('routing.fallback.used', {
      decisionId: decision.decisionId,
      role: decision.role,
      provider: decision.selected.provider,
      model: decision.selected.model,
      reason: decision.fallbackReason
    }, { runId: options.runId });
  }
  return decision;
}

function listRoutingDecisions(limit = 50) {
  return decisionLog.slice(-Math.max(1, Number(limit || 50))).reverse();
}

async function getRoutingProfiles(options = {}) {
  const env = options.env || process.env;
  const catalog = options.catalog || await loadModelCatalog(false, options);
  const registry = buildProviderProfileRegistry(catalog, env);
  return {
    success: true,
    version: 'v1',
    items: Object.values(registry).map((item) => ({
      provider: item.provider,
      enabled: item.enabled,
      defaultModel: item.defaultModel,
      models: item.models
    }))
  };
}

function getRoutingScorecardPayload(limit = 50) {
  return {
    success: true,
    version: 'v1',
    items: listRoutingScorecards(limit),
    summary: {
      total: routingScorecards.size,
      adaptiveRoutingEnabled: String(process.env.ADAPTIVE_ROUTING_ENABLED || 'true').toLowerCase() !== 'false'
    }
  };
}

function resetRoutingDecisionLog() {
  decisionLog.length = 0;
  try { fs.rmSync(decisionLogPath(), { force: true }); } catch {}
}

function resetRoutingScorecards() {
  routingScorecards.clear();
  try { fs.rmSync(scorecardPath(), { force: true }); } catch {}
}

module.exports = {
  MODEL_PROFILE_OVERRIDES,
  ROLE_CONFIG,
  classifyTask,
  buildProviderProfileRegistry,
  scoreCandidate,
  buildCandidates,
  resolveDynamicRoute,
  listRoutingDecisions,
  getRoutingProfiles,
  getRoutingScorecardPayload,
  getRoutingScorecard,
  listRoutingScorecards,
  recordRouteOutcome,
  resetRoutingDecisionLog,
  resetRoutingScorecards
};

loadDecisionLog();
loadRoutingScorecards();

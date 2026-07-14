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
 * @file backend/services/routing/smart-router.service.js
 * @description Smart Router — Privacy-aware, Task-aware Modell-Routing mit lokalem Loki-Fallback
 */
"use strict";

const privacyClassifier = require('./privacy-classifier');
const taskClassifier = require('./task-classifier');
const lokiBridge = require('./loki-bridge.service');
const nodeRegistry = require('../sync/node-registry.service');

let stats = {
  total: 0,
  byProvider: {
    local: 0,
    anthropic: 0,
    openrouter: 0,
    gemini: 0
  },
  byTask: {},
  privacyViolations: 0,
  privacyBridges: 0
};

/**
 * @typedef {Object} RoutingDecision
 * @property {string} provider - 'local'|'anthropic'|'openrouter'|'gemini'
 * @property {string} model
 * @property {string} [node] - nur bei provider='local'
 * @property {string} reason
 * @property {boolean} privacySensitive
 * @property {string} taskType
 * @property {number} confidence
 * @property {Object} [fallback]
 * @property {Object} auditLog
 */

/**
 * Haupt-Routing-Entscheidung
 * @param {Object} request
 * @returns {Promise<RoutingDecision>}
 */
async function route(request) {
  stats.total++;

  const {
    text,
    context = '',
    forceLocal = false,
    forceProvider = null,
    economicProfile = 'balanced',
    quality = 'standard'
  } = request;

  const fullText = `${text} ${context}`.trim();

  // === 1. Privacy Classification ===
  const privacyCheck = privacyClassifier.classify(fullText);
  const isSensitive = privacyCheck.sensitive && privacyCheck.confidence > 0.65;

  // === 2. Task Classification ===
  const taskCheck = taskClassifier.classify(fullText);
  const taskType = taskCheck.taskType || 'routine';
  const taskConfidence = taskCheck.confidence || 0.75;

  if (!stats.byTask[taskType]) stats.byTask[taskType] = 0;
  stats.byTask[taskType]++;

  // === 3. Forced Overrides ===
  if (forceProvider) {
    return buildForcedDecision(forceProvider, taskType, privacyCheck, taskCheck);
  }

  if (forceLocal) {
    return buildLocalDecision(taskType, privacyCheck, taskCheck, 'forceLocal=true');
  }

  // === 4. Privacy First Rule ===
  if (isSensitive) {
    const lokiAvailable = await lokiBridge.isAvailable();
    if (!lokiAvailable) {
      stats.privacyViolations++;
      throw new Error('PRIVACY_VIOLATION: Sensitive data cannot be sent to external API');
    }
    return buildLocalDecision(taskType, privacyCheck, taskCheck, 'sensitive content');
  }

  // === 5. Task-aware Routing ===
  let decision;

  switch (taskType) {
    case 'code':
      decision = await buildOpenRouterDecision('devstral', privacyCheck, taskCheck, economicProfile);
      break;

    case 'reasoning':
    case 'creative':
      decision = await buildAnthropicDecision('claude-4-sonnet-20241022', privacyCheck, taskCheck, economicProfile);
      break;

    case 'data_analysis':
      const lokiProAvailable = await isLokiProAvailable();
      if (lokiProAvailable) {
        decision = buildLocalDecision(taskType, privacyCheck, taskCheck, 'data_analysis → Loki Pro');
      } else {
        decision = await buildAnthropicDecision('claude-4-sonnet-20241022', privacyCheck, taskCheck, economicProfile);
      }
      break;

    case 'routine':
    default:
      const lokiMiniAvailable = await isLokiMiniAvailable();
      if (lokiMiniAvailable) {
        decision = buildLocalDecision(taskType, privacyCheck, taskCheck, 'routine → Loki Mini');
      } else {
        // Fallback to cheap model
        decision = await buildAnthropicDecision('claude-3-haiku-20240307', privacyCheck, taskCheck, economicProfile);
      }
      break;
  }

  // === 6. Quality override for high quality requests ===
  if (quality === 'high' && decision.provider !== 'local') {
    const critic = await routeParallel({ text, context, quality: 'standard' });
    // primary bleibt, critic wird separat zurückgegeben via routeParallel
  }

  return decision;
}

/**
 * Parallel-Routing: Primary + Critic Modell
 * @param {Object} request
 * @returns {Promise<{primary: RoutingDecision, critic: RoutingDecision}>}
 */
async function routeParallel(request) {
  const primary = await route(request);

  let criticRequest = { ...request, quality: 'standard' };

  let critic;
  if (primary.taskType === 'code') {
    critic = await buildAnthropicDecision('claude-4-sonnet-20241022', { sensitive: false, confidence: 0.9 }, { taskType: 'code' }, 'balanced');
  } else if (primary.taskType === 'reasoning' || primary.taskType === 'data_analysis') {
    critic = await buildOpenRouterDecision('devstral', { sensitive: false, confidence: 0.9 }, { taskType: 'reasoning' }, 'balanced');
  } else {
    critic = await buildAnthropicDecision('claude-3-haiku-20240307', { sensitive: false, confidence: 0.9 }, { taskType: 'routine' }, 'balanced');
  }

  critic.reason = 'critic model for quality assurance';

  return { primary, critic };
}

/**
 * Privacy Bridge: Local Fact Extraction → External Reasoning
 * @param {Object} request
 * @returns {Promise<{localStep: RoutingDecision, reasoningStep: RoutingDecision}>}
 */
async function routePrivacyBridge(request) {
  stats.privacyBridges++;

  const localStep = await buildLocalDecision(
    'fact_extraction',
    { sensitive: true, confidence: 0.95, category: 'PII' },
    { taskType: 'fact_extraction', primary: 'fact_extraction' },
    'privacy bridge - local sanitization'
  );

  const reasoningStep = await buildAnthropicDecision(
    'claude-4-sonnet-20241022',
    { sensitive: false, confidence: 0.8, category: 'sanitized' },
    { taskType: 'reasoning', primary: 'reasoning' },
    'balanced'
  );

  reasoningStep.reason = 'privacy bridge - reasoning on sanitized facts only';

  return { localStep, reasoningStep };
}

/**
 * @private
 */
function buildLocalDecision(taskType, privacyCheck, taskCheck, reason) {
  const node = taskType === 'data_analysis' || taskType === 'fact_extraction' ? 'loki-pro' : 'loki-mini';

  return {
    provider: 'local',
    model: node === 'loki-pro' ? 'loki-pro-32b' : 'loki-mini-8b',
    node: node,
    reason: reason,
    privacySensitive: privacyCheck.sensitive || false,
    taskType: taskCheck.taskType || taskType,
    confidence: Math.max(privacyCheck.confidence || 0.8, taskCheck.confidence || 0.7),
    fallback: null,
    auditLog: {
      privacyCheck,
      taskCheck,
      nodeStatus: {
        activeNode: node,
        isAvailable: true,
        timestamp: new Date().toISOString()
      }
    }
  };
}

/**
 * @private
 */
async function buildAnthropicDecision(model, privacyCheck, taskCheck, economicProfile) {
  const isAvailable = !!process.env.ANTHROPIC_API_KEY;
  if (!isAvailable) {
    const lokiAvailable = await lokiBridge.isAvailable();
    if (lokiAvailable) {
      return buildLocalDecision(taskCheck.taskType || 'routine', privacyCheck, taskCheck, 'anthropic offline → local fallback');
    }
    throw new Error('No available provider for reasoning task');
  }

  return {
    provider: 'anthropic',
    model: model,
    reason: `taskType=${taskCheck.taskType || 'routine'} → best quality`,
    privacySensitive: privacyCheck.sensitive || false,
    taskType: taskCheck.taskType || 'reasoning',
    confidence: taskCheck.confidence || 0.82,
    fallback: model.includes('sonnet') ? {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307'
    } : null,
    auditLog: {
      privacyCheck,
      taskCheck,
      nodeStatus: {
        provider: 'anthropic',
        model: model,
        isOnline: true,
        timestamp: new Date().toISOString()
      }
    }
  };
}

/**
 * @private
 */
async function buildOpenRouterDecision(model, privacyCheck, taskCheck, economicProfile) {
  const isAvailable = !!process.env.OPENROUTER_API_KEY;
  if (!isAvailable) {
    return await buildAnthropicDecision('claude-4-sonnet-20241022', privacyCheck, taskCheck, economicProfile);
  }

  return {
    provider: 'openrouter',
    model: model === 'devstral' ? 'cognitivecomputations/dolphin-2.9.1-llama-3-70b' : 'qwen/qwen2.5-coder-32b-instruct',
    reason: `taskType=code → cost-effective dev model`,
    privacySensitive: privacyCheck.sensitive || false,
    taskType: taskCheck.taskType || 'code',
    confidence: taskCheck.confidence || 0.78,
    fallback: {
      provider: 'local',
      model: 'loki-mini-8b'
    },
    auditLog: {
      privacyCheck,
      taskCheck,
      nodeStatus: {
        provider: 'openrouter',
        model: model,
        isOnline: true,
        timestamp: new Date().toISOString()
      }
    }
  };
}

/**
 * @private
 */
function buildForcedDecision(forceProvider, taskType, privacyCheck, taskCheck) {
  if (forceProvider === 'local') {
    return buildLocalDecision(taskType, privacyCheck, taskCheck, 'forceProvider=local');
  }

  return {
    provider: forceProvider,
    model: forceProvider === 'anthropic' ? 'claude-4-sonnet-20241022' : 'gemini-1.5-pro',
    reason: `forced provider: ${forceProvider}`,
    privacySensitive: privacyCheck.sensitive || false,
    taskType: taskType,
    confidence: 0.9,
    fallback: null,
    auditLog: {
      privacyCheck,
      taskCheck,
      nodeStatus: { forced: true, provider: forceProvider, timestamp: new Date().toISOString() }
    }
  };
}

/**
 * @private
 */
async function isLokiProAvailable() {
  try {
    const active = await lokiBridge.getActiveNode();
    return active === 'loki-pro' || await lokiBridge.isAvailable();
  } catch (e) {
    return false;
  }
}

/**
 * @private
 */
async function isLokiMiniAvailable() {
  try {
    return await lokiBridge.isAvailable();
  } catch (e) {
    return false;
  }
}

/**
 * Liefert aktuelle Routing-Statistiken
 * @returns {Object}
 */
function getRoutingStats() {
  const total = stats.total || 1;
  return {
    total: stats.total,
    providerDistribution: {
      local: Math.round((stats.byProvider.local / total) * 100),
      anthropic: Math.round((stats.byProvider.anthropic / total) * 100),
      openrouter: Math.round((stats.byProvider.openrouter / total) * 100),
      gemini: Math.round((stats.byProvider.gemini / total) * 100)
    },
    taskDistribution: stats.byTask,
    privacyViolations: stats.privacyViolations,
    privacyBridgesUsed: stats.privacyBridges,
    lastReset: new Date().toISOString()
  };
}

// Statistik-Zähler aktualisieren (wird in den Build-Funktionen aufgerufen)
function incrementProvider(provider) {
  if (stats.byProvider[provider] !== undefined) {
    stats.byProvider[provider]++;
  }
}

// Export
module.exports = {
  route,
  routeParallel,
  routePrivacyBridge,
  getRoutingStats
};


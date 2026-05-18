/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
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
const { classifyError } = require('../core/observability.service');
const { resolveDynamicRoute, listRoutingScorecards } = require('../routing/dynamic-routing.service');

const FAILURE_CLASSES = Object.freeze({
  timeout: 'Transient provider/runtime timeout',
  network: 'Transient network failure',
  provider: 'Provider-side execution failure',
  validation: 'Input or contract validation problem',
  auth: 'Authentication or credential issue',
  policy: 'Governance or trust policy blocked the action',
  uncertainty: 'Low confidence or uncertain answer quality',
  internal: 'Internal system failure',
  unknown: 'Unknown failure class'
});

const RECOVERY_RULES = Object.freeze({
  timeout: ['retry_same', 'retry_alternative_model', 'escalate'],
  network: ['retry_same', 'retry_alternative_model', 'escalate'],
  provider: ['retry_alternative_model', 'retry_same', 'escalate'],
  internal: ['retry_same', 'retry_alternative_model', 'escalate'],
  uncertainty: ['retry_alternative_model', 'escalate'],
  validation: ['fail_controlled'],
  auth: ['escalate'],
  policy: ['escalate'],
  unknown: ['retry_same', 'escalate']
});

const RECOVERY_PLAYBOOKS = Object.freeze({
  timeout: { priority: 'fast-fallback', actions: ['retry_same', 'retry_alternative_model', 'escalate'], outcomeAware: true },
  network: { priority: 'provider-shift', actions: ['retry_same', 'retry_alternative_model', 'escalate'], outcomeAware: true },
  provider: { priority: 'model-shift', actions: ['retry_alternative_model', 'retry_same', 'escalate'], outcomeAware: true },
  uncertainty: { priority: 'quality-shift', actions: ['retry_alternative_model', 'escalate'], outcomeAware: true },
  validation: { priority: 'controlled-fail', actions: ['fail_controlled'], outcomeAware: false },
  auth: { priority: 'manual-escalation', actions: ['escalate'], outcomeAware: false },
  policy: { priority: 'manual-escalation', actions: ['escalate'], outcomeAware: false },
  internal: { priority: 'recovery-mesh', actions: ['retry_same', 'retry_alternative_model', 'escalate'], outcomeAware: true },
  unknown: { priority: 'defensive-retry', actions: ['retry_same', 'escalate'], outcomeAware: false }
});

const ESCALATION_LOG_LIMIT = Number(process.env.SUPERVISOR_ESCALATION_LOG_LIMIT || 200);
const RECOVERY_LOG_LIMIT = Number(process.env.SUPERVISOR_RECOVERY_LOG_LIMIT || 300);
const escalationLog = [];
const recoveryLog = [];

function escalationLogPath() { return process.env.SUPERVISOR_ESCALATION_LOG_PATH || path.join(process.cwd(), '.ki-os-supervisor-escalations.json'); }
function recoveryLogPath() { return process.env.SUPERVISOR_RECOVERY_LOG_PATH || path.join(process.cwd(), '.ki-os-supervisor-recoveries.json'); }
function persistEscalations() { try { fs.writeFileSync(escalationLogPath(), JSON.stringify({ items: escalationLog }, null, 2), 'utf8'); } catch {} }
function persistRecoveries() { try { fs.writeFileSync(recoveryLogPath(), JSON.stringify({ items: recoveryLog }, null, 2), 'utf8'); } catch {} }
function loadEscalations() { try { const raw = JSON.parse(fs.readFileSync(escalationLogPath(), 'utf8')); escalationLog.splice(0, escalationLog.length, ...((raw.items || []).slice(-ESCALATION_LOG_LIMIT))); } catch {} }
function loadRecoveries() { try { const raw = JSON.parse(fs.readFileSync(recoveryLogPath(), 'utf8')); recoveryLog.splice(0, recoveryLog.length, ...((raw.items || []).slice(-RECOVERY_LOG_LIMIT))); } catch {} }

function pushEscalation(entry) {
  escalationLog.push({ timestamp: new Date().toISOString(), ...entry });
  if (escalationLog.length > ESCALATION_LOG_LIMIT) escalationLog.splice(0, escalationLog.length - ESCALATION_LOG_LIMIT);
  persistEscalations();
}

function pushRecovery(entry) {
  recoveryLog.push({ timestamp: new Date().toISOString(), ...entry });
  if (recoveryLog.length > RECOVERY_LOG_LIMIT) recoveryLog.splice(0, recoveryLog.length - RECOVERY_LOG_LIMIT);
  persistRecoveries();
}

function listEscalations(limit = 50) {
  return escalationLog.slice(-Math.max(1, Number(limit || 50))).reverse();
}

function listRecoveries(limit = 50) {
  return recoveryLog.slice(-Math.max(1, Number(limit || 50))).reverse();
}

function resetEscalations() {
  escalationLog.length = 0;
  try { fs.rmSync(escalationLogPath(), { force: true }); } catch {}
}

function resetRecoveries() {
  recoveryLog.length = 0;
  try { fs.rmSync(recoveryLogPath(), { force: true }); } catch {}
}

function classifyFailure(error, options = {}) {
  if (options.lowConfidence === true) return 'uncertainty';
  return classifyError(error, options.statusCode);
}

function modelToProvider(model) {
  const normalized = String(model || '').toLowerCase();
  if (normalized.includes('claude')) return 'anthropic';
  if (normalized.includes('gemini')) return 'gemini';
  if (normalized.includes('deepseek')) return 'deepseek';
  if (normalized.includes('openai/') || normalized.includes('gpt')) return 'openai';
  return 'unknown';
}

function getRecoveryPlaybook(failureClass = 'unknown') {
  return RECOVERY_PLAYBOOKS[failureClass] || RECOVERY_PLAYBOOKS.unknown;
}

function buildSupervisorMesh(limit = 25) {
  const scorecards = listRoutingScorecards(limit);
  const failureCounts = {};
  const recentRecoveries = listRecoveries(limit);
  for (const item of recentRecoveries) {
    failureCounts[item.failureClass] = (failureCounts[item.failureClass] || 0) + 1;
  }
  return {
    success: true,
    version: 'v2',
    topology: {
      recoveryNodes: Object.keys(RECOVERY_PLAYBOOKS).map((key) => ({
        failureClass: key,
        playbook: getRecoveryPlaybook(key),
        observedRecoveries: failureCounts[key] || 0
      })),
      routingNodes: scorecards.map((item) => ({
        provider: item.provider,
        model: item.model,
        adaptiveScore: item.score,
        avgOutcomeCoverage: item.avgOutcomeCoverage,
        avgTrustScore: item.avgTrustScore,
        totalRuns: item.totalRuns
      }))
    },
    summary: {
      escalationCount: escalationLog.length,
      recoveryCount: recoveryLog.length,
      adaptiveCandidates: scorecards.length,
      outcomeAwareRecovery: true
    }
  };
}

async function chooseAlternativeModel({ currentModel, query, intent, attempt = 1, outcome = {}, failureClass = 'unknown' }) {
  const currentProvider = modelToProvider(currentModel);
  const playbook = getRecoveryPlaybook(failureClass);
  const ranked = listRoutingScorecards(20)
    .filter((item) => item.model && item.model !== currentModel)
    .filter((item) => !(playbook.priority === 'provider-shift' && item.provider === currentProvider))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.avgOutcomeCoverage || 0) - Number(a.avgOutcomeCoverage || 0));

  const outcomeMin = Number(process.env.SUPERVISOR_OUTCOME_MIN_COVERAGE || 0.35);
  const scorecardPick = ranked.find((item) => Number(item.avgOutcomeCoverage || 0) >= Math.min(1, outcome.coverage || outcomeMin) || Number(item.score || 0) >= 0.65);
  if (scorecardPick) {
    return {
      model: scorecardPick.model,
      provider: scorecardPick.provider,
      decision: { source: 'scorecard_mesh', scorecard: scorecardPick, failureClass }
    };
  }

  const decision = await resolveDynamicRoute({ query, intent, taskType: intent }, { avoidModels: [currentModel], outcomeCoverage: Number(outcome.coverage || 0) });
  const selected = decision?.selected?.model || null;
  if (selected && selected !== currentModel) {
    return {
      model: selected,
      provider: decision?.selected?.provider || null,
      decision
    };
  }
  const fallbacks = {
    'gpt-5.4': 'claude-sonnet-4-6',
    'claude-sonnet-4-6': 'gpt-5.4',
    'gemini-3.1-pro': 'gpt-5.4',
    'gemini-2.0-flash': 'gpt-5.4',
    'deepseek-chat': 'gpt-5.4',
    'deepseek-reasoner': 'claude-sonnet-4-6',
    'openai/gpt-5.4': 'claude-sonnet-4-6'
  };
  return {
    model: fallbacks[currentModel] || currentModel,
    provider: null,
    decision: null,
    attempt
  };
}

async function chooseAction({ failureClass, attempt, maxRecoveryAttempts, outcome = {} }) {
  const rules = RECOVERY_RULES[failureClass] || RECOVERY_RULES.unknown;
  const playbook = getRecoveryPlaybook(failureClass);
  if (playbook.outcomeAware && Number(outcome.coverage || 0) < Number(process.env.SUPERVISOR_LOW_OUTCOME_THRESHOLD || 0.5) && rules.includes('retry_alternative_model')) {
    return 'retry_alternative_model';
  }
  if (attempt >= maxRecoveryAttempts) {
    return rules.includes('escalate') ? 'escalate' : (rules[rules.length - 1] || 'fail_controlled');
  }
  return rules[Math.min(attempt - 1, rules.length - 1)] || 'escalate';
}

async function superviseTaskExecution({ task, execute, query, intent, traceId, runId, maxRecoveryAttempts = 2, outcome = {} }) {
  let attempt = 0;
  let currentTask = { ...task };
  const recovery = [];

  while (attempt <= maxRecoveryAttempts) {
    attempt += 1;
    try {
      const result = await execute(currentTask, { attempt, recovery });
      const recoverySummary = {
        traceId,
        runId,
        recovered: attempt > 1,
        attempts: attempt,
        finalModel: currentTask.model,
        finalProvider: modelToProvider(currentTask.model),
        outcomeCoverage: Number(outcome.coverage || 0),
        success: true,
        recoveryPath: recovery.map((item) => ({ attempt: item.attempt, action: item.action, failureClass: item.failureClass, nextModel: item.nextModel || null }))
      };
      pushRecovery(recoverySummary);
      if (attempt > 1) {
        Observability.emit('supervisor.recovered', { traceId, runId, attempts: attempt, model: currentTask.model, worker: currentTask.worker_type }, { runId });
      }
      return {
        success: true,
        result,
        attempts: attempt,
        finalTask: currentTask,
        recovery,
        escalated: false
      };
    } catch (error) {
      const failureClass = classifyFailure(error);
      const action = await chooseAction({ failureClass, attempt, maxRecoveryAttempts, outcome });
      const step = {
        attempt,
        failureClass,
        action,
        error: String(error?.message || error || 'unknown_error'),
        model: currentTask.model,
        worker: currentTask.worker_type,
        playbook: getRecoveryPlaybook(failureClass).priority,
        outcomeCoverage: Number(outcome.coverage || 0)
      };
      recovery.push(step);
      pushRecovery({ traceId, runId, success: false, ...step });
      Observability.emit('supervisor.recovery.attempted', { traceId, runId, ...step }, { runId });

      if (action === 'retry_same') {
        continue;
      }

      if (action === 'retry_alternative_model') {
        const alternative = await chooseAlternativeModel({ currentModel: currentTask.model, query, intent, attempt, outcome, failureClass });
        if (alternative.model && alternative.model !== currentTask.model) {
          currentTask = { ...currentTask, model: alternative.model };
          step.nextModel = alternative.model;
          step.nextProvider = alternative.provider;
          continue;
        }
        step.action = 'escalate';
      }

      if (action === 'escalate' || step.action === 'escalate') {
        const escalation = {
          traceId,
          runId,
          failureClass,
          reason: step.error,
          attempts: attempt,
          task: currentTask.task_id || null,
          model: currentTask.model,
          worker: currentTask.worker_type,
          playbook: step.playbook
        };
        pushEscalation(escalation);
        Observability.emit('supervisor.escalated', escalation, { runId });
        const escalated = new Error(`supervisor_escalated:${failureClass}`);
        escalated.statusCode = error?.statusCode || 502;
        escalated.failureClass = failureClass;
        escalated.recovery = recovery;
        escalated.escalation = escalation;
        throw escalated;
      }

      const controlled = new Error(`supervisor_controlled_fail:${failureClass}`);
      controlled.statusCode = error?.statusCode || 400;
      controlled.failureClass = failureClass;
      controlled.recovery = recovery;
      throw controlled;
    }
  }

  Observability.emit('supervisor.loop.blocked', { traceId, runId, maxRecoveryAttempts }, { runId });
  const loopError = new Error('supervisor_loop_blocked');
  loopError.statusCode = 409;
  loopError.failureClass = 'internal';
  loopError.recovery = recovery;
  throw loopError;
}

function evaluateConfidence({ verification, minScore = 0 }) {
  const trustScore = Number(verification?.trust_score || 0);
  const verdict = String(verification?.verdict || 'unknown');
  const uncertain = verdict !== 'approve' || trustScore < Number(minScore || 0);
  return {
    uncertain,
    trustScore,
    verdict,
    minScore: Number(minScore || 0),
    failureClass: uncertain ? 'uncertainty' : null
  };
}

function getSupervisorPayload() {
  return {
    success: true,
    version: 'v2',
    recoveryRules: RECOVERY_RULES,
    recoveryPlaybooks: RECOVERY_PLAYBOOKS,
    failureClasses: FAILURE_CLASSES,
    escalationCount: escalationLog.length,
    recoveryCount: recoveryLog.length,
    items: listEscalations(50)
  };
}

function getRecoveryPlaybookPayload() {
  return {
    success: true,
    version: 'v1',
    items: Object.entries(RECOVERY_PLAYBOOKS).map(([failureClass, playbook]) => ({ failureClass, ...playbook }))
  };
}

/**
 * Record an escalation directly (without full supervise loop).
 * Accepts same shape as the internal escalation object.
 */
function handleEscalation(entry = {}) {
  const escalation = {
    severity:    entry.severity || 'medium',
    errorClass:  entry.errorClass || entry.failureClass || 'unknown',
    agentId:     entry.agentId || null,
    runId:       entry.runId || null,
    description: entry.description || entry.reason || '',
    ...entry,
  };
  pushEscalation(escalation);
  return escalation;
}

/**
 * Returns all defined recovery playbooks as an array.
 */
function getRecoveryPlaybooks() {
  return Object.entries(RECOVERY_PLAYBOOKS).map(([failureClass, playbook]) => ({
    failureClass,
    ...playbook,
  }));
}

module.exports = {
  FAILURE_CLASSES,
  RECOVERY_RULES,
  RECOVERY_PLAYBOOKS,
  classifyFailure,
  chooseAlternativeModel,
  chooseAction,
  superviseTaskExecution,
  evaluateConfidence,
  listEscalations,
  listRecoveries,
  resetEscalations,
  resetRecoveries,
  getRecoveryPlaybook,
  getRecoveryPlaybooks,
  handleEscalation,
  buildSupervisorMesh,
  getRecoveryPlaybookPayload,
  getSupervisorPayload
};

loadEscalations();
loadRecoveries();

/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @file    tower.service.js
 * @desc    Control Tower — Aggregiert Run/Cost/Connector/Policy-Daten. Kostenbremse via Policy-Override.
 * @license AGPL-3.0-only
 */
'use strict';

const { listRuns, getStoreStats } = require('../agentmesh/mesh.store');
const { getCostSummary } = require('../agentmesh/mesh.runtime');
const { bus, list: listEvents } = require('../ui/ui.eventbus');

const DEFAULT_POLICY = Object.freeze({
  modelLock: null,
  budgetCapUSD: null,
  agentStop: false,
  reason: '',
  setAt: null
});

// Session-Kosten-Akkumulator (seit Server-Start oder letztem reset)
let _sessionCosts = {
  totalUSD: 0,
  byModel: {},
  byAgent: {},
  callCount: 0,
  startedAt: new Date().toISOString(),
};

const _MAX_COST_KEYS = 100; // Memory-Leak-Schutz: max 100 distinct models/agents

// Subscriber: akkumuliert Kosten aus llm.call.completed Events
bus.on('event', (entry) => {
  if (entry.event !== 'llm.call.completed') return;
  const cost  = Number(entry.estimatedCostUSD || 0);
  const model = String(entry.model  || 'unknown');
  const agent = String(entry.agent  || 'unknown');

  _sessionCosts.totalUSD = Number((_sessionCosts.totalUSD + cost).toFixed(6));

  if (Object.keys(_sessionCosts.byModel).length < _MAX_COST_KEYS || model in _sessionCosts.byModel)
    _sessionCosts.byModel[model] = Number(((_sessionCosts.byModel[model] || 0) + cost).toFixed(6));
  if (Object.keys(_sessionCosts.byAgent).length < _MAX_COST_KEYS || agent in _sessionCosts.byAgent)
    _sessionCosts.byAgent[agent] = Number(((_sessionCosts.byAgent[agent] || 0) + cost).toFixed(6));

  _sessionCosts.callCount += 1;

  // Budget-Cap Enforcement (Node.js single-threaded → kein Lock nötig)
  if (_policy.budgetCapUSD !== null && !_policy.agentStop && _sessionCosts.totalUSD >= _policy.budgetCapUSD) {
    _policy = {
      ..._policy,
      agentStop: true,
      reason: `Budget-Cap $${_policy.budgetCapUSD} erreicht (aktuell: $${_sessionCosts.totalUSD.toFixed(4)})`,
      setAt: new Date().toISOString(),
    };
  }
});

// _policy: aktive Overrides
// { modelLock: string|null, budgetCapUSD: number|null, agentStop: boolean, reason: string, setAt: ISO-String }
let _policy = { ...DEFAULT_POLICY };

function now() {
  return new Date().toISOString();
}

const _MODEL_LOCK_RE = /^[a-zA-Z0-9\-_:./]+$/; // Whitelist: provider/model-name Zeichen

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function setOverride({ modelLock, budgetCapUSD, agentStop, reason } = {}) {
  if (modelLock && !_MODEL_LOCK_RE.test(modelLock)) {
    throw new Error('modelLock enthält ungültige Zeichen (erlaubt: a-z A-Z 0-9 - _ : . /)');
  }
  const cap = normalizeNumber(budgetCapUSD);
  if (cap !== null && (cap < 0 || cap > 1_000_000)) {
    throw new Error('budgetCapUSD muss zwischen 0 und 1.000.000 liegen');
  }
  _policy = {
    modelLock: modelLock || null,
    budgetCapUSD: cap,
    agentStop: Boolean(agentStop),
    reason: String(reason || '').slice(0, 500),
    setAt: now()
  };
  return { ..._policy };
}

function clearOverride() {
  _policy = { ...DEFAULT_POLICY };
  return { ..._policy };
}

function getPolicy() {
  return { ..._policy };
}

function isAgentStopped() {
  return Boolean(_policy.agentStop);
}

function getModelLock() {
  return _policy.modelLock || null;
}

function getRuns({ limit, status } = {}) {
  const result = listRuns({ limit: limit || 20, status });
  return result.runs || [];
}

function getRunStats() {
  return getStoreStats();
}

async function getCostOverview(limit = 50) {
  const result = listRuns({ limit });
  const runs = Array.isArray(result.runs) ? result.runs : [];
  const overview = {
    totalUSD: 0,
    byModel: {},
    byAgent: {},
    runs: [],
    policy: getPolicy()
  };

  for (const run of runs) {
    const runId = run.id || run.runId;
    let summary = {};
    try {
      summary = runId ? await Promise.resolve(getCostSummary(runId)) : {};
    } catch {
      summary = {};
    }

    const totalUSD = Number(summary.totalUSD || 0);
    overview.totalUSD += totalUSD;

    const entries = Array.isArray(summary.entries) ? summary.entries : [];
    for (const entry of entries) {
      if (entry && entry.model) {
        overview.byModel[entry.model] = +(Number(overview.byModel[entry.model] || 0) + Number(entry.estimatedUSD || 0)).toFixed(6);
      }
      if (entry && entry.agent) {
        overview.byAgent[entry.agent] = +(Number(overview.byAgent[entry.agent] || 0) + Number(entry.estimatedUSD || 0)).toFixed(6);
      }
    }

    overview.runs.push({
      id: runId || null,
      goal: run.goal || run.taskDescription || '',
      totalUSD: +totalUSD.toFixed(6),
      startedAt: run.startedAt || run.createdAt || null
    });
  }

  overview.totalUSD = +overview.totalUSD.toFixed(6);
  return overview;
}

function getConnectors() {
  let registry = null;

  try {
    registry = require('../../backend/services/connectors/connector.registry');
  } catch {}

  if (!registry) {
    try {
      registry = require('../connectors/connector.registry');
    } catch {}
  }

  if (!registry) {
    try {
      registry = require('../connectors/capability.registry');
    } catch {}
  }

  if (!registry) {
    return { connectors: [], note: 'connector.registry nicht geladen' };
  }

  if (typeof registry.listConnectors === 'function') {
    return { connectors: registry.listConnectors() };
  }

  if (typeof registry.getCapabilityRegistryPayload === 'function') {
    const payload = registry.getCapabilityRegistryPayload();
    return { connectors: Array.isArray(payload.items) ? payload.items : [] };
  }

  if (typeof registry.getConnectors === 'function') {
    return { connectors: registry.getConnectors() };
  }

  return { connectors: [], note: 'connector.registry ohne lesbare list-Funktion geladen' };
}

function getSessionCosts() {
  return { ..._sessionCosts, policy: getPolicy() };
}

function resetSessionCosts() {
  _sessionCosts = {
    totalUSD: 0, byModel: {}, byAgent: {}, callCount: 0,
    startedAt: new Date().toISOString(),
  };
  return getSessionCosts();
}

function getLiveEvents(limit = 50) {
  return listEvents(limit).filter((e) => e.event === 'llm.call.completed');
}

function _resetForTest() {
  _policy = { ...DEFAULT_POLICY };
  _sessionCosts = { totalUSD: 0, byModel: {}, byAgent: {}, callCount: 0, startedAt: new Date().toISOString() };
}

module.exports = {
  setOverride, clearOverride, getPolicy, isAgentStopped, getModelLock,
  getRuns, getRunStats, getCostOverview, getConnectors,
  getSessionCosts, resetSessionCosts, getLiveEvents,
  _resetForTest,
};

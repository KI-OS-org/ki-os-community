/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org — AgentMesh Handoff Service
 * Erstellt strukturierte Handoff-Reports für Agent-Übergaben
 */
'use strict';

const store = require('./mesh.store');

function inferCapabilities(taskDescription) {
  const text = String(taskDescription || '').toLowerCase();
  const capabilities = [];

  if (/\b(code|implement|build|write|function|class)\b/.test(text)) capabilities.push('code');
  if (/\b(research|search|find|analyz(?:e|e)|investigate)\b/.test(text)) capabilities.push('research');
  if (/\b(review|check|test|validate|verify)\b/.test(text)) capabilities.push('review');
  if (/\b(remember|store|memory|save|retrieve)\b/.test(text)) capabilities.push('memory');

  return capabilities.length ? [...new Set(capabilities)] : ['code'];
}

/**
 * Extrahiert Risiken aus Reviewer-Agent-Output
 * @param {object} run
 * @returns {string[]}
 */
function _extractRisks(run) {
  const reviewerContent = run?.agentOutputs?.reviewer?.content || run?.agentOutputs?.reviewer?.reply || '';
  const lower = String(reviewerContent).toLowerCase();
  if (lower.includes('risk')) {
    return ['Reviewer flagged risks — see agentOutputs.reviewer'];
  }
  return [];
}

/**
 * Extrahiert Artefakte (Step-IDs) aus Run
 * @param {object} run
 * @returns {string[]}
 */
function _extractArtifacts(run) {
  return run?.steps?.map(s => s.stepId || s.id).filter(Boolean) || [];
}

/**
 * Erstellt Handoff-Report für gegebenen Run
 * @param {string} runId
 * @returns {object}
 */
function createHandoff(runId) {
  const run = store.getRun(runId);
  if (!run) {
    throw new Error('Run not found: ' + runId);
  }

  return {
    runId,
    mission: run.goal || run.task || '',
    capabilities: inferCapabilities(run.taskDescription || run.task || ''),
    status: run.status,
    completedAt: run.completedAt || null,
    reflectionScore: run.result?.reflectionScore || null,
    reflectionRetries: run.result?.reflectionRetries || 0,
    reviewScore: run.result?.reviewScore || 0,
    finalAnswer: run.result?.finalAnswer || '',
    openRisks: _extractRisks(run),
    artifacts: _extractArtifacts(run),
    cost: run.result?.costSummary || {},
    nextAgent: null,
    requiredApprovals: [],
    generatedAt: new Date().toISOString()
  };
}

module.exports = { createHandoff, inferCapabilities };

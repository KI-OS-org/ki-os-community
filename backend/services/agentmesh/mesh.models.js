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
/**
 * (c) 2026 KI-OS.org — AgentMesh Runtime Models
 * Data models for AgentMesh runtime runs and steps.
 *
 * AgentMeshRun status flow:
 *   PENDING → PLANNING → EXECUTING → REVIEWING → SYNTHESIZING → COMPLETED | FAILED | CANCELLED
 *
 * AgentMeshStep status flow:
 *   PENDING → RUNNING → COMPLETED | FAILED | SKIPPED
 */
'use strict';

function now() {
  return new Date().toISOString();
}

/**
 * Creates a new AgentMesh run record.
 * @param {object} params
 * @param {string} params.runId
 * @param {string} params.taskDescription
 * @param {string} [params.userId]
 * @param {string} [params.tenantId]
 * @param {string} [params.traceId]
 * @param {string} [params.mode]
 * @returns {object}
 */
function createMeshRun({ runId, taskDescription, userId, tenantId, traceId, mode = 'runtime' }) {
  return {
    runId: String(runId || ''),
    taskDescription: String(taskDescription || ''),
    userId: String(userId || 'guest'),
    tenantId: String(tenantId || 'default'),
    traceId: String(traceId || ''),
    mode: String(mode || 'runtime'),
    status: 'PENDING',
    createdAt: now(),
    startedAt: null,
    completedAt: null,
    steps: [],
    result: null,
    error: null,
    durationMs: null
  };
}

/**
 * Creates a new AgentMesh step record.
 * @param {object} params
 * @param {string} params.runId
 * @param {string} params.stepId
 * @param {string} params.agentId
 * @param {string} params.role
 * @param {string} params.description
 * @param {object} [params.inputs]
 * @returns {object}
 */
function createMeshStep({ runId, stepId, agentId, role, description, inputs = {} }) {
  return {
    stepId: String(stepId || ''),
    runId: String(runId || ''),
    agentId: String(agentId || ''),
    role: String(role || ''),
    description: String(description || ''),
    inputs: inputs && typeof inputs === 'object' ? inputs : {},
    outputs: null,
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    error: null,
    toolCalls: [],
    policyDecision: null,
    reviewDecision: null
  };
}

module.exports = { createMeshRun, createMeshStep };

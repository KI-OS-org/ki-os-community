/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Hierarchical Worker Agent
 * Generic execution agent for manager-delegated subtasks.
 *
 * @license AGPL-3.0-only
 */
'use strict';

function uniq(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9äöüß-]+/i).filter(Boolean);
}

class WorkerAgent {
  constructor(options = {}) {
    this.id = options.id || `worker-${Math.random().toString(36).slice(2, 8)}`;
    this.name = options.name || this.id;
    this.role = 'WORKER';
    this.type = 'worker';
    this.capabilities = uniq(['generic', ...(options.capabilities || [])]);
    this.quality = Number(options.quality ?? 0.72);
    this.costPerTask = Number(options.costPerTask ?? 0.02);
    this.latencyMs = Number(options.latencyMs ?? 900);
    this.active = options.active !== false;
    this.completedTasks = 0;
    this.failedTasks = 0;
  }

  canHandle(task = {}) {
    if (!this.active) return false;
    const required = String(task.capability || task.domain || 'generic').toLowerCase();
    return required === 'generic' || this.capabilities.includes(required);
  }

  bid(task = {}, context = {}) {
    const required = String(task.capability || task.domain || 'generic').toLowerCase();
    const text = `${task.title || ''} ${task.description || ''}`;
    const tokens = tokenize(text);
    const capabilityMatch = this.capabilities.includes(required) ? 1 : required === 'generic' ? 0.8 : 0.35;
    const lexicalMatch = Math.min(1, this.capabilities.filter(c => tokens.includes(c)).length * 0.2);
    const loadPenalty = Math.min(0.25, this.completedTasks * 0.01);
    const quality = Math.max(0, Math.min(1, this.quality + lexicalMatch - loadPenalty));
    const estimatedCostUSD = Number((this.costPerTask * (task.complexity === 'high' ? 1.8 : task.complexity === 'low' ? 0.75 : 1)).toFixed(4));
    const estimatedLatencyMs = Math.round(this.latencyMs * (task.complexity === 'high' ? 1.6 : task.complexity === 'low' ? 0.8 : 1));

    return {
      agentId: this.id,
      agentName: this.name,
      role: this.role,
      type: this.type,
      taskId: task.id,
      capability: required,
      quality,
      capabilityMatch,
      estimatedCostUSD,
      estimatedLatencyMs,
      rationale: capabilityMatch >= 1 ? 'capability_match' : 'generic_fallback',
      contextSize: Array.isArray(context.memory) ? context.memory.length : 0
    };
  }

  async execute(task = {}, context = {}) {
    this.completedTasks += 1;
    const memoryHints = Array.isArray(context.memory) ? context.memory.slice(0, 3).map(item => item.text || item.id).filter(Boolean) : [];
    const output = [
      `${this.name} executed ${task.title || task.id || 'subtask'}.`,
      task.description ? `Scope: ${task.description}` : '',
      memoryHints.length ? `Memory: ${memoryHints.join(' | ')}` : ''
    ].filter(Boolean).join('\n');

    return {
      agentId: this.id,
      role: this.role,
      taskId: task.id,
      status: 'completed',
      output,
      artifacts: [],
      metrics: {
        quality: this.quality,
        costUSD: this.costPerTask,
        latencyMs: this.latencyMs
      }
    };
  }

  toA2AAgent() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      capabilities: this.capabilities,
      metadata: {
        role: this.role,
        quality: this.quality,
        costPerTask: this.costPerTask,
        latencyMs: this.latencyMs
      }
    };
  }
}

module.exports = { WorkerAgent };

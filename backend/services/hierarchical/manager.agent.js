/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Hierarchical Manager Agent
 * Plans, delegates and synthesizes manager-led agent teams.
 *
 * @license AGPL-3.0-only
 */
'use strict';

const { BiddingService } = require('./bidding.service');

const CAPABILITY_KEYWORDS = [
  ['research', /\b(research|analyse|analyze|suche|fakten|markt|quelle|wissen)\b/i],
  ['coding', /\b(code|coding|implement|umsetzen|fix|test|api|backend|frontend|runtime|service|route)\b/i],
  ['writing', /\b(write|writing|text|draft|antwort|copy|doku|summary|synthese|bericht)\b/i],
  ['review', /(review|prüf|pruef|audit|risiko|quality|qa|bewert|kontroll)/i]
];

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferCapability(text, fallback = 'generic') {
  for (const [capability, regex] of CAPABILITY_KEYWORDS) {
    if (regex.test(text || '')) return capability;
  }
  return fallback;
}

class ManagerAgent {
  constructor(options = {}) {
    this.id = options.id || 'manager-v1';
    this.name = options.name || 'Hierarchical Manager';
    this.role = 'MANAGER';
    this.type = 'manager';
    this.capabilities = ['planning', 'delegation', 'synthesis', 'bidding'];
    this.bidding = options.bidding || new BiddingService();
  }

  plan(request = {}) {
    const userRequest = String(request.task || request.request || request.prompt || '').trim();
    const explicit = Array.isArray(request.subtasks) ? request.subtasks : [];
    if (explicit.length) {
      return explicit.map((task, index) => ({
        id: task.id || `task-${index + 1}`,
        title: task.title || task.name || `Subtask ${index + 1}`,
        description: task.description || task.task || task.title || userRequest,
        capability: task.capability || task.domain || inferCapability(`${task.title || ''} ${task.description || ''}`),
        complexity: task.complexity || request.complexity || 'medium',
        budgetUSD: task.budgetUSD ?? request.budgetUSD,
        latencyTargetMs: task.latencyTargetMs ?? request.latencyTargetMs
      }));
    }

    const subtasks = [];
    const capability = inferCapability(userRequest);
    if (/\b(research|analyse|analyze|quelle|markt|wissen|fakten)\b/i.test(userRequest)) {
      subtasks.push({
        id: 'task-research',
        title: 'Research context',
        description: userRequest,
        capability: 'research',
        complexity: 'medium'
      });
    }
    if (/\b(code|coding|implement|umsetzen|fix|test|api|backend|frontend|runtime|service|route)\b/i.test(userRequest)) {
      subtasks.push({
        id: 'task-coding',
        title: 'Implement solution',
        description: userRequest,
        capability: 'coding',
        complexity: 'high'
      });
    }
    if (/\b(write|writing|antwort|doku|summary|bericht|text|synthese)\b/i.test(userRequest)) {
      subtasks.push({
        id: 'task-writing',
        title: 'Prepare response',
        description: userRequest,
        capability: 'writing',
        complexity: 'medium'
      });
    }
    if (/(review|prüf|pruef|audit|qa|risiko|quality|test)/i.test(userRequest)) {
      subtasks.push({
        id: 'task-review',
        title: 'Review result',
        description: userRequest,
        capability: 'review',
        complexity: 'medium'
      });
    }

    if (!subtasks.length) {
      subtasks.push({
        id: 'task-generic',
        title: 'Execute request',
        description: userRequest,
        capability,
        complexity: request.complexity || 'medium'
      });
    }

    return subtasks.map(task => ({
      ...task,
      budgetUSD: task.budgetUSD ?? request.budgetUSD ?? 0.25,
      latencyTargetMs: task.latencyTargetMs ?? request.latencyTargetMs ?? 2500
    }));
  }

  assign(task, agents, context = {}) {
    return this.bidding.decide(task, agents, context);
  }

  synthesize({ request, plan, assignments, results }) {
    const completed = (results || []).filter(item => item && item.status === 'completed');
    const totalCostUSD = Number(completed.reduce((sum, item) => sum + Number(item.metrics?.costUSD || 0), 0).toFixed(4));
    const avgQuality = completed.length
      ? Number((completed.reduce((sum, item) => sum + Number(item.metrics?.quality || 0), 0) / completed.length).toFixed(3))
      : 0;

    return {
      finalAnswer: completed.map(item => item.output).join('\n\n'),
      summary: {
        request: request.task || request.request || request.prompt || '',
        plannedTasks: plan.length,
        completedTasks: completed.length,
        assignedAgents: assignments.map(item => item.winner.agentId),
        totalCostUSD,
        avgQuality
      },
      assignments,
      results
    };
  }

  toA2AAgent() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      capabilities: this.capabilities,
      metadata: { role: this.role }
    };
  }
}

module.exports = { ManagerAgent, inferCapability, makeId };

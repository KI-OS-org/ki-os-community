/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Hierarchical Agent Service
 * Runtime integration for manager/worker/specialist teams.
 *
 * @license AGPL-3.0-only
 */
'use strict';

const { createMeshRun, createMeshStep } = require('../agentmesh/mesh.models');
const meshStore = require('../agentmesh/mesh.store');
const swarmMemory = require('../memory/swarm.memory');
const a2aRegistry = require('../a2a/a2a.registry');
const { publish: publishA2A } = require('../a2a/a2a.eventbus');
const { push: emitUI } = require('../ui/ui.eventbus');
const logger = require('../core/logger.service');
const { ManagerAgent, makeId } = require('./manager.agent');
const { WorkerAgent } = require('./worker.agent');
const { SpecialistAgent } = require('./specialist.agent');

function now() {
  return new Date().toISOString();
}

function createDefaultAgents() {
  return [
    new WorkerAgent({ id: 'worker-generic-1', name: 'Generic Worker 1', capabilities: ['generic', 'writing'], quality: 0.74, costPerTask: 0.018, latencyMs: 750 }),
    new WorkerAgent({ id: 'worker-generic-2', name: 'Generic Worker 2', capabilities: ['generic', 'research'], quality: 0.7, costPerTask: 0.014, latencyMs: 850 }),
    new SpecialistAgent({ id: 'specialist-research-1', domain: 'research', name: 'Research Specialist' }),
    new SpecialistAgent({ id: 'specialist-coding-1', domain: 'coding', name: 'Coding Specialist' }),
    new SpecialistAgent({ id: 'specialist-writing-1', domain: 'writing', name: 'Writing Specialist' }),
    new SpecialistAgent({ id: 'specialist-review-1', domain: 'review', name: 'Review Specialist' })
  ];
}

class HierarchicalService {
  constructor(options = {}) {
    this.manager = options.manager || new ManagerAgent();
    this.agents = options.agents || createDefaultAgents();
    this.runs = new Map();
    this.registered = false;
  }

  async ensureRegistered() {
    if (this.registered) return;
    const all = [this.manager, ...this.agents];
    for (const agent of all) {
      try {
        await a2aRegistry.register(agent.toA2AAgent());
      } catch (error) {
        logger.warn('hierarchical.a2a.register_failed', { agentId: agent.id, error: error.message });
      }
    }
    this.registered = true;
  }

  getTeams() {
    return {
      teams: [{
        teamId: 'default-hierarchical-team',
        name: 'Default Hierarchical Team',
        manager: this.manager.toA2AAgent(),
        workers: this.agents.filter(agent => agent.role === 'WORKER').map(agent => agent.toA2AAgent()),
        specialists: this.agents.filter(agent => agent.role === 'SPECIALIST').map(agent => agent.toA2AAgent()),
        capabilities: Array.from(new Set(this.agents.flatMap(agent => agent.capabilities))).sort()
      }]
    };
  }

  async run(input = {}, context = {}) {
    await this.ensureRegistered();
    const request = typeof input === 'string' ? { task: input } : { ...input };
    const taskDescription = String(request.task || request.request || request.prompt || '').trim();
    if (!taskDescription) throw new Error('task is required');

    const runId = request.runId || makeId('hier');
    const startedAtMs = Date.now();
    const userId = context.userId || request.userId || 'guest';
    const tenantId = context.tenantId || request.tenantId || 'default';

    meshStore.createRun(createMeshRun({
      runId,
      taskDescription,
      userId,
      tenantId,
      traceId: request.traceId || '',
      mode: 'hierarchical'
    }));
    meshStore.updateRun(runId, { status: 'PLANNING', startedAt: now() });
    emitUI('hierarchical.run.started', { runId, taskDescription });
    publishA2A('hierarchical.run.started', { runId, managerId: this.manager.id, taskDescription });

    const memory = swarmMemory.retrieve(taskDescription, Number(request.memoryK || 4));
    const plan = this.manager.plan({ ...request, task: taskDescription });
    const planningStep = createMeshStep({
      runId,
      stepId: `step-plan-${runId}`,
      agentId: this.manager.id,
      role: 'MANAGER',
      description: 'Plan hierarchical subtasks',
      inputs: { taskDescription }
    });
    planningStep.status = 'COMPLETED';
    planningStep.startedAt = now();
    planningStep.completedAt = now();
    planningStep.outputs = { plan, memoryCount: memory.length };
    meshStore.addStep(runId, planningStep);

    meshStore.updateRun(runId, { status: 'EXECUTING' });
    const assignments = [];
    const results = [];

    for (const task of plan) {
      const decision = this.manager.assign(task, this.agents, { request, memory });
      assignments.push(decision);
      const agent = this.agents.find(item => item.id === decision.winner.agentId);
      const stepId = `step-${task.id}-${runId}`;
      const step = createMeshStep({
        runId,
        stepId,
        agentId: agent.id,
        role: agent.role,
        description: task.title,
        inputs: { task, bid: decision.winner }
      });
      step.status = 'RUNNING';
      step.startedAt = now();
      meshStore.addStep(runId, step);

      publishA2A('agent.task_requested', {
        message: {
          messageId: makeId('a2a-hier'),
          type: 'hierarchical_task',
          from: this.manager.id,
          to: agent.id,
          payload: { runId, task, bid: decision.winner },
          correlationId: runId,
          timestamp: now()
        }
      });

      try {
        const result = await agent.execute(task, { request, memory, assignment: decision });
        results.push(result);
        meshStore.updateStep(runId, stepId, { status: 'COMPLETED', completedAt: now(), outputs: result });
        publishA2A('agent.task_completed', { runId, taskId: task.id, agentId: agent.id, result });
      } catch (error) {
        agent.failedTasks += 1;
        const failed = { agentId: agent.id, role: agent.role, taskId: task.id, status: 'failed', error: error.message };
        results.push(failed);
        meshStore.updateStep(runId, stepId, { status: 'FAILED', completedAt: now(), error: error.message, outputs: failed });
        publishA2A('agent.error', { runId, taskId: task.id, agentId: agent.id, error: error.message });
      }
    }

    meshStore.updateRun(runId, { status: 'SYNTHESIZING' });
    const synthesis = this.manager.synthesize({ request: { ...request, task: taskDescription }, plan, assignments, results });
    const durationMs = Date.now() - startedAtMs;
    const final = {
      runId,
      success: results.every(item => item.status === 'completed'),
      hierarchy: { manager: this.manager.id, roles: ['MANAGER', 'WORKER', 'SPECIALIST'] },
      plan,
      assignments,
      results,
      synthesis,
      metrics: {
        durationMs,
        totalCostUSD: synthesis.summary.totalCostUSD,
        avgQuality: synthesis.summary.avgQuality,
        memoryHits: memory.length
      }
    };

    meshStore.updateRun(runId, {
      status: final.success ? 'COMPLETED' : 'FAILED',
      completedAt: now(),
      durationMs,
      result: final
    });
    this.runs.set(runId, final);
    swarmMemory.store(`Hierarchical run ${runId}: ${taskDescription} -> ${synthesis.summary.completedTasks}/${synthesis.summary.plannedTasks} tasks completed`, {
      type: 'pattern',
      author: 'hierarchical-manager',
      feature: 'hierarchical-agents',
      runId
    });
    emitUI('hierarchical.run.completed', { runId, durationMs, success: final.success });
    publishA2A('hierarchical.run.completed', { runId, success: final.success, metrics: final.metrics });
    return final;
  }

  getStats() {
    const runs = Array.from(this.runs.values());
    const completedRuns = runs.filter(run => run.success).length;
    return {
      totalRuns: runs.length,
      completedRuns,
      failedRuns: runs.length - completedRuns,
      agents: {
        manager: 1,
        workers: this.agents.filter(agent => agent.role === 'WORKER').length,
        specialists: this.agents.filter(agent => agent.role === 'SPECIALIST').length
      },
      bidding: this.manager.bidding.getStats(),
      mesh: meshStore.getStoreStats(),
      memory: swarmMemory.getStats()
    };
  }
}

const hierarchicalService = new HierarchicalService();

module.exports = {
  HierarchicalService,
  hierarchicalService,
  runHierarchical: (input, context) => hierarchicalService.run(input, context),
  getTeams: () => hierarchicalService.getTeams(),
  getStats: () => hierarchicalService.getStats()
};

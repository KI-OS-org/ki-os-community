/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Hierarchical Agents Tests
 *
 * @license AGPL-3.0-only
 */
'use strict';

process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-hier-'));
process.env.MESH_STORE_FILE = path.join(tempDir, 'mesh-runs.json');
process.env.SWARM_MEMORY_PATH = path.join(tempDir, 'swarm.json');
process.env.ECONOMIC_OPTIMIZER_STORE_PATH = path.join(tempDir, 'economic.json');
process.env.A2A_REGISTRY_FILE = path.join(tempDir, 'a2a-registry.json');

const { HierarchicalService } = require('../hierarchical.service');
const { ManagerAgent } = require('../manager.agent');
const { WorkerAgent } = require('../worker.agent');
const { SpecialistAgent } = require('../specialist.agent');
const { BiddingService } = require('../bidding.service');

test.after(() => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('manager creates domain subtasks from user request', () => {
  const manager = new ManagerAgent();
  const plan = manager.plan({ task: 'Bitte research und coding für eine API umsetzen und reviewen' });

  assert.ok(plan.some(task => task.capability === 'research'));
  assert.ok(plan.some(task => task.capability === 'coding'));
  assert.ok(plan.some(task => task.capability === 'review'));
});

test('bidding prefers matching specialist when quality justifies cost', () => {
  const bidding = new BiddingService();
  const generic = new WorkerAgent({ id: 'generic', capabilities: ['generic'], quality: 0.7, costPerTask: 0.01 });
  const coding = new SpecialistAgent({ id: 'coding-specialist', domain: 'coding', quality: 0.9, costPerTask: 0.03 });
  const decision = bidding.decide({ id: 't1', capability: 'coding', budgetUSD: 0.2 }, [generic, coding]);

  assert.equal(decision.winner.agentId, 'coding-specialist');
  assert.equal(decision.winner.role, 'SPECIALIST');
});

test('hierarchical run delegates, executes and synthesizes', async () => {
  const service = new HierarchicalService();
  const result = await service.run({
    task: 'Implementiere eine API Route und erstelle Review Notizen',
    userId: 'tester',
    tenantId: 'tenant-test'
  });

  assert.equal(result.success, true);
  assert.equal(result.hierarchy.roles.includes('MANAGER'), true);
  assert.ok(result.plan.length >= 2);
  assert.equal(result.results.length, result.plan.length);
  assert.ok(result.assignments.every(item => item.winner.agentId));
  assert.match(result.synthesis.finalAnswer, /Coding|Review|executed/i);
  assert.ok(result.metrics.totalCostUSD > 0);
});

test('teams and stats expose manager workers specialists', () => {
  const service = new HierarchicalService();
  const teams = service.getTeams();
  const stats = service.getStats();

  assert.equal(teams.teams.length, 1);
  assert.equal(teams.teams[0].manager.metadata.role, 'MANAGER');
  assert.ok(teams.teams[0].workers.length >= 1);
  assert.ok(teams.teams[0].specialists.length >= 4);
  assert.equal(stats.agents.manager, 1);
});

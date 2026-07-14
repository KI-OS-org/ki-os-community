/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Hierarchical API Tests
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
const controller = require('../hierarchical.controller');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-hier-routes-'));
process.env.MESH_STORE_FILE = path.join(tempDir, 'mesh-runs.json');
process.env.SWARM_MEMORY_PATH = path.join(tempDir, 'swarm.json');
process.env.ECONOMIC_OPTIMIZER_STORE_PATH = path.join(tempDir, 'economic.json');
process.env.A2A_REGISTRY_FILE = path.join(tempDir, 'a2a-registry.json');

test.after(() => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('GET /api/hierarchical/teams returns default team', async () => {
  const res = createMockRes();
  await controller.getTeams({ query: {}, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.teams[0].manager.metadata.role, 'MANAGER');
});

test('POST /api/hierarchical/run starts run', async () => {
  const res = createMockRes();
  await controller.runHierarchical({ body: { task: 'Research und writing fuer eine Antwort' }, headers: {} }, res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.success, true);
  assert.equal(res.body.result.success, true);
  assert.ok(res.body.result.assignments.length >= 1);
});

test('POST /api/hierarchical/run validates task', async () => {
  const res = createMockRes();
  await controller.runHierarchical({ body: {}, headers: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('GET /api/hierarchical/stats returns stats', async () => {
  const res = createMockRes();
  await controller.getStats({ query: {}, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.stats.agents.manager, 1);
});

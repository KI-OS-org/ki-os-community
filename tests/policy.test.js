/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const assert = require('assert');
const Module = require('module');

// ── Stubs for policy.engine and privacy.guard ─────────────────────────────────
const _origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.includes('policy.engine')) {
    return {
      evaluateToolPolicy: () => ({ decision: 'allow', reason: 'test_allow' }),
      getPolicyDefinitions: () => []
    };
  }
  if (request.includes('privacy.guard')) {
    return {
      detectPII: () => ({ total: 0, types: [] }),
      maskPII: (text) => ({ masked: text })
    };
  }
  return _origLoad.apply(this, arguments);
};

const { simulatePolicy } = require('../backend/services/governance/policy.simulator');

// ── Test helpers ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

function withEnv(vars, fn) {
  const original = {};
  for (const [k, v] of Object.entries(vars)) {
    original[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(original)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// 1. simulatePolicy in development → success:true, result._note contains 'SIMULATION'
test('simulatePolicy in development → success:true, _note contains SIMULATION', () => {
  withEnv({ NODE_ENV: 'development', POLICY_SIMULATOR_ALLOW_PRODUCTION: undefined }, () => {
    const result = simulatePolicy({ role: 'admin', text: 'test query' });
    assert.strictEqual(result.success, true, `expected success:true, got: ${JSON.stringify(result)}`);
    assert.ok(result.simulation, 'expected simulation field');
    assert.ok(
      String(result.simulation._note || '').includes('SIMULATION'),
      `expected _note to contain 'SIMULATION', got: ${result.simulation._note}`
    );
  });
});

// 2. simulatePolicy in production without flag → success:false, error:'simulation_disabled_in_production'
test('simulatePolicy in production without flag → success:false, simulation_disabled_in_production', () => {
  withEnv({ NODE_ENV: 'production', POLICY_SIMULATOR_ALLOW_PRODUCTION: undefined }, () => {
    const result = simulatePolicy({ role: 'admin', text: 'test query' });
    assert.strictEqual(result.success, false, `expected success:false, got: ${JSON.stringify(result)}`);
    assert.strictEqual(result.error, 'simulation_disabled_in_production');
    assert.ok(!result.simulation, 'should not have simulation field when blocked');
  });
});

// 3. simulatePolicy in production with POLICY_SIMULATOR_ALLOW_PRODUCTION=true → success:true
test('simulatePolicy in production with POLICY_SIMULATOR_ALLOW_PRODUCTION=true → success:true', () => {
  withEnv({ NODE_ENV: 'production', POLICY_SIMULATOR_ALLOW_PRODUCTION: 'true' }, () => {
    const result = simulatePolicy({ role: 'admin', text: 'test query' });
    assert.strictEqual(result.success, true, `expected success:true, got: ${JSON.stringify(result)}`);
    assert.ok(result.simulation, 'expected simulation field');
    assert.ok(String(result.simulation._note || '').includes('SIMULATION'));
  });
});

// 4. simulatePolicy with empty payload → returns valid structure
test('simulatePolicy with empty payload → returns valid structure', () => {
  withEnv({ NODE_ENV: 'development', POLICY_SIMULATOR_ALLOW_PRODUCTION: undefined }, () => {
    const result = simulatePolicy({});
    assert.strictEqual(result.success, true);
    assert.ok(result.simulation, 'expected simulation field');
    assert.ok(typeof result.simulation.tool === 'string', 'simulation.tool should be string');
    assert.ok(typeof result.simulation.action === 'string', 'simulation.action should be string');
    assert.ok(typeof result.simulation.role === 'string', 'simulation.role should be string');
    assert.ok(result.simulation.decision, 'simulation.decision should be present');
    assert.ok(typeof result.simulation._note === 'string', 'simulation._note should be string');
  });
});

// 4b. When NODE_ENV is unset, should NOT block (only block if explicitly production)
test('simulatePolicy with NODE_ENV unset → should NOT block (success:true)', () => {
  withEnv({ NODE_ENV: undefined, POLICY_SIMULATOR_ALLOW_PRODUCTION: undefined }, () => {
    const result = simulatePolicy({ text: 'hello' });
    assert.strictEqual(result.success, true, `expected success:true when NODE_ENV not set, got: ${JSON.stringify(result)}`);
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\npolicy.test.js: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

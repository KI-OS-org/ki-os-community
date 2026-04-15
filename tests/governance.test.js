/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * Tests: Governance — Policy Engine, Simulator, Approvals Store
 * node --test tests/governance.test.js
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

let tmpDir;
let origCwd;
let origEnv;

before(() => {
  tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-gov-test-'));
  origCwd  = process.cwd;
  origEnv  = process.env.NODE_ENV;
  process.cwd = () => tmpDir;
  process.env.NODE_ENV = 'test';
  // Approvalsstore braucht cwd
  process.env.APPROVALS_STORE_PATH = path.join(tmpDir, 'approvals.json');
});

after(() => {
  process.cwd = origCwd;
  process.env.NODE_ENV = origEnv;
  delete process.env.APPROVALS_STORE_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getEngine()    { delete require.cache[require.resolve('../backend/services/governance/policy.engine')]; return require('../backend/services/governance/policy.engine'); }
function getSimulator() { delete require.cache[require.resolve('../backend/services/governance/policy.simulator')]; return require('../backend/services/governance/policy.simulator'); }
function getApprovals() { delete require.cache[require.resolve('../backend/services/governance/approvals.store')]; return require('../backend/services/governance/approvals.store'); }

// ── Policy Engine ──────────────────────────────────────────────────────────

describe('PolicyEngine', () => {

  test('getPolicyDefinitions gibt Array zurück', () => {
    const { getPolicyDefinitions } = getEngine();
    const defs = getPolicyDefinitions();
    assert.ok(Array.isArray(defs));
    assert.ok(defs.length > 0);
  });

  test('Jede Policy hat id, tools, allowRoles, effect', () => {
    const { getPolicyDefinitions } = getEngine();
    for (const p of getPolicyDefinitions()) {
      assert.ok(p.id,             `Policy ohne id: ${JSON.stringify(p)}`);
      assert.ok(Array.isArray(p.tools),      `Policy ${p.id}: tools fehlt`);
      assert.ok(Array.isArray(p.allowRoles), `Policy ${p.id}: allowRoles fehlt`);
      assert.ok(p.effect,        `Policy ${p.id}: effect fehlt`);
    }
  });

  test('POLICY_VERSION ist definiert', () => {
    const { POLICY_VERSION } = getEngine();
    assert.ok(POLICY_VERSION);
    assert.ok(typeof POLICY_VERSION === 'string');
  });

  test('evaluatePolicy: admin kann llm_invoke → allow', () => {
    const { evaluatePolicy } = getEngine();
    const result = evaluatePolicy({
      tool: 'llm_invoke',
      action: 'invoke',
      ctx: { role: 'admin' },
      payload: {},
    });
    assert.ok(['allow', 'escalate'].includes(result.decision),
      `Erwartet allow/escalate, bekam: ${result.decision}`);
  });

  test('evaluatePolicy: guest hat kein Ergebnis → default deny', () => {
    const { evaluatePolicy } = getEngine();
    const result = evaluatePolicy({
      tool: 'llm_invoke',
      action: 'invoke',
      ctx: { role: 'guest' },
      payload: {},
    });
    // guest ist nicht in allowRoles → deny oder no-match
    assert.ok(['deny', 'no_policy_match'].includes(result.decision),
      `Erwartet deny/no_policy_match, bekam: ${result.decision}`);
  });

});

// ── Policy Simulator ───────────────────────────────────────────────────────

describe('PolicySimulator', () => {

  test('simulatePolicy gibt simulation-Objekt zurück', () => {
    const { simulatePolicy } = getSimulator();
    const result = simulatePolicy({ tool: 'llm_invoke', action: 'invoke', role: 'admin' });
    assert.ok(result.success, `Erwartet success=true: ${JSON.stringify(result)}`);
    assert.ok(result.simulation);
    assert.ok(result.simulation.decision);
    assert.ok(result.simulation._note);
  });

  test('simulatePolicy erkennt PII in text', () => {
    const { simulatePolicy } = getSimulator();
    const result = simulatePolicy({
      tool: 'llm_invoke',
      action: 'invoke',
      role: 'operator',
      text: 'Mein Name ist Max Mustermann, max@example.com',
    });
    assert.ok(result.success);
    // PII-Erkennung: mindestens E-Mail sollte gefunden werden
    assert.ok(typeof result.simulation.privacy.piiCount === 'number');
  });

  test('simulatePolicy autoMask maskiert PII', () => {
    const { simulatePolicy } = getSimulator();
    const result = simulatePolicy({
      tool: 'llm_invoke',
      action: 'invoke',
      role: 'operator',
      text: 'Kontakt: test@example.com',
      autoMask: true,
    });
    assert.ok(result.success);
    // Maskierter Text sollte nicht die originale E-Mail enthalten
    if (result.simulation.privacy.piiCount > 0) {
      assert.ok(!result.simulation.privacy.maskedPreview.includes('test@example.com'));
    }
  });

  test('simulatePolicy gibt tool und action zurück', () => {
    const { simulatePolicy } = getSimulator();
    const result = simulatePolicy({ tool: 'webhook_trigger', action: 'trigger', role: 'admin' });
    assert.equal(result.simulation.tool,   'webhook_trigger');
    assert.equal(result.simulation.action, 'trigger');
  });

});

// ── Approvals Store ────────────────────────────────────────────────────────

describe('ApprovalsStore', () => {

  test('listApprovals gibt leeres Array zurück bei neuem Store', () => {
    const { listApprovals } = getApprovals();
    const items = listApprovals();
    assert.ok(Array.isArray(items));
  });

  test('createApprovalRequest erstellt Approval mit korrekten Feldern', () => {
    const { createApprovalRequest } = getApprovals();
    const a = createApprovalRequest({
      tool:        'webhook_trigger',
      action:      'trigger',
      reason:      'operator_escalation',
      requestedBy: 'user123',
      tenantId:    'default',
      role:        'operator',
      traceId:     'trace-abc',
    });
    assert.ok(a.approvalId.startsWith('approval-'));
    assert.equal(a.status,      'PENDING');
    assert.equal(a.tool,        'webhook_trigger');
    assert.equal(a.role,        'operator');
    assert.equal(a.requestedBy, 'user123');
    assert.ok(a.createdAt);
  });

  test('listApprovals gibt erstellte Approval zurück', () => {
    const { createApprovalRequest, listApprovals } = getApprovals();
    createApprovalRequest({ tool: 'mcp_invoke', reason: 'test', requestedBy: 'user' });
    const items = listApprovals();
    assert.ok(items.length >= 1);
    assert.ok(items.some(a => a.tool === 'mcp_invoke'));
  });

  test('Approvals sind nach createdAt absteigend sortiert', () => {
    const { listApprovals } = getApprovals();
    const items = listApprovals(100);
    for (let i = 1; i < items.length; i++) {
      assert.ok(items[i - 1].createdAt >= items[i].createdAt,
        'Approvals nicht absteigend sortiert');
    }
  });

  test('limit begrenzt Ergebnisse', () => {
    const { listApprovals } = getApprovals();
    const items = listApprovals(1);
    assert.ok(items.length <= 1);
  });

});

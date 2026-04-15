/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createApp } = require('../core/app');
const { detectPII, maskPII, demaskPII, evaluatePrivacyInput } = require('../backend/services/privacy/privacy.guard');
const { simulatePolicy } = require('../backend/services/governance/policy.simulator');
const { getPolicyRegistryPayload } = require('../backend/services/governance/policy.registry');
const { evaluateToolPolicy } = require('../backend/services/governance/policy.engine');
const { executeTask } = require('../backend/services/core/worker.orchestrator');
const Observability = require('../backend/services/core/observability.service');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-r12-'));
const policyPath = path.join(tempDir, 'governance.policies.json');

function writePolicies(payload) {
  fs.writeFileSync(policyPath, JSON.stringify(payload, null, 2), 'utf8');
  process.env.GOVERNANCE_POLICY_CONFIG = policyPath;
}

const basePolicies = {
  version: 'v3',
  policies: [
    { id: 'provider-call-governed', tools: ['provider_call', 'llm_invoke'], allowRoles: ['admin','operator'], escalateRoles: ['auditor'], effect: 'mixed', constraints: { allowResidencies: ['eu','de'], maxBudgetCents: 5000, allowModels: ['gpt-5.4'], killSwitchEnv: 'KI_OS_KILL_SWITCH_LLM' } },
    { id: 'web-search-basic', tools: ['web_search'], allowRoles: ['admin'], effect: 'allow' }
  ]
};

test.beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.MOCK_MODEL_CATALOG = 'true';
  delete process.env.KI_OS_KILL_SWITCH_LLM;
  writePolicies(basePolicies);
  Observability.reset();
});

test.after(() => {
  delete process.env.GOVERNANCE_POLICY_CONFIG;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('privacy guard detects common PII types', () => {
  const result = detectPII('Ich bin Max Mueller, max@example.com, +49 170 1234567, DE12500105170648489890, Hofrat-Strobel-Str. 6');
  assert.ok(result.total >= 4);
  assert.ok(result.types.includes('email'));
  assert.ok(result.types.includes('phone'));
  assert.ok(result.types.includes('iban'));
});

test('privacy masking is reversible', () => {
  const masked = maskPII('Kontakt: max@example.com und +49 170 1234567', { preserveType: true });
  assert.equal(masked.changed, true);
  assert.match(masked.masked, /PII:EMAIL/);
  const restored = demaskPII(masked.masked, masked.tokens);
  assert.equal(restored.restored, 'Kontakt: max@example.com und +49 170 1234567');
});

test('privacy input evaluation emits event and masked text', () => {
  const result = evaluatePrivacyInput({ text: 'Mail an max@example.com', source: 'unit', autoMask: true, traceId: 't1', runId: 'r1' });
  assert.equal(result.changed, true);
  const snapshot = Observability.getSnapshot();
  assert.ok((snapshot.observability.eventsByType['privacy.event'] || 0) >= 1);
});

test('policy simulator includes privacy preview and decision', () => {
  const res = simulatePolicy({ role: 'admin', tool: 'llm_invoke', action: 'chat', text: 'Mail an max@example.com', payload: { model: 'gpt-5.4', residency: 'eu' }, autoMask: true });
  assert.equal(res.success, true);
  assert.equal(res.simulation.decision.decision, 'allow');
  assert.match(res.simulation.privacy.maskedPreview, /PII:EMAIL/);
});

test('policy engine enforces residency and kill switch constraints', () => {
  let denied = evaluateToolPolicy({ tool: 'llm_invoke', action: 'chat', ctx: { role: 'admin' }, payload: { model: 'gpt-5.4', residency: 'us' } });
  assert.equal(denied.decision, 'deny');
  assert.equal(denied.reason, 'residency_not_allowed');
  process.env.KI_OS_KILL_SWITCH_LLM = 'true';
  denied = evaluateToolPolicy({ tool: 'llm_invoke', action: 'chat', ctx: { role: 'admin' }, payload: { model: 'gpt-5.4', residency: 'eu' } });
  assert.equal(denied.reason, 'kill_switch_active');
});

test('policy registry lists current and versioned configs', () => {
  fs.writeFileSync(path.join(tempDir, 'governance.policies.v2.json'), JSON.stringify({ version: 'v2', policies: [] }), 'utf8');
  const payload = getPolicyRegistryPayload();
  assert.equal(payload.success, true);
  assert.ok(payload.versions.length >= 2);
  assert.ok(payload.versions.some((entry) => entry.current === true));
});

test('privacy controller routes analyze and mask endpoints', async () => {
  const app = createApp();
  const analyze = await app.handleHttp({ runtime: 'test', path: '/privacy/analyze', method: 'POST', headers: { 'x-role': 'admin', 'x-user-id': 'ingo' }, body: { text: 'max@example.com' } });
  assert.equal(analyze.statusCode, 200);
  assert.equal(analyze.body.total, 1);
  const mask = await app.handleHttp({ runtime: 'test', path: '/privacy/mask', method: 'POST', headers: { 'x-role': 'admin', 'x-user-id': 'ingo' }, body: { text: 'max@example.com' } });
  assert.equal(mask.statusCode, 200);
  assert.match(mask.body.masked, /PII:EMAIL/);
});

test('governance registry and simulator routes work', async () => {
  const app = createApp();
  const registry = await app.handleHttp({ runtime: 'test', path: '/governance/registry', method: 'GET', headers: { 'x-role': 'admin', 'x-user-id': 'ingo' } });
  assert.equal(registry.statusCode, 200);
  assert.equal(registry.body.success, true);
  const sim = await app.handleHttp({ runtime: 'test', path: '/governance/simulate', method: 'POST', headers: { 'x-role': 'admin', 'x-user-id': 'ingo' }, body: { role: 'admin', tool: 'llm_invoke', action: 'chat', payload: { model: 'gpt-5.4', residency: 'eu' } } });
  assert.equal(sim.statusCode, 200);
  assert.equal(sim.body.simulation.decision.decision, 'allow');
});

test('worker orchestrator masks PII before provider dispatch metadata path', async () => {
  const provider = require('../backend/services/providers/openai.provider');
  const original = provider.callOpenAI;
  const originalChat = provider.chat;
  let captured = null;
  const stub = async (opts) => {
    captured = opts.messages?.[0]?.content || opts.prompt || '';
    return { text: '{"answer":"ok"}' };
  };
  provider.callOpenAI = stub;
  provider.chat = stub;
  try {
    const out = await executeTask({ worker_type: 'chat', model: 'gpt-5.4', input_data: { query: 'Mail an max@example.com' } }, null, { context: { role: 'admin' }, runId: 'r12-mask' });
    assert.equal(out.status, 'success');
    assert.ok(String(captured).includes('PII:EMAIL'));
  } finally {
    provider.callOpenAI = original;
    provider.chat = originalChat;
  }
});

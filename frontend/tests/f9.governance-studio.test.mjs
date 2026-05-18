import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = '/mnt/data/f9src/frontend/orbit-control';

test('F9 Governance Studio page contains required sections', async () => {
  const page = readFileSync(`${base}/components/governance/governance-studio-shell.tsx`, 'utf8');
  assert.match(page, /Governance Studio/);
  assert.match(page, /Policy Simulator/);
  assert.match(page, /Approval Queue/);
  assert.match(page, /Privacy Panel/);
});

test('F9 adapter exposes registry and simulator semantics', async () => {
  const adapter = readFileSync(`${base}/lib/adapters/governance-studio.ts`, 'utf8');
  assert.match(adapter, /getStudioSnapshot/);
  assert.match(adapter, /simulate/);
  assert.match(adapter, /allowedModels/);
});

test('F9 routes for registry simulate and approvals exist', async () => {
  const registry = readFileSync(`${base}/app/api/governance/registry/route.ts`, 'utf8');
  const simulate = readFileSync(`${base}/app/api/governance/simulate/route.ts`, 'utf8');
  const approvals = readFileSync(`${base}/app/api/governance/approvals/route.ts`, 'utf8');
  assert.match(registry, /policies/);
  assert.match(simulate, /decision/);
  assert.match(approvals, /approvals/);
});

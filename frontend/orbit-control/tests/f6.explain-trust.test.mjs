import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = '/mnt/data/f6src/frontend/orbit-control';

test('F6 page contains explain mode and trust lens shell', async () => {
  const page = await readFile(path.join(root, 'app/control/explain/page.tsx'), 'utf8');
  assert.match(page, /Explain Mode/);
  assert.match(page, /Trust Lens/);
  assert.match(page, /DecisionDrilldown/);
});

test('F6 adapter exposes runtime mapping and trust badges', async () => {
  const adapter = await readFile(path.join(root, 'lib/adapters/explain-trust.ts'), 'utf8');
  assert.match(adapter, /getExplainSnapshot/);
  assert.match(adapter, /getTrustLens/);
  assert.match(adapter, /getDecisionDrilldown/);
  assert.match(adapter, /Policy v3 aktiv/);
});

test('F6 route handlers exist for explain and trust payloads', async () => {
  const explain = await readFile(path.join(root, 'app/api/explain/route.ts'), 'utf8');
  const trust = await readFile(path.join(root, 'app/api/trust/route.ts'), 'utf8');
  assert.match(explain, /NextResponse\.json/);
  assert.match(trust, /NextResponse\.json/);
});

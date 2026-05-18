import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('F12 retail experience files exist', () => {
  const files = [
    'frontend/orbit-control/app/solutions/retail/page.tsx',
    'frontend/orbit-control/components/retail/retail-experience-shell.tsx',
    'frontend/orbit-control/lib/adapters/retail.ts',
    'frontend/orbit-control/app/api/retail/ops/route.ts'
  ];
  for (const file of files) assert.equal(fs.existsSync(file), true);
});

test('F12 retail page references retail experience shell', () => {
  const content = fs.readFileSync('frontend/orbit-control/app/solutions/retail/page.tsx', 'utf8');
  assert.match(content, /RetailExperienceShell/);
});

test('F12 retail shell includes required business sections', () => {
  const content = fs.readFileSync('frontend/orbit-control/components/retail/retail-experience-shell.tsx', 'utf8');
  for (const keyword of ['RetailOpsCockpit','RetailKpiCharts','RetailBrainCards','DecisionEvaluatorPanel','PromoPricingPanel','ExecutiveViewPanel']) {
    assert.match(content, new RegExp(keyword));
  }
});

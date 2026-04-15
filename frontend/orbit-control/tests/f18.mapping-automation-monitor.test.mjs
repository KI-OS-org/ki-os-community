import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../', import.meta.url).pathname;

test('F18 files exist', () => {
  const files = [
    'app/integrations/mappings/page.tsx',
    'components/mappings/mapping-studio-shell.tsx',
    'components/mappings/automation-monitor-panel.tsx',
    'lib/adapters/mappings.ts',
    'app/api/mappings/studio/route.ts',
    'app/api/automation/runs/route.ts',
    'app/api/automation/retry/route.ts',
    'app/api/automation/replay/route.ts'
  ];
  for (const rel of files) {
    assert.equal(fs.existsSync(new URL('./frontend/orbit-control/' + rel, import.meta.url)), true);
  }
});

test('F18 adapter mentions required scope', () => {
  const txt = fs.readFileSync(new URL('./frontend/orbit-control/lib/adapters/mappings.ts', import.meta.url), 'utf8');
  for (const token of ['field-mapping','transformation-preview','input-output-mapping','run-logs','retry','replay','automation-runs']) {
    assert.match(txt, new RegExp(token));
  }
});

test('F18 docs exist', () => {
  for (const rel of ['docs/F18_MAPPING_STUDIO_AUTOMATION_MONITOR.md','Dokumentation/F18_BUILD_REPORT.md','Dokumentation/F18_TEST_OUTPUT.txt','CLAUDE-QA/F18_HANDOFF.md']) {
    assert.equal(fs.existsSync(new URL('./'+rel, import.meta.url)), true);
  }
});

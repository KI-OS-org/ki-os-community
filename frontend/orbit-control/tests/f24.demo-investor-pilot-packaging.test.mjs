import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url).pathname;

test('F24 docs and handoff exist', () => {
  assert.equal(fs.existsSync(root + '../docs/F24_DEMO_INVESTOR_PILOT_PACKAGING.md'), true);
  assert.equal(fs.existsSync(root + '../CLAUDE-QA/F24_HANDOFF.md'), true);
});

test('F24 packaging route exists', () => {
  assert.equal(fs.existsSync(root + 'app/api/demo/package/route.ts'), true);
});

test('F24 demo page exists', () => {
  assert.equal(fs.existsSync(root + 'app/demo/page.tsx'), true);
});

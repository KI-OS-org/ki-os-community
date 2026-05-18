import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const adapterPath = new URL('../lib/adapters/solutions.ts', import.meta.url);
const pagePath = new URL('../app/solutions/page.tsx', import.meta.url);
const packsPath = new URL('../app/api/solutions/packs/route.ts', import.meta.url);

test('f11 solution hub files exist', () => {
  assert.equal(fs.existsSync(adapterPath), true);
  assert.equal(fs.existsSync(pagePath), true);
  assert.equal(fs.existsSync(packsPath), true);
});

test('f11 blueprint scope is represented', () => {
  const src = fs.readFileSync(adapterPath, 'utf8');
  assert.match(src, /retail/i);
  assert.match(src, /executive/i);
  assert.match(src, /status/i);
});

test('f11 role dependent access is modeled', () => {
  const src = fs.readFileSync(adapterPath, 'utf8');
  assert.match(src, /getVisibleSolutions/);
  assert.match(src, /roles/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../', import.meta.url).pathname);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('F8 page exposes operator cockpit sections', async () => {
  const page = read('app/control-plane/page.tsx');
  assert.match(page, /Control Plane/);
  assert.match(page, /HealthPanel/);
  assert.match(page, /SupervisorMeshPanel/);
});

test('F8 adapter includes all control plane domains', async () => {
  const adapter = read('lib/adapters/control-plane.ts');
  for (const token of ['health', 'incidents', 'security', 'traces', 'dlq', 'recovery', 'supervisor']) {
    assert.match(adapter, new RegExp(token));
  }
});

test('F8 api routes exist for all operator tabs', async () => {
  const required = ['health','incidents','security','traces','dlq','recovery','supervisor'];
  for (const name of required) {
    const p = path.join(root, `app/api/control-plane/${name}/route.ts`);
    assert.equal(fs.existsSync(p), true, `missing route for ${name}`);
  }
});

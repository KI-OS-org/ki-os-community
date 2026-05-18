import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'app/admin/packs/page.tsx',
  'app/admin/tenants/page.tsx',
  'lib/adapters/packs.ts',
  'lib/adapters/tenant.ts',
  'app/api/packs/install/route.ts',
  'app/api/tenants/workspaces/route.ts',
];

const root = new URL('../', import.meta.url);

test('F13 required files exist', () => {
  for (const file of files) {
    const text = readFileSync(new URL(file, root), 'utf8');
    assert.ok(text.length > 20, file);
  }
});

test('F13 adapter exposes pack install and tenant workspace creation', () => {
  const packs = readFileSync(new URL('lib/adapters/packs.ts', root), 'utf8');
  const tenant = readFileSync(new URL('lib/adapters/tenant.ts', root), 'utf8');
  assert.match(packs, /install:/);
  assert.match(packs, /history:/);
  assert.match(tenant, /createWorkspace:/);
  assert.match(tenant, /isolationStatus/);
});

test('F13 shell exposes pack and tenant admin language', () => {
  const shell = readFileSync(new URL('components/admin/pack-installer-shell.tsx', root), 'utf8');
  assert.match(shell, /Pack Installer & Tenant Admin/);
  assert.match(shell, /Installation/);
  assert.match(shell, /Tenant-Sichten/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = '/mnt/data/f5pkg/frontend/orbit-control';

test('F5 artifacts exist', () => {
  const required = [
    'app/templates/page.tsx',
    'components/templates/template-catalog.tsx',
    'components/templates/template-start-dialog.tsx',
    'components/templates/result-cards.tsx',
    'lib/adapters/templates.ts',
    'app/api/templates/start/route.ts',
  ];
  for (const file of required) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test('F5 template catalog includes at least 16 templates', () => {
  const source = fs.readFileSync(path.join(root, 'components/templates/template-catalog.tsx'), 'utf8');
  const count = (source.match(/id: '/g) || []).length;
  assert.ok(count >= 16, `expected >=16 templates, got ${count}`);
});

test('F5 adapter defines no-code start response', () => {
  const source = fs.readFileSync(path.join(root, 'lib/adapters/templates.ts'), 'utf8');
  assert.match(source, /resultCard/);
  assert.match(source, /entryDialog/);
});

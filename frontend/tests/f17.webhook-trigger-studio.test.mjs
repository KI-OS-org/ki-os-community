import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = new URL('../', import.meta.url).pathname;

test('F17 files exist', () => {
  const files = [
    'app/integrations/webhooks/page.tsx',
    'components/integrations/webhook-trigger-studio-shell.tsx',
    'lib/adapters/webhooks.ts',
  ];
  for (const file of files) {
    assert.equal(fs.existsSync(new URL(file, `file://${base}`).pathname), true);
  }
});

test('F17 api routes exist', () => {
  const files = [
    'app/api/webhooks/generator/route.ts',
    'app/api/webhooks/replay/route.ts',
    'app/api/webhooks/test/route.ts',
    'app/api/triggers/catalog/route.ts',
    'app/api/triggers/preview/route.ts',
    'app/api/triggers/bind/route.ts',
  ];
  for (const file of files) {
    assert.equal(fs.existsSync(new URL(file, `file://${base}`).pathname), true);
  }
});

test('F17 scope coverage text exists', () => {
  const text = fs.readFileSync(new URL('lib/adapters/webhooks.ts', `file://${base}`).pathname, 'utf8');
  for (const token of ['manual','schedule','webhook','polling','threshold','file upload']) {
    assert.match(text, new RegExp(token.replace(' ', ' ?')));
  }
});

/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

// ── Isolate the pack store to a temp file so tests don't touch the real store ──
const tmpStore = path.join(os.tmpdir(), `ki-os-pack-test-${Date.now()}.json`);
process.env.PACK_REGISTRY_PATH = tmpStore;

// ── Minimal tenant service stub ───────────────────────────────────────────────
const Module = require('module');
const _origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.includes('tenant.service')) {
    return {
      assertTenantAccess: () => {},
      getTenant: (id) => ({ tenantId: id, policies: [], connectors: [] }),
      upsertTenant: (input) => Object.assign({ policies: [], connectors: [] }, input),
      createWorkspace: (tenantId, ws) => Object.assign({ workspaceId: `${tenantId}-ws`, tenantId }, ws)
    };
  }
  return _origLoad.apply(this, arguments);
};

const { validatePackManifest, installPack, resetPackStore } = require('../backend/services/packs/pack.service');

// ── Clean up temp file on exit ────────────────────────────────────────────────
process.on('exit', () => { try { fs.unlinkSync(tmpStore); } catch {} });

// ── Tests ─────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

// 1. validatePackManifest(null) → valid:false, errors includes 'pack_missing'
test('validatePackManifest(null) → valid:false, errors:[pack_missing]', () => {
  const result = validatePackManifest(null);
  assert.strictEqual(result.valid, false, 'valid should be false');
  assert.ok(result.errors.includes('pack_missing'), `errors should include 'pack_missing', got: ${JSON.stringify(result.errors)}`);
});

// 1b. validatePackManifest(undefined) → valid:false, errors includes 'pack_missing'
test('validatePackManifest(undefined) → valid:false, errors:[pack_missing]', () => {
  const result = validatePackManifest(undefined);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes('pack_missing'));
});

// 2. validatePackManifest({}) → valid:false, errors includes packId/name/version errors
test('validatePackManifest({}) → valid:false with packId/name/version errors', () => {
  const result = validatePackManifest({});
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes('packId_required'), 'should include packId_required');
  assert.ok(result.errors.includes('name_required'), 'should include name_required');
  assert.ok(result.errors.includes('version_required'), 'should include version_required');
});

// 2b. validatePackManifest with empty string packId → error
test('validatePackManifest({ packId:"", name:"x", version:"1.0.0" }) → packId_required error', () => {
  const result = validatePackManifest({ packId: '', name: 'x', version: '1.0.0' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes('packId_required'), `expected packId_required in ${JSON.stringify(result.errors)}`);
});

// 2c. version must be semver-like — invalid version → version_invalid_semver
test('validatePackManifest with non-semver version → version_invalid_semver error', () => {
  const result = validatePackManifest({ packId: 'p1', name: 'P1', version: 'latest' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes('version_invalid_semver'), `expected version_invalid_semver, got: ${JSON.stringify(result.errors)}`);
});

// 3. validatePackManifest({ packId:'x', name:'y', version:'1.0.0' }) → valid:true
test('validatePackManifest({ packId:"x", name:"y", version:"1.0.0" }) → valid:true', () => {
  const result = validatePackManifest({ packId: 'x', name: 'y', version: '1.0.0' });
  assert.strictEqual(result.valid, true, `expected valid:true, errors: ${JSON.stringify(result.errors)}`);
  assert.deepStrictEqual(result.errors, []);
});

// 4. validatePackManifest with workflowBundles as string → valid:false
test('validatePackManifest with workflowBundles as string → workflowBundles_must_be_array error', () => {
  const result = validatePackManifest({ packId: 'x', name: 'y', version: '1.0.0', workflowBundles: 'not-array' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes('workflowBundles_must_be_array'), `expected workflowBundles_must_be_array, got: ${JSON.stringify(result.errors)}`);
});

// 4b. workflowBundles containing plain string items → warning (not error)
test('validatePackManifest with plain string in workflowBundles → warning, still valid', () => {
  const result = validatePackManifest({ packId: 'x', name: 'y', version: '1.0.0', workflowBundles: ['plain-string'] });
  assert.strictEqual(result.valid, true, `expected valid:true, errors: ${JSON.stringify(result.errors)}`);
  assert.ok(Array.isArray(result.warnings), 'should have warnings array');
  assert.ok(result.warnings.some(w => w.includes('plain_string')), `expected plain_string warning, got: ${JSON.stringify(result.warnings)}`);
});

// 4c. workflowBundles containing object without bundleId → error
test('validatePackManifest with bundle item missing bundleId → error', () => {
  const result = validatePackManifest({ packId: 'x', name: 'y', version: '1.0.0', workflowBundles: [{ name: 'no-id' }] });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('missing_bundleId')), `expected missing_bundleId error, got: ${JSON.stringify(result.errors)}`);
});

// 5. validatePackManifest with valid bundles array → valid:true
test('validatePackManifest with valid bundles array → valid:true', () => {
  const result = validatePackManifest({
    packId: 'pack-001',
    name: 'Test Pack',
    version: '2.0.0',
    workflowBundles: [{ bundleId: 'wf-01', name: 'WF Bundle 1' }],
    policyBundles: [{ bundleId: 'pol-01', name: 'Policy Bundle 1' }]
  });
  assert.strictEqual(result.valid, true, `expected valid:true, errors: ${JSON.stringify(result.errors)}`);
  assert.deepStrictEqual(result.errors, []);
});

// 6. installPack with invalid manifest (packId not found) → throws pack_not_found
test('installPack with unknown packId → throws pack_not_found', () => {
  resetPackStore();
  let threw = false;
  try {
    installPack({ packId: 'nonexistent-pack', tenantId: 'test-tenant' }, {});
  } catch (err) {
    threw = true;
    assert.strictEqual(err.message, 'pack_not_found', `expected pack_not_found, got: ${err.message}`);
  }
  assert.ok(threw, 'expected installPack to throw for unknown pack');
});

// 7. installPack with valid pack → returns installation record with packName and packVersion
test('installPack with valid pack → returns { success:true, item: { packName, packVersion } }', () => {
  resetPackStore();
  const result = installPack({ packId: 'retail-reference-pack', tenantId: 'test-tenant' }, {});
  assert.strictEqual(result.success, true, `expected success:true, got: ${JSON.stringify(result)}`);
  assert.ok(result.item, 'expected item in result');
  assert.ok(result.item.packName, 'expected packName in item');
  assert.ok(result.item.packVersion, 'expected packVersion in item');
  assert.strictEqual(result.item.packId, 'retail-reference-pack');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\npack.test.js: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * Tests: Connectors — Capability Registry, Profiles
 * node --test tests/connectors.test.js
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

let tmpDir;
let origCwd;

before(() => {
  tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-conn-test-'));
  origCwd = process.cwd;
  process.cwd = () => tmpDir;
  process.env.NODE_ENV = 'test';
  // Registry persists to cwd/runtime/
  fs.mkdirSync(path.join(tmpDir, 'runtime'), { recursive: true });
});

after(() => {
  process.cwd = origCwd;
  delete process.env.NODE_ENV;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getRegistry() {
  // Clear module cache so each test group gets a fresh instance
  const mod = '../backend/services/connectors/capability.registry';
  delete require.cache[require.resolve(mod)];
  return require(mod);
}

// ── Capability Registry ────────────────────────────────────────────────────

describe('CapabilityRegistry', () => {

  test('listConnectors gibt Array zurück', () => {
    const { listConnectors } = getRegistry();
    const list = listConnectors();
    assert.ok(Array.isArray(list), 'listConnectors sollte Array sein');
    assert.ok(list.length > 0, 'Mindestens 1 Default-Connector erwartet');
  });

  test('Jeder Connector hat id, name, protocol, health, trustLevel', () => {
    const { listConnectors } = getRegistry();
    for (const c of listConnectors()) {
      assert.ok(c.id,         `id fehlt: ${JSON.stringify(c)}`);
      assert.ok(c.name,       `name fehlt: ${c.id}`);
      assert.ok(c.protocol,   `protocol fehlt: ${c.id}`);
      assert.ok(c.health,     `health fehlt: ${c.id}`);
      assert.ok(c.trustLevel, `trustLevel fehlt: ${c.id}`);
    }
  });

  test('Default-Connectors enthalten desktop-native', () => {
    const { listConnectors } = getRegistry();
    const ids = listConnectors().map(c => c.id);
    assert.ok(ids.includes('desktop-native'), `desktop-native nicht gefunden, IDs: ${ids.join(', ')}`);
  });

  test('Default-Connectors enthalten mcp-bridge', () => {
    const { listConnectors } = getRegistry();
    const ids = listConnectors().map(c => c.id);
    assert.ok(ids.includes('mcp-bridge'), `mcp-bridge nicht gefunden`);
  });

  test('registerConnector fügt neuen Connector hinzu', () => {
    const { registerConnector, listConnectors } = getRegistry();
    const countBefore = listConnectors().length;
    registerConnector({
      id:           'test-webhook-connector',
      name:         'Test Webhook',
      protocol:     'mcp',
      capabilities: ['webhook.receive'],
      trustLevel:   'standard',
      metadata:     { category: 'custom' },
    });
    const countAfter = listConnectors().length;
    assert.ok(countAfter > countBefore, 'Connector wurde nicht hinzugefügt');
  });

  test('registerConnector gibt publicConnector zurück', () => {
    const { registerConnector } = getRegistry();
    const c = registerConnector({
      id:           'test-public-return',
      name:         'Public Return Test',
      protocol:     'native',
      capabilities: ['data.sync'],
      trustLevel:   'low',
      metadata:     {},
    });
    assert.ok(c.id,      'id fehlt im Rückgabewert');
    assert.ok(c.name,    'name fehlt im Rückgabewert');
    assert.ok(c.active !== undefined, 'active fehlt im Rückgabewert');
  });

  test('getConnector gibt registrierten Connector zurück', () => {
    const { registerConnector, getConnector } = getRegistry();
    registerConnector({
      id:           'test-get-connector',
      name:         'Get Test',
      protocol:     'mcp',
      capabilities: ['test.cap'],
      trustLevel:   'standard',
      metadata:     {},
    });
    const c = getConnector('test-get-connector');
    assert.ok(c, 'Connector nicht gefunden');
    assert.equal(c.id, 'test-get-connector');
  });

  test('unregisterConnector entfernt Custom-Connector', () => {
    const { registerConnector, unregisterConnector, getConnector } = getRegistry();
    registerConnector({
      id:           'test-remove-me',
      name:         'Remove Me',
      protocol:     'mcp',
      capabilities: ['test.remove'],
      trustLevel:   'low',
      metadata:     {},
    });
    const result = unregisterConnector('test-remove-me');
    assert.ok(result.success, 'success=true erwartet');
    const c = getConnector('test-remove-me');
    assert.ok(!c, 'Connector sollte nach unregister nicht mehr gefunden werden');
  });

  test('unregisterConnector wirft bei Default-Connector', () => {
    const { unregisterConnector } = getRegistry();
    assert.throws(() => unregisterConnector('desktop-native'), /connector_default_locked/);
  });

  test('listCapabilities gibt Capability-Index zurück', () => {
    const { listCapabilities } = getRegistry();
    const caps = listCapabilities();
    assert.ok(Array.isArray(caps));
    assert.ok(caps.length > 0);
    // Jeder Eintrag hat capability und connectorId
    for (const cap of caps) {
      assert.ok(cap.capability,   'capability fehlt');
      assert.ok(cap.connectorId,  'connectorId fehlt');
    }
  });

});

// ── Webhook Profiles ───────────────────────────────────────────────────────

describe('WebhookProfiles', () => {

  const PROFILES_DIR = path.join(__dirname, '..', 'backend', 'services', 'connectors', 'profiles');

  const EXPECTED_PROFILES = ['sap', 'salesforce', 'shopify', 'teams', 'slack', 's3', 'adobe', 'zapier', 'n8n', 'make'];

  test('Profile-Verzeichnis existiert', () => {
    assert.ok(fs.existsSync(PROFILES_DIR), `Profiles-Verzeichnis nicht gefunden: ${PROFILES_DIR}`);
  });

  test('Alle 10 Profile vorhanden', () => {
    for (const p of EXPECTED_PROFILES) {
      const file = path.join(PROFILES_DIR, `${p}.json`);
      assert.ok(fs.existsSync(file), `Profil fehlt: ${p}.json`);
    }
  });

  test('Jedes Profil hat profileId, name, category, capabilities', () => {
    for (const p of EXPECTED_PROFILES) {
      const raw = fs.readFileSync(path.join(PROFILES_DIR, `${p}.json`), 'utf8');
      const profile = JSON.parse(raw);
      assert.ok(profile.profileId,                   `${p}: profileId fehlt`);
      assert.ok(profile.name,                         `${p}: name fehlt`);
      assert.ok(profile.category,                     `${p}: category fehlt`);
      assert.ok(Array.isArray(profile.capabilities),  `${p}: capabilities fehlt`);
      assert.ok(profile.authType,                     `${p}: authType fehlt`);
      assert.ok(profile.webhookPattern,               `${p}: webhookPattern fehlt`);
    }
  });

  test('SAP-Profil hat ERP-Capabilities', () => {
    const raw  = fs.readFileSync(path.join(PROFILES_DIR, 'sap.json'), 'utf8');
    const prof = JSON.parse(raw);
    assert.ok(prof.capabilities.some(c => c.startsWith('erp.')), 'SAP sollte erp.* Capabilities haben');
  });

  test('Shopify-Profil hat authType=hmac', () => {
    const raw  = fs.readFileSync(path.join(PROFILES_DIR, 'shopify.json'), 'utf8');
    const prof = JSON.parse(raw);
    assert.equal(prof.authType, 'hmac');
  });

  test('Alle Profile haben gültige JSON-Syntax', () => {
    for (const p of EXPECTED_PROFILES) {
      const raw = fs.readFileSync(path.join(PROFILES_DIR, `${p}.json`), 'utf8');
      assert.doesNotThrow(() => JSON.parse(raw), `${p}.json ist kein gültiges JSON`);
    }
  });

});

import test from 'node:test';
import assert from 'node:assert/strict';
import { supportedAuthTypes, supportedConnectionTypes, maskSecret, buildCredentialProfile } from '../lib/adapters/integration-connections.ts';

test('F16 deckt mindestens 5 Verbindungstypen ab', () => {
  assert.equal(supportedConnectionTypes.length, 5);
  assert.deepEqual([...supportedConnectionTypes], ['sap','salesforce','shopify','generic-rest','webhook']);
});

test('F16 deckt Auth-Typen inkl. OAuth vorbereitet ab', () => {
  assert.deepEqual([...supportedAuthTypes], ['apiKey','basic','bearer','oauthPrepared','webhook']);
});

test('F16 maskiert Secrets und baut sichere Credential-Profile', () => {
  assert.match(maskSecret('supersecretvalue'), /^su\*\*\*ue$/);
  const profile = buildCredentialProfile('Salesforce Prod', 'bearer');
  assert.equal(profile.storedSecurely, true);
});

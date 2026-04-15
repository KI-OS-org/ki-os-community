import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultApps } from '../components/integrations/integrations-hub-shell.tsx';
import { getIntegrationsHubSnapshot } from '../lib/adapters/integrations.ts';

test('F15 deckt die 7 Pflichtkategorien ab', () => {
  const categories = [...new Set(getDefaultApps().map((app) => app.category))];
  assert.deepEqual(categories, ['ERP', 'CRM', 'E-Commerce', 'Messaging', 'Files', 'Generic API', 'Webhook']);
});

test('F15 liefert sichtbare Apps und Connection Registry', () => {
  const snapshot = getIntegrationsHubSnapshot();
  assert.equal(snapshot.apps.length >= 7, true);
  assert.equal(snapshot.connections.length >= 3, true);
});

test('F15 liefert Health-Status', () => {
  const snapshot = getIntegrationsHubSnapshot();
  assert.equal(snapshot.healthSummary.totalApps, 7);
  assert.equal(typeof snapshot.healthSummary.connected, 'number');
});

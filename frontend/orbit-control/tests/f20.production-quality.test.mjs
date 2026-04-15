import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchSections } from '../components/search/global-search-shell.js';
import { summarizeNotifications } from '../components/notifications/notification-center.js';
import { getProductionQualitySnapshot } from '../lib/adapters/production-quality.js';

test('F20 bündelt Suchergebnisse nach Typ', () => {
  const grouped = buildSearchSections([
    { id: '1', type: 'flow', title: 'A' },
    { id: '2', type: 'flow', title: 'B' },
    { id: '3', type: 'solution', title: 'C' }
  ]);
  assert.equal(grouped.length, 2);
});

test('F20 Notification Summary liefert Kennzahlen', () => {
  const summary = summarizeNotifications([
    { id: '1', level: 'critical', title: 'A', unread: true },
    { id: '2', level: 'info', title: 'B', unread: false }
  ]);
  assert.equal(summary.total, 2);
  assert.equal(summary.unread, 1);
  assert.equal(summary.critical, 1);
});

test('F20 Snapshot markiert Production Quality Bereiche', () => {
  const snapshot = getProductionQualitySnapshot();
  assert.equal(snapshot.search, true);
  assert.equal(snapshot.notifications, true);
  assert.equal(snapshot.e2eReady, true);
});

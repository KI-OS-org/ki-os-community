/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * Tests: Notification Service
 * node --test tests/notifications.test.js
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
  tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-notif-test-'));
  origCwd = process.cwd;
  process.cwd = () => tmpDir;
});

after(() => {
  process.cwd = origCwd;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getSvc() {
  // Re-require nach tmpDir-Setzen
  delete require.cache[require.resolve('../backend/services/notifications/notification.service')];
  return require('../backend/services/notifications/notification.service');
}

describe('NotificationService', () => {

  test('listNotifications gibt leeres Array zurück bei leerem Store', () => {
    const svc = getSvc();
    const items = svc.listNotifications();
    assert.ok(Array.isArray(items));
    assert.equal(items.length, 0);
  });

  test('createNotification erstellt Notification mit korrekten Feldern', () => {
    const svc = getSvc();
    const n = svc.createNotification({
      event:   'run.completed',
      title:   'Run abgeschlossen',
      message: 'Agent Run XYZ erfolgreich',
      link:    '/runs/xyz',
    });
    assert.ok(n.id.startsWith('notif-'));
    assert.equal(n.event,   'run.completed');
    assert.equal(n.type,    'success');
    assert.equal(n.title,   'Run abgeschlossen');
    assert.equal(n.message, 'Agent Run XYZ erfolgreich');
    assert.equal(n.link,    '/runs/xyz');
    assert.equal(n.read,    false);
    assert.ok(n.createdAt);
  });

  test('_defaultType: run.failed → error', () => {
    const svc = getSvc();
    const n = svc.createNotification({ event: 'run.failed', title: 'Fehler' });
    assert.equal(n.type, 'error');
  });

  test('_defaultType: budget.warning → warning', () => {
    const svc = getSvc();
    const n = svc.createNotification({ event: 'budget.warning', title: 'Budget fast aufgebraucht' });
    assert.equal(n.type, 'warning');
  });

  test('_defaultType: agent.created → info', () => {
    const svc = getSvc();
    const n = svc.createNotification({ event: 'agent.created', title: 'Neuer Agent' });
    assert.equal(n.type, 'info');
  });

  test('expliziter type überschreibt _defaultType', () => {
    const svc = getSvc();
    const n = svc.createNotification({ event: 'run.completed', type: 'warning', title: 'Test' });
    assert.equal(n.type, 'warning');
  });

  test('listNotifications gibt erstellte Notifications zurück', () => {
    const svc = getSvc();
    svc.createNotification({ event: 'system.info', title: 'Info A' });
    svc.createNotification({ event: 'system.info', title: 'Info B' });
    const items = svc.listNotifications({ limit: 10 });
    assert.ok(items.length >= 2);
  });

  test('getUnreadCount zählt korrekt', () => {
    const svc = getSvc();
    const count = svc.getUnreadCount();
    assert.ok(typeof count === 'number');
    assert.ok(count >= 0);
  });

  test('markRead setzt read=true', () => {
    const svc = getSvc();
    const n   = svc.createNotification({ event: 'system.info', title: 'Zu lesen' });
    assert.equal(n.read, false);
    const updated = svc.markRead(n.id);
    assert.equal(updated.read, true);
  });

  test('markRead gibt null für unbekannte ID zurück', () => {
    const svc = getSvc();
    const result = svc.markRead('does-not-exist');
    assert.equal(result, null);
  });

  test('markAllRead markiert alle als gelesen', () => {
    const svc = getSvc();
    svc.createNotification({ event: 'system.info', title: 'Eins' });
    svc.createNotification({ event: 'system.info', title: 'Zwei' });
    const result = svc.markAllRead();
    assert.ok(result.ok);
    assert.equal(svc.getUnreadCount(), 0);
  });

  test('deleteNotification entfernt Notification', () => {
    const svc   = getSvc();
    const n     = svc.createNotification({ event: 'system.info', title: 'Zu löschen' });
    const before = svc.listNotifications().length;
    svc.deleteNotification(n.id);
    const after  = svc.listNotifications().length;
    assert.equal(after, before - 1);
  });

  test('getFeed gibt nur ungelesene zurück (max 20)', () => {
    const svc  = getSvc();
    const feed = svc.getFeed();
    assert.ok(typeof feed.count === 'number');
    assert.ok(Array.isArray(feed.items));
    assert.ok(feed.items.length <= 20);
    for (const n of feed.items) {
      assert.equal(n.read, false);
    }
  });

  test('emit erstellt Notification für gültigen Event', () => {
    const svc    = getSvc();
    const before = svc.listNotifications().length;
    svc.emit('campaign.completed', { title: 'Kampagne fertig', message: 'Content bereit' });
    const after  = svc.listNotifications().length;
    assert.equal(after, before + 1);
  });

  test('emit ignoriert ungültigen Event', () => {
    const svc    = getSvc();
    const before = svc.listNotifications().length;
    svc.emit('unknown.event.xyz', { title: 'Test' });
    const after  = svc.listNotifications().length;
    assert.equal(after, before); // kein neuer Eintrag
  });

  test('title wird auf 120 Zeichen begrenzt', () => {
    const svc   = getSvc();
    const long  = 'A'.repeat(200);
    const n     = svc.createNotification({ event: 'system.info', title: long });
    assert.ok(n.title.length <= 120);
  });

  test('listNotifications unreadOnly=true gibt nur ungelesene zurück', () => {
    const svc = getSvc();
    const n   = svc.createNotification({ event: 'system.info', title: 'Test unread' });
    svc.markRead(n.id);
    svc.createNotification({ event: 'system.info', title: 'Noch ungelesen' });
    const unread = svc.listNotifications({ unreadOnly: true });
    for (const item of unread) {
      assert.equal(item.read, false);
    }
  });

});

/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
'use strict';

const { assertRole } = require('../ui/ui.auth');
const svc = require('./notification.service');

async function handleNotificationRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  // GET /notifications/feed  — ungelesene Notifications für Header-Bell
  if (pathname === '/notifications/feed' && method === 'GET') {
    return { statusCode: 200, body: svc.getFeed() };
  }

  // GET /notifications  — vollständige Liste
  if (pathname === '/notifications' && method === 'GET') {
    const unreadOnly = body.unreadOnly === true || body.unreadOnly === 'true';
    const limit      = Number(body.limit || 50);
    return { statusCode: 200, body: { success: true, items: svc.listNotifications({ unreadOnly, limit }) } };
  }

  // GET /notifications/count  — Anzahl ungelesener
  if (pathname === '/notifications/count' && method === 'GET') {
    return { statusCode: 200, body: { success: true, count: svc.getUnreadCount() } };
  }

  // POST /notifications  — Notification erstellen (admin/operator)
  if (pathname === '/notifications' && method === 'POST') {
    assertRole(ctx, ['admin', 'operator']);
    const n = svc.createNotification(body);
    return { statusCode: 201, body: { success: true, item: n } };
  }

  // POST /notifications/mark-all-read
  if (pathname === '/notifications/mark-all-read' && method === 'POST') {
    return { statusCode: 200, body: svc.markAllRead() };
  }

  // PATCH /notifications/:id/read
  const readMatch = pathname.match(/^\/notifications\/([^/]+)\/read$/);
  if (readMatch && method === 'PATCH') {
    const n = svc.markRead(readMatch[1]);
    if (!n) return { statusCode: 404, body: { success: false, error: 'NOT_FOUND' } };
    return { statusCode: 200, body: { success: true, item: n } };
  }

  // DELETE /notifications/:id
  const delMatch = pathname.match(/^\/notifications\/([^/]+)$/);
  if (delMatch && method === 'DELETE') {
    return { statusCode: 200, body: svc.deleteNotification(delMatch[1]) };
  }

  return { statusCode: 404, body: { success: false, error: 'notification_route_not_found' } };
}

module.exports = { handleNotificationRequest };

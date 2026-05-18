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

/**
 * Notification Service
 * Speichert System-Benachrichtigungen lokal.
 * Events: run.completed, run.failed, agent.created, campaign.completed,
 *         budget.warning, mesh.completed, repair.triggered
 */

const fs   = require('fs');
const path = require('path');
const logger = require('../core/logger.service');

const STORE_FILE   = path.join(process.cwd(), '.ki-os-notifications.json');
const MAX_ITEMS    = 200;
const TTL_MS       = 7 * 24 * 60 * 60 * 1000; // 7 Tage

const VALID_TYPES  = ['info', 'success', 'warning', 'error'];
const VALID_EVENTS = [
  'run.completed', 'run.failed', 'agent.created', 'agent.limit',
  'campaign.completed', 'campaign.failed', 'budget.warning', 'budget.exhausted',
  'mesh.completed', 'mesh.failed', 'repair.triggered', 'repair.resolved',
  'system.info', 'system.warning',
];

// ── Storage ────────────────────────────────────────────────────────────────

function readAll() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      return Array.isArray(raw) ? raw : [];
    }
  } catch { /* ignore */ }
  return [];
}

function writeAll(items) {
  const tmp = STORE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_FILE);
}

function pruneExpired(items) {
  const cutoff = Date.now() - TTL_MS;
  return items.filter(n => new Date(n.createdAt).getTime() > cutoff);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Benachrichtigung erstellen.
 * @param {{ event: string, type?: string, title: string, message?: string, link?: string, meta?: object }} input
 */
function createNotification(input = {}) {
  const event = String(input.event || 'system.info');
  const type  = VALID_TYPES.includes(input.type) ? input.type : _defaultType(event);
  const title = String(input.title || event).slice(0, 120);
  const msg   = input.message ? String(input.message).slice(0, 500) : null;
  const link  = input.link   ? String(input.link).slice(0, 200)    : null;

  const notification = {
    id:        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    event,
    type,
    title,
    message:   msg,
    link,
    meta:      input.meta ?? {},
    read:      false,
    createdAt: new Date().toISOString(),
  };

  let items = pruneExpired(readAll());
  items.unshift(notification);
  if (items.length > MAX_ITEMS) items = items.slice(0, MAX_ITEMS);
  writeAll(items);

  logger.info({ event: 'notification.created', id: notification.id, notifEvent: event, type });
  return notification;
}

/**
 * Alle Benachrichtigungen auflisten (neueste zuerst).
 * @param {{ unreadOnly?: boolean, limit?: number }} opts
 */
function listNotifications({ unreadOnly = false, limit = 50 } = {}) {
  let items = pruneExpired(readAll());
  if (unreadOnly) items = items.filter(n => !n.read);
  return items.slice(0, Math.min(200, Number(limit) || 50));
}

/** Anzahl ungelesener Benachrichtigungen. */
function getUnreadCount() {
  return pruneExpired(readAll()).filter(n => !n.read).length;
}

/** Eine Benachrichtigung als gelesen markieren. */
function markRead(id) {
  const items = readAll().map(n => n.id === id ? { ...n, read: true } : n);
  writeAll(items);
  return items.find(n => n.id === id) ?? null;
}

/** Alle Benachrichtigungen als gelesen markieren. */
function markAllRead() {
  const items = readAll().map(n => ({ ...n, read: true }));
  writeAll(items);
  return { ok: true, count: items.length };
}

/** Benachrichtigung löschen. */
function deleteNotification(id) {
  const items = readAll().filter(n => n.id !== id);
  writeAll(items);
  return { ok: true };
}

/** Feed für den Header (nur ungelesen, max 20). */
function getFeed() {
  const items = pruneExpired(readAll()).filter(n => !n.read).slice(0, 20);
  return { count: items.length, items };
}

// ── Internal ───────────────────────────────────────────────────────────────

function _defaultType(event) {
  if (event.endsWith('.failed') || event.endsWith('.error'))   return 'error';
  if (event.endsWith('.warning') || event.endsWith('.limit'))  return 'warning';
  if (event.endsWith('.completed') || event.endsWith('.resolved')) return 'success';
  return 'info';
}

// ── Observability hook — externe Events einspeisen ────────────────────────

/**
 * Aus anderen Services aufrufen um Notifications zu erzeugen.
 * Beispiel: notificationService.emit('run.failed', { title: 'Run failed', meta: { runId } })
 */
function emit(event, data = {}) {
  if (!VALID_EVENTS.includes(event)) return;
  try {
    createNotification({ event, title: data.title || event, message: data.message, link: data.link, meta: data.meta });
  } catch (e) {
    logger.warn({ event: 'notification.emit_error', notifEvent: event, error: e.message });
  }
}

module.exports = {
  createNotification,
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  getFeed,
  emit,
  VALID_EVENTS,
};

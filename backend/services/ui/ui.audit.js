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
const fs = require('fs');
const path = require('path');
const { push } = require('./ui.eventbus');

function getAuditPath() { return process.env.UI_AUDIT_PATH || path.join(process.cwd(), '.ki-os-audit.ndjson'); }
const MAX_AUDIT = Number(process.env.UI_AUDIT_LIMIT || 500);

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createEntry(action, details = {}, ctx = {}) {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    timestamp: new Date().toISOString(),
    userId: ctx?.pki?.userId || ctx?.userId || 'guest',
    tenantId: ctx?.pki?.tenantId || ctx?.tenantId || 'default',
    role: ctx?.pki?.role || ctx?.role || 'guest',
    details
  };
}

function writeAudit(action, details = {}, ctx = {}) {
  const entry = createEntry(action, details, ctx);
  const auditPath = getAuditPath();
  ensureDirFor(auditPath);
  fs.appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
  push('audit.written', { auditId: entry.id, action, details: { type: details?.type || null } });
  return entry;
}

function readEntries() {
  try {
    const raw = fs.readFileSync(getAuditPath(), 'utf8').trim();
    if (!raw) return [];
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getAuditEntries(limit = 100) {
  const safeLimit = Math.max(1, Number(limit || 100));
  const entries = readEntries();
  return entries.slice(-Math.min(MAX_AUDIT, safeLimit)).reverse();
}

function resetAudit() {
  try { fs.rmSync(getAuditPath(), { force: true }); } catch {}
}

module.exports = { writeAudit, getAuditEntries, resetAudit, _auditPath: getAuditPath };

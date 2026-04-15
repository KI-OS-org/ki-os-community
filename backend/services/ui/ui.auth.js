/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */

'use strict';

function normalizeRole(ctx = {}) {
  return String(ctx?.pki?.role || ctx?.role || 'guest').toLowerCase();
}

function isAuthenticated(ctx = {}) {
  return Boolean(ctx?.pki?.authenticated || ctx?.authenticated || normalizeRole(ctx) !== 'guest');
}

function assertAuthenticated(ctx = {}) {
  if (!isAuthenticated(ctx)) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }
  return true;
}

function assertRole(ctx = {}, allowed = ['admin', 'operator', 'viewer', 'auditor', 'user']) {
  assertAuthenticated(ctx);
  const role = normalizeRole(ctx);
  if (!allowed.map(v => String(v).toLowerCase()).includes(role)) {
    const error = new Error(`Forbidden for role ${role}`);
    error.statusCode = 403;
    throw error;
  }
  return role;
}

module.exports = { normalizeRole, isAuthenticated, assertAuthenticated, assertRole };

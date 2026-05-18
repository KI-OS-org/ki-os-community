/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: auth.controller.js
 * Express-style controller for KI-OS local auth endpoints.
 * Returns { statusCode, body } — consistent with KI-OS controller pattern.
 * @license AGPL-3.0-only
 */

'use strict';

const authService = require('./auth.community.service');

/**
 * Extract and verify the Bearer token from request headers.
 * Returns the decoded JWT payload or throws with statusCode 401.
 */
function requireAuth(headers = {}) {
  const token = authService.extractBearer(headers['authorization'] || headers['Authorization']);
  if (!token) throw Object.assign(new Error('Missing Authorization header'), { statusCode: 401 });
  return authService.verifyToken(token);
}

/**
 * Normalize an error to a structured { statusCode, body } response.
 */
function errorResponse(err) {
  const statusCode = err.statusCode || 500;
  return { statusCode, body: { success: false, error: err.message || 'Internal server error' } };
}

/**
 * Main route dispatcher.
 * @param {string} path
 * @param {string} method
 * @param {object} data   — for GET: query params; for POST: body
 * @param {object} headers
 * @returns {{ statusCode: number, body: object }}
 */
async function handleAuthRequest(path, method, data = {}, headers = {}) {
  try {
    // POST /auth/register
    if (path === '/auth/register' && method === 'POST') {
      const { email, password, name, role } = data;
      if (!email || !password) {
        return { statusCode: 400, body: { success: false, error: 'email and password are required' } };
      }
      try {
        const user = authService.createUser({ email, password, name: name || email, role: role || 'user' });
        const result = authService.authenticate(email, password);
        return {
          statusCode: 201,
          body: { success: true, token: result.token, refreshToken: result.refreshToken, user },
        };
      } catch (err) {
        return errorResponse(err);
      }
    }

    // POST /auth/login
    if (path === '/auth/login' && method === 'POST') {
      const { email, password } = data;
      if (!email || !password) {
        return { statusCode: 400, body: { success: false, error: 'email and password are required' } };
      }
      try {
        const result = authService.authenticate(email, password);
        return {
          statusCode: 200,
          body: { success: true, token: result.token, refreshToken: result.refreshToken, user: result.user },
        };
      } catch (err) {
        return errorResponse(err);
      }
    }

    // POST /auth/logout
    if (path === '/auth/logout' && method === 'POST') {
      const token = authService.extractBearer(headers['authorization'] || headers['Authorization']);
      if (token) authService.invalidateToken(token);
      return { statusCode: 200, body: { success: true } };
    }

    // GET /auth/me
    if (path === '/auth/me' && method === 'GET') {
      try {
        const payload = requireAuth(headers);
        const user = authService.getUserByEmail(payload.email);
        if (!user || !user.active) {
          return { statusCode: 404, body: { success: false, error: 'User not found' } };
        }
        return { statusCode: 200, body: { success: true, user: authService.sanitizeUser(user) } };
      } catch (err) {
        return errorResponse(err);
      }
    }

    // POST /auth/refresh
    if (path === '/auth/refresh' && method === 'POST') {
      const { refreshToken } = data;
      if (!refreshToken) {
        return { statusCode: 400, body: { success: false, error: 'refreshToken is required' } };
      }
      try {
        const result = authService.refreshToken(refreshToken);
        return { statusCode: 200, body: { success: true, token: result.token, user: result.user } };
      } catch (err) {
        return errorResponse(err);
      }
    }

    // POST /auth/users — admin only
    if (path === '/auth/users' && method === 'POST') {
      try {
        const payload = requireAuth(headers);
        if (payload.role !== 'admin') {
          return { statusCode: 403, body: { success: false, error: 'Admin role required' } };
        }
        const { email, name, role, tenant, password } = data;
        const user = authService.createUser({ email, name, role, tenant, password });
        return { statusCode: 201, body: { success: true, user } };
      } catch (err) {
        return errorResponse(err);
      }
    }

    // GET /auth/users — admin only
    if (path === '/auth/users' && method === 'GET') {
      try {
        const payload = requireAuth(headers);
        if (payload.role !== 'admin') {
          return { statusCode: 403, body: { success: false, error: 'Admin role required' } };
        }
        const users = authService.listUsers();
        return { statusCode: 200, body: { success: true, users } };
      } catch (err) {
        return errorResponse(err);
      }
    }

    // PATCH /auth/users/:id — admin or self
    if (path.match(/^\/auth\/users\/[^/]+$/) && method === 'PATCH') {
      try {
        const payload = requireAuth(headers);
        const userId = path.split('/').pop();
        if (payload.role !== 'admin' && payload.sub !== userId) {
          return { statusCode: 403, body: { success: false, error: 'Admin role or own account required' } };
        }
        const updates = {};
        if (data.name) updates.name = data.name;
        if (payload.role === 'admin') {
          if (data.role) updates.role = data.role;
          if (data.tenant) updates.tenant = data.tenant;
          if (typeof data.active === 'boolean') updates.active = data.active;
        }
        const user = authService.updateUser(userId, updates);
        return { statusCode: 200, body: { success: true, user } };
      } catch (err) {
        return errorResponse(err);
      }
    }

    // POST /auth/change-password — self only
    if (path === '/auth/change-password' && method === 'POST') {
      try {
        const payload = requireAuth(headers);
        const { currentPassword, newPassword } = data;
        if (!currentPassword || !newPassword) {
          return { statusCode: 400, body: { success: false, error: 'currentPassword and newPassword are required' } };
        }
        authService.changePassword(payload.sub, currentPassword, newPassword);
        return { statusCode: 200, body: { success: true, message: 'Password changed successfully' } };
      } catch (err) {
        return errorResponse(err);
      }
    }

    return { statusCode: 404, body: { success: false, error: 'Auth route not found', path, method } };
  } catch (err) {
    return errorResponse(err);
  }
}

module.exports = { handleAuthRequest };

/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/* (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only */
'use strict';

const { verifyToken } = require('../services/auth/auth.community.service');

function requireAuth(req, res, next) {
  const authorization = req?.headers?.authorization || req?.headers?.Authorization || '';
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const { userId, role } = verifyToken(match[1]);
    req.ctx = {
      ...(req.ctx || {}),
      pki: {
        userId,
        role,
        authenticated: true,
      },
    };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
}

module.exports = {
  requireAuth,
};

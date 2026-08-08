/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const {
  enforceConcurrentLimit,
  enforceTeamMemory,
  getPolicy
} = require('../services/core/runtime.policy');

function requireBusinessTier(req, res, next) {
  const result = enforceTeamMemory();
  if (!result.ok) {
    return res.status(403).json({
      success: false,
      error: 'business_required',
      message: result.message
    });
  }

  next();
}

function checkAgentLimit(currentConcurrent) {
  const result = enforceConcurrentLimit(currentConcurrent);
  const { limits } = getPolicy();

  return {
    allowed: result.ok,
    max: limits.maxConcurrentAgents,
    current: currentConcurrent
  };
}

module.exports = {
  requireBusinessTier,
  checkAgentLimit
};

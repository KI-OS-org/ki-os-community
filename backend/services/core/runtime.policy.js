/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const lic = require('../license/license.service');

function getPolicy() {
  return lic.getLicenseStatus();
}

function enforceConcurrentLimit(activeCount) {
  const { limits } = getPolicy();
  if (limits.maxConcurrentAgents === -1) return { ok: true };
  if (activeCount >= limits.maxConcurrentAgents) {
    return {
      ok: false,
      code: 429,
      message: `Concurrent agent limit reached (${activeCount}/${limits.maxConcurrentAgents}). See ki-os.org/business`
    };
  }
  return { ok: true };
}

function enforceTeamMemory() {
  const { limits } = getPolicy();
  if (!limits.teamMemory) {
    return {
      ok: false,
      code: 403,
      message: 'Team memory requires KI-OS Business. See ki-os.org/business'
    };
  }
  return { ok: true };
}

module.exports = { getPolicy, enforceConcurrentLimit, enforceTeamMemory };

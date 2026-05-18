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
"use strict";
const { getPolicyRegistryPayload } = require('./policy.registry');
const { simulatePolicy } = require('./policy.simulator');
const { POLICY_VERSION, getPolicyDefinitions } = require('./policy.engine');

async function handleGovernanceRequest(pathname, method, body = {}, ctx = {}) {
  if (pathname === '/governance/policies' && method === 'GET') {
    return { statusCode: 200, body: { success: true, version: POLICY_VERSION, items: getPolicyDefinitions() } };
  }
  if (pathname === '/governance/registry' && method === 'GET') {
    return { statusCode: 200, body: getPolicyRegistryPayload() };
  }
  if (pathname === '/governance/simulate' && method === 'POST') {
    return { statusCode: 200, body: simulatePolicy(body || {}) };
  }
  return { statusCode: 404, body: { success: false, error: 'Unknown governance route', path: pathname, method } };
}

module.exports = { handleGovernanceRequest };

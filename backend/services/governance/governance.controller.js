/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
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

/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
'use strict';

const ALLOWED_PROTOCOLS = new Set(['mcp', 'native']);
const ALLOWED_HEALTH = new Set(['healthy', 'degraded', 'offline', 'unknown']);
const ALLOWED_TRUST = new Set(['low', 'standard', 'high', 'restricted']);

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean) : [];
}

function validateConnectorContract(input = {}) {
  const id = String(input.id || '').trim();
  if (!id) {
    const error = new Error('connector_contract_invalid:id_required');
    error.statusCode = 400;
    throw error;
  }

  const protocol = String(input.protocol || 'native').toLowerCase();
  if (!ALLOWED_PROTOCOLS.has(protocol)) {
    const error = new Error(`connector_contract_invalid:unsupported_protocol:${protocol}`);
    error.statusCode = 400;
    throw error;
  }

  const capabilities = normalizeArray(input.capabilities);
  if (!capabilities.length) {
    const error = new Error('connector_contract_invalid:capabilities_required');
    error.statusCode = 400;
    throw error;
  }

  const health = String(input.health || 'unknown').toLowerCase();
  if (!ALLOWED_HEALTH.has(health)) {
    const error = new Error(`connector_contract_invalid:unsupported_health:${health}`);
    error.statusCode = 400;
    throw error;
  }

  const trustLevel = String(input.trustLevel || 'standard').toLowerCase();
  if (!ALLOWED_TRUST.has(trustLevel)) {
    const error = new Error(`connector_contract_invalid:unsupported_trust:${trustLevel}`);
    error.statusCode = 400;
    throw error;
  }

  return {
    id,
    name: String(input.name || id),
    protocol,
    version: String(input.version || 'v1'),
    active: input.active !== false,
    capabilities,
    health,
    trustLevel,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    routes: input.routes && typeof input.routes === 'object' ? input.routes : {},
    handler: typeof input.handler === 'function' ? input.handler : null,
    registeredAt: input.registeredAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Throws an error if the given connector is locked behind an Enterprise license.
 * Called before any invoke to prevent execution of locked connectors.
 *
 * @param {{ id: string, locked?: boolean }} connector
 */
function assertConnectorUnlocked(connector) {
  if (connector && connector.locked === true) {
    const error = new Error('Enterprise license required. Contact enterprise@ki-os.org');
    error.code = 'connector_locked';
    error.connectorId = connector.id;
    error.statusCode = 403;
    throw error;
  }
}

module.exports = {
  validateConnectorContract,
  assertConnectorUnlocked,
  ALLOWED_PROTOCOLS: Array.from(ALLOWED_PROTOCOLS),
  ALLOWED_HEALTH: Array.from(ALLOWED_HEALTH),
  ALLOWED_TRUST: Array.from(ALLOWED_TRUST)
};

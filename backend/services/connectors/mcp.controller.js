/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const { assertRole } = require('../ui/ui.auth');
const { getCapabilityRegistryPayload, getConnector } = require('./capability.registry');
const { evaluatePolicy } = require('../governance/policy.engine');
const Observability = require('../core/observability.service');

const MCP_VERSION = 'v1';

function buildEnvelope(body) {
  return {
    success: true,
    protocol: 'mcp',
    version: MCP_VERSION,
    ...body
  };
}

async function handleMcpRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  if (pathname === '/mcp' && method === 'GET') {
    return {
      statusCode: 200,
      body: buildEnvelope({
        connectorStandard: 'mcp',
        preferredPath: '/mcp/capabilities',
        endpoints: ['/mcp/capabilities', '/mcp/health', '/mcp/invoke', '/mcp/manifest']
      })
    };
  }

  if (pathname === '/mcp/capabilities' && method === 'GET') {
    const registry = getCapabilityRegistryPayload();
    Observability.emit('mcp.request.completed', { path: pathname, method, itemCount: registry.items.length });
    return { statusCode: 200, body: buildEnvelope({ registry }) };
  }

  if (pathname === '/mcp/manifest' && method === 'GET') {
    const registry = getCapabilityRegistryPayload();
    return { statusCode: 200, body: buildEnvelope({ registry, templates: registry.templates, capabilities: registry.capabilities }) };
  }

  if (pathname === '/mcp/health' && method === 'GET') {
    const registry = getCapabilityRegistryPayload();
    const items = registry.items.map((item) => ({
      id: item.id,
      protocol: item.protocol,
      active: item.active,
      health: item.health,
      trustLevel: item.trustLevel
    }));
    Observability.emit('mcp.request.completed', { path: pathname, method, itemCount: items.length });
    return { statusCode: 200, body: buildEnvelope({ items, summary: registry.summary }) };
  }

  if (pathname === '/mcp/invoke' && method === 'POST') {
    const connector = getConnector(body.connectorId);
    if (!connector) return { statusCode: 404, body: { success: false, error: 'connector_not_found', connectorId: body.connectorId } };

    const decision = evaluatePolicy({ tool: 'mcp_invoke', action: body.capability || 'invoke', ctx, payload: body });
    if (decision.decision === 'deny') {
      return { statusCode: 403, body: { success: false, error: 'forbidden_by_policy', policy: decision } };
    }

    Observability.emit('mcp.request.completed', {
      path: pathname,
      method,
      connectorId: connector.id,
      capability: body.capability || null,
      policy: decision.decision
    });
    return {
      statusCode: decision.decision === 'escalate' ? 202 : 200,
      body: {
        success: true,
        protocol: 'mcp',
        version: MCP_VERSION,
        connector,
        capability: body.capability || null,
        accepted: true,
        policy: decision,
        note: 'MCP base path active. Connector invocation contract is standardized and ready for adapter-specific execution.'
      }
    };
  }

  return { statusCode: 404, body: { success: false, error: 'Unknown MCP route', path: pathname, method } };
}

module.exports = {
  MCP_VERSION,
  handleMcpRequest
};

/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */

'use strict';

const { assertRole } = require('../ui/ui.auth');
const { getCapabilityRegistryPayload, getConnector, registerConnector, unregisterConnector, listCapabilities, resolveCapability, getFabricPayload, getEditionInfo } = require('./capability.registry');
const { saveFile, listFiles, getFileContent, deleteFile } = require('../files/file.fabric.service');
const { assertConnectorUnlocked } = require('./connector.adapter');

async function invokeBuiltInConnector(body = {}, ctx = {}) {
  const capability = String(body.capability || '').trim();
  if (!capability) return { success: false, error: 'capability_required' };
  if (capability === 'file.list') return listFiles(body.payload || {});
  if (capability === 'file.put') return saveFile({ ...(body.payload || {}), userId: body.payload?.userId || ctx?.pki?.userId || 'system' });
  if (capability === 'file.get') return getFileContent(body.payload?.fileId || body.fileId);
  if (capability === 'file.delete') return deleteFile(body.payload?.fileId || body.fileId);
  return { success: false, error: 'unsupported_connector_capability', capability };
}

async function handleConnectorRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  if (pathname === '/connectors' && method === 'GET') {
    return { statusCode: 200, body: getCapabilityRegistryPayload() };
  }
  if (pathname === '/connectors/fabric' && method === 'GET') {
    return { statusCode: 200, body: getFabricPayload() };
  }
  if (pathname === '/connectors/capabilities' && method === 'GET') {
    const q = String(body.q || '').toLowerCase();
    const items = q ? listCapabilities().filter((item) => item.capability.toLowerCase().includes(q)) : listCapabilities();
    return { statusCode: 200, body: { success: true, items } };
  }
  if (pathname === '/connectors/resolve' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: resolveCapability(body.capability) } };
  }
  if (pathname === '/connectors/health' && method === 'GET') {
    const registry = getCapabilityRegistryPayload();
    return {
      statusCode: 200,
      body: {
        success: true,
        version: registry.version,
        items: registry.items.map((item) => ({ id: item.id, health: item.health, trustLevel: item.trustLevel, protocol: item.protocol, active: item.active }))
      }
    };
  }
  if (pathname === '/connectors/register' && method === 'POST') {
    return { statusCode: 200, body: { success: true, item: registerConnector(body) } };
  }
  if (pathname === '/connectors/invoke' && method === 'POST') {
    const connectorId = body.connectorId || resolveCapability(body.capability)?.[0]?.id;
    const connector = getConnector(connectorId);
    if (!connector) return { statusCode: 404, body: { success: false, error: 'connector_not_found', connectorId } };
    try {
      assertConnectorUnlocked(connector);
    } catch (lockErr) {
      return { statusCode: 403, body: { success: false, error: lockErr.message, code: lockErr.code, connectorId, upgrade: 'https://ki-os.org/enterprise' } };
    }
    const result = await invokeBuiltInConnector({ ...body, connectorId }, ctx);
    return { statusCode: result.success === false ? 400 : 200, body: { success: result.success !== false, connectorId, capability: body.capability, result } };
  }
  if (pathname === '/connectors/edition' && method === 'GET') {
    return { statusCode: 200, body: { success: true, ...getEditionInfo() } };
  }
  if (pathname.startsWith('/connectors/') && method === 'DELETE') {
    const connectorId = decodeURIComponent(pathname.split('/').pop());
    return { statusCode: 200, body: unregisterConnector(connectorId) };
  }
  if (pathname.startsWith('/connectors/') && method === 'GET') {
    const connectorId = decodeURIComponent(pathname.split('/').pop());
    const connector = getConnector(connectorId);
    return connector ? { statusCode: 200, body: { success: true, item: connector } } : { statusCode: 404, body: { success: false, error: 'connector_not_found', connectorId } };
  }
  return { statusCode: 404, body: { success: false, error: 'Unknown connector route', path: pathname, method } };
}

module.exports = { handleConnectorRequest };

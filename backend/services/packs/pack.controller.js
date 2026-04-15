/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const { assertRole } = require('../ui/ui.auth');
const service = require('./pack.service');

async function handlePackRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  if (pathname === '/packs' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: service.listPacks() } };
  }
  if (pathname === '/packs/registry' && method === 'GET') {
    return { statusCode: 200, body: service.getPackRegistryPayload() };
  }
  if (pathname === '/packs' && method === 'POST') {
    return { statusCode: 200, body: { success: true, item: service.upsertPack(body) } };
  }
  if (pathname === '/packs/install' && method === 'POST') {
    const result = service.installPack(body, ctx);
    if (result && result.success === false) {
      return { statusCode: 400, body: result };
    }
    return { statusCode: 200, body: result };
  }
  if (pathname === '/packs/installations' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: service.listInstallations(body) } };
  }
  if (pathname === '/ui/packs' && method === 'GET') {
    return { statusCode: 200, body: Object.assign({ ui: true, traceId: ctx.traceId }, service.getPackRegistryPayload()) };
  }
  if (pathname.startsWith('/packs/') && method === 'GET') {
    const packId = decodeURIComponent(pathname.split('/').pop());
    const item = service.getPack(packId);
    if (!item) return { statusCode: 404, body: { success: false, error: 'pack_not_found', packId } };
    return { statusCode: 200, body: { success: true, item } };
  }
  return { statusCode: 404, body: { success: false, error: 'pack_route_not_found' } };
}

module.exports = { handlePackRequest };

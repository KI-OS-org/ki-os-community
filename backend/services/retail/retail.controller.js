/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const { assertRole } = require('../ui/ui.auth');
const service = require('./retail.service');

async function handleRetailRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  if (pathname === '/retail' && method === 'GET') {
    return { statusCode: 200, body: service.getRetailRootPayload(ctx) };
  }
  if (pathname === '/retail/ops' && method === 'GET') {
    return { statusCode: 200, body: service.getRetailOpsPayload() };
  }
  if (pathname === '/retail/kpis' && method === 'GET') {
    return { statusCode: 200, body: service.getKpiPayload() };
  }
  if (pathname === '/retail/marketplace' && method === 'GET') {
    return { statusCode: 200, body: service.getMarketplacePayload() };
  }
  if (pathname === '/retail/promo' && (method === 'GET' || method === 'POST')) {
    return { statusCode: 200, body: service.getPromoPayload(body) };
  }
  if (pathname === '/retail/executive' && method === 'GET') {
    return { statusCode: 200, body: service.getExecutivePayload() };
  }
  if (pathname === '/retail/demo/install' && method === 'POST') {
    return { statusCode: 200, body: service.installRetailDemo(body, ctx) };
  }
  if (pathname === '/ui/retail' && method === 'GET') {
    return { statusCode: 200, body: Object.assign({ ui: true, traceId: ctx.traceId }, service.getRetailRootPayload(ctx)) };
  }
  return { statusCode: 404, body: { success: false, error: 'retail_route_not_found' } };
}

module.exports = { handleRetailRequest };

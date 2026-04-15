/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const { assertRole } = require('../ui/ui.auth');
const service = require('./economic.service');

async function handleEconomicRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  if (pathname === '/economic' && method === 'GET') {
    return { statusCode: 200, body: service.getEconomicPayload() };
  }
  if (pathname === '/economic/profiles' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: service.listProfiles() } };
  }
  if (pathname === '/economic/scorecards' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: service.computeEconomicScorecard(body.limit || 20) } };
  }
  if (pathname === '/economic/evaluate' && (method === 'GET' || method === 'POST')) {
    return { statusCode: 200, body: { success: true, item: service.evaluateEconomicDecision(body) } };
  }
  if (pathname === '/economic/decisions' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: service.listDecisions(body.limit || 50) } };
  }
  if (pathname === '/ui/economic' && method === 'GET') {
    return {
      statusCode: 200,
      body: Object.assign({ ui: true, traceId: ctx.traceId }, service.getEconomicPayload(), {
        profiles: service.listProfiles(),
        scorecards: service.computeEconomicScorecard(10),
        decisions: service.listDecisions(10)
      })
    };
  }
  return { statusCode: 404, body: { success: false, error: 'economic_route_not_found' } };
}

module.exports = { handleEconomicRequest };

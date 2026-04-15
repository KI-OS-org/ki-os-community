/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const { assertRole } = require('../ui/ui.auth');
const { resolveDynamicRoute, getRoutingProfiles, listRoutingDecisions, getRoutingScorecardPayload } = require('./dynamic-routing.service');

async function handleRoutingRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  if ((pathname === '/routing' || pathname === '/routing/resolve') && method === 'GET') {
    const payload = await resolveDynamicRoute(body, { runId: body.runId || null });
    return { statusCode: 200, body: { success: true, decision: payload } };
  }
  if ((pathname === '/routing' || pathname === '/routing/resolve') && method === 'POST') {
    const payload = await resolveDynamicRoute(body, { runId: body.runId || null });
    return { statusCode: 200, body: { success: true, decision: payload } };
  }
  if (pathname === '/routing/profiles' && method === 'GET') {
    return { statusCode: 200, body: await getRoutingProfiles() };
  }
  if (pathname === '/routing/decisions' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: listRoutingDecisions(Number(body.limit || 50)) } };
  }
  if (pathname === '/routing/scorecards' && method === 'GET') {
    return { statusCode: 200, body: getRoutingScorecardPayload(Number(body.limit || 50)) };
  }

  return { statusCode: 404, body: { success: false, error: 'Unknown routing route', path: pathname, method } };
}

module.exports = { handleRoutingRequest };

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
/**
 * KI-OS Campaign Controller
 * HTTP-Handler für alle /campaign/* Endpunkte.
 */

'use strict';

const svc    = require('./campaign.service');
const budget = require('./budget.service');
const logger = require('../core/logger.service');
const { assertRole } = require('../ui/ui.auth');

async function handleCampaignRequest(path, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  // GET /campaign — list all
  if (path === '/campaign' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: svc.listCampaigns() } };
  }

  // POST /campaign — create
  if (path === '/campaign' && method === 'POST') {
    assertRole(ctx, ['admin', 'operator']);
    try {
      const campaign = svc.createCampaign(body);
      return { statusCode: 201, body: { success: true, item: campaign } };
    } catch (e) {
      if (e.code === 'VALIDATION_ERROR') return { statusCode: 400, body: { success: false, error: e.message } };
      throw e;
    }
  }

  // GET /campaign/:id
  const matchId = path.match(/^\/campaign\/([^/]+)$/);
  if (matchId && method === 'GET') {
    const item = svc.getCampaignStatus(matchId[1]);
    if (!item) return { statusCode: 404, body: { success: false, error: 'campaign_not_found' } };
    return { statusCode: 200, body: { success: true, item } };
  }

  // DELETE /campaign/:id
  if (matchId && method === 'DELETE') {
    assertRole(ctx, ['admin', 'operator']);
    const ok = svc.deleteCampaign(matchId[1]);
    return ok
      ? { statusCode: 200, body: { success: true } }
      : { statusCode: 404, body: { success: false, error: 'campaign_not_found' } };
  }

  // POST /campaign/:id/execute
  const matchExec = path.match(/^\/campaign\/([^/]+)\/execute$/);
  if (matchExec && method === 'POST') {
    assertRole(ctx, ['admin', 'operator']);
    try {
      const result = await svc.executeCampaign(matchExec[1], ctx);
      return { statusCode: 200, body: result };
    } catch (e) {
      const statusCode =
        e.code === 'NOT_FOUND'        ? 404 :
        e.code === 'ALREADY_RUNNING'  ? 409 :
        e.code === 'BUDGET_EXHAUSTED' ? 402 : 500;
      logger.error('campaign.controller.execute_failed', { error: e.message, code: e.code });
      return { statusCode, body: { success: false, error: e.message, code: e.code } };
    }
  }

  // GET /campaign/:id/budget
  const matchBudget = path.match(/^\/campaign\/([^/]+)\/budget$/);
  if (matchBudget && method === 'GET') {
    const status = budget.getBudgetStatus(matchBudget[1]);
    if (!status) return { statusCode: 404, body: { success: false, error: 'budget_not_found' } };
    return { statusCode: 200, body: { success: true, item: status } };
  }

  // POST /campaign/:id/budget — set/update budget
  if (matchBudget && method === 'POST') {
    assertRole(ctx, ['admin', 'operator']);
    const b = budget.createBudget({ campaignId: matchBudget[1], ...body });
    return { statusCode: 200, body: { success: true, item: b } };
  }

  return { statusCode: 404, body: { success: false, error: 'campaign_route_not_found', path, method } };
}

module.exports = { handleCampaignRequest };

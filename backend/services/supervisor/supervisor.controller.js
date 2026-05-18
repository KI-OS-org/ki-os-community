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
'use strict';

const { assertRole } = require('../ui/ui.auth');
const { classifyFailure, getSupervisorPayload, listEscalations, listRecoveries, chooseAlternativeModel, buildSupervisorMesh, getRecoveryPlaybookPayload } = require('./supervisor.service');

async function handleSupervisorRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor']);

  if (pathname === '/supervisor' && method === 'GET') {
    return { statusCode: 200, body: getSupervisorPayload() };
  }

  if (pathname === '/supervisor/escalations' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: listEscalations(Number(body.limit || 50)) } };
  }

  if (pathname === '/supervisor/recoveries' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: listRecoveries(Number(body.limit || 50)) } };
  }

  if (pathname === '/supervisor/playbooks' && method === 'GET') {
    return { statusCode: 200, body: getRecoveryPlaybookPayload() };
  }

  if (pathname === '/supervisor/mesh' && method === 'GET') {
    return { statusCode: 200, body: buildSupervisorMesh(Number(body.limit || 25)) };
  }

  if (pathname === '/supervisor/recover' && method === 'POST') {
    const failureClass = classifyFailure(body.error || body.message || 'unknown_error', { statusCode: body.statusCode, lowConfidence: body.lowConfidence });
    const alternative = await chooseAlternativeModel({ currentModel: body.currentModel || 'gpt-5.4', query: body.query || '', intent: body.intent || 'default', attempt: 1, outcome: body.outcome || {}, failureClass });
    return {
      statusCode: 200,
      body: {
        success: true,
        failureClass,
        recommended: {
          action: ['timeout', 'network', 'provider', 'internal', 'uncertainty'].includes(failureClass) ? 'retry_alternative_model' : (['auth', 'policy'].includes(failureClass) ? 'escalate' : 'fail_controlled'),
          nextModel: alternative.model,
          nextProvider: alternative.provider,
          source: alternative.decision?.source || 'router'
        }
      }
    };
  }

  return { statusCode: 404, body: { success: false, error: 'Unknown supervisor route', path: pathname, method } };
}

module.exports = { handleSupervisorRequest };

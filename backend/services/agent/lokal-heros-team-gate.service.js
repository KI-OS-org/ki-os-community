/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: lokal-heros-team-gate.service.js
 * Kleines Team-Gate fuer den internen LOKAL-Heros-Track:
 * kombiniert Critical Review und Trust-Entscheid fuer Team-Outputs.
 * @license AGPL-3.0-only
 */

'use strict';

const { reviewOutput } = require('../mesh/critical.review.service');
const { verifyAndDecide } = require('../verifier.v2.service');

function deriveRouting(task = {}) {
  return {
    worker_type: 'multi',
    intent: task.domain === 'research' ? 'research' : 'general'
  };
}

function normalizeTask(task = {}) {
  return {
    task: task.task || task.title || 'LOKAL-Heros Team Output',
    domain: task.domain || 'business',
    audience: task.audience || null,
    reviewerPersona: task.reviewerPersona || task.review_lens || null
  };
}

async function gateTeamOutput(input = {}, options = {}) {
  const {
    task = {},
    answer = '',
    sources = [],
    reviewerPersona = null
  } = input;

  const normalizedTask = normalizeTask(task);
  const review = reviewOutput(
    { task: normalizedTask, answer: String(answer || ''), sources },
    { reviewerPersona: reviewerPersona || normalizedTask.reviewerPersona || null }
  );

  const verifierFn = options.verifyAndDecide || verifyAndDecide;
  const trustPayload = {
    answer: String(answer || ''),
    sources,
    routing: deriveRouting(normalizedTask),
    result: { sources }
  };
  const trustResult = await verifierFn(trustPayload);
  const verifier = trustResult?.verifier || { verdict: 'reject', trust_score: 0, rationale: 'missing_verifier_result' };
  const trust = trustResult?.decision || { action: 'reject', score: 0, required: 0, reason: 'missing_trust_decision' };

  const blocked = trust.action === 'reject' || trust.action === 'revise' || review.status === 'revise';

  return {
    ok: !blocked,
    status: blocked ? 'blocked' : 'approved',
    review,
    verifier,
    trust,
    summary: blocked
      ? 'Blocked by team review/trust gate.'
      : 'Approved by team review/trust gate.'
  };
}

module.exports = { gateTeamOutput };

/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: trust.policy.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
function decideTrust({ verifier, routing, result }) {
  const score = Number(verifier?.trust_score ?? 100);
  const hasSources = Array.isArray(result?.sources) && result.sources.length > 0;
  const required = hasSources || routing?.intent === 'research'
    ? Number(process.env.TRUST_SCORE_RESEARCH_MIN || 70)
    : Number(process.env.TRUST_SCORE_DEFAULT_MIN || 40);

  if (verifier?.verdict === 'reject') return { action: 'reject', score, required, reason: 'verifier_reject' };
  if (score < required) return { action: 'revise', score, required, reason: 'score_below_threshold' };
  return { action: 'approve', score, required, reason: 'ok' };
}

function applyTrustPolicy(verifier, routing = {}, result = {}) {
  return decideTrust({ verifier, routing, result });
}

module.exports = { decideTrust, applyTrustPolicy };

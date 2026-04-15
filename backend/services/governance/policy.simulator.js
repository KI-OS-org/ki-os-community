/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const { evaluateToolPolicy, getPolicyDefinitions } = require('./policy.engine');
const { detectPII, maskPII } = require('../privacy/privacy.guard');

/**
 * SIMULATION ONLY — Nicht für Production Policy Enforcement verwenden.
 * Diese Funktion simuliert Policy-Evaluierungen für Test/Preview-Zwecke.
 * Für echte Policy-Enforcement: policy.engine.js → evaluatePolicy()
 */
function simulatePolicy(payload = {}, options = {}) {
  // Guard: Simulation ist nur für Test/Preview erlaubt
  const caller = options?.caller || 'unknown';
  if (process.env.NODE_ENV === 'production' && process.env.POLICY_SIMULATOR_ALLOW_PRODUCTION !== 'true') {
    return { success: false, error: 'simulation_disabled_in_production', hint: 'Set POLICY_SIMULATOR_ALLOW_PRODUCTION=true to enable (not recommended)' };
  }
  const ctx = payload.ctx || { role: payload.role || 'guest' };
  const tool = payload.tool || 'llm_invoke';
  const action = payload.action || 'invoke';
  const text = String(payload.text || payload.prompt || '');
  const privacy = detectPII(text);
  const masking = payload.autoMask ? maskPII(text, { preserveType: true }) : null;
  const decision = evaluateToolPolicy({ tool, action, ctx, payload: payload.payload || payload, policies: getPolicyDefinitions() });
  return {
    success: true,
    simulation: {
      tool,
      action,
      role: String(ctx.role || (ctx.pki && ctx.pki.role) || 'guest').toLowerCase(),
      decision,
      privacy: { piiCount: privacy.total, piiTypes: privacy.types, maskedPreview: masking ? masking.masked : text },
      _note: 'SIMULATION — not production enforcement'
    }
  };
}

module.exports = { simulatePolicy };

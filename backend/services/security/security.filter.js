/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const Observability = require('../core/observability.service');

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?prior\s+rules/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /reveal\s+(the\s+)?hidden\s+prompt/i,
  /bypass\s+(policy|guard|safety|security)/i,
  /do\s+not\s+follow\s+your\s+rules/i,
  /print\s+your\s+instructions/i,
  /sudo\b|rm\s+-rf|powershell\s+-enc|curl\s+.*\|\s*sh/i,
  /<script\b|javascript:|onerror\s*=|onload\s*=/i
];

function classifyInjectionRisk(text = '') {
  const value = String(text || '');
  const hits = INJECTION_PATTERNS.filter((pattern) => pattern.test(value)).map((pattern) => pattern.source);
  const score = Math.min(1, Number((hits.length * 0.2).toFixed(2)));
  const decision = score >= 0.6 ? 'block' : (score >= 0.25 ? 'review' : 'allow');
  return { score, decision, hits };
}

function evaluateSecurityInput({ text = '', source = 'unknown', runId = null, traceId = null } = {}) {
  const risk = classifyInjectionRisk(text);
  if (risk.decision !== 'allow') {
    Observability.emit('security.event', {
      source,
      traceId,
      riskType: 'prompt_injection',
      decision: risk.decision,
      score: risk.score,
      signals: risk.hits
    }, { runId });
  }
  return risk;
}

module.exports = { classifyInjectionRisk, evaluateSecurityInput };

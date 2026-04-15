/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const crypto = require('crypto');
const Observability = require('../core/observability.service');

const PII_PATTERNS = Object.freeze({
  email: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b/g,
  phone: /(?<!\w)(?:\+?\d[\d\s\-()/]{7,}\d)(?!\w)/g,
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
  credit_card: /\b(?:\d[ -]*?){13,19}\b/g,
  address: /\b(?:[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?\s)+(?:Straße|Str\.|Strasse|Weg|Platz|Allee)\s+\d+[a-zA-Z]?\b/g,
  person_name: /\b(?:Mein Name ist|Ich bin|I am)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){0,2})/g,
});

function hashToken(value='') {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 8);
}

function detectPII(text='') {
  const source = String(text || '');
  const findings = [];
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(source)) !== null) {
      const value = type === 'person_name' ? match[1] : match[0];
      findings.push({ type, value, start: match.index, end: match.index + match[0].length, confidence: 0.96 });
      if (!regex.global) break;
    }
  }
  findings.sort((a, b) => a.start - b.start || a.end - b.end);
  const types = [...new Set(findings.map((f) => f.type))];
  return { total: findings.length, types, findings };
}

function maskPII(text='', options={}) {
  const source = String(text || '');
  const detection = detectPII(source);
  if (!detection.findings.length) return { text: source, masked: source, changed: false, findings: [], tokens: [] };
  let out = source;
  const tokens = [];
  const sorted = [...detection.findings].sort((a,b) => b.start - a.start);
  for (const finding of sorted) {
    const token = options.preserveType
      ? `[PII:${finding.type.toUpperCase()}:${hashToken(finding.value)}]`
      : `[PII:${hashToken(finding.value)}]`;
    out = out.slice(0, finding.start) + token + out.slice(finding.end);
    tokens.push({ token, type: finding.type, value: finding.value });
  }
  tokens.reverse();
  Observability.emit('privacy.mask.applied', { total: detection.total, types: detection.types });
  return { text: source, masked: out, changed: true, findings: detection.findings, tokens };
}

function demaskPII(text='', tokens=[]) {
  let out = String(text || '');
  for (const token of Array.isArray(tokens) ? tokens : []) {
    if (token && token.token) out = out.split(token.token).join(String(token.value || ''));
  }
  return { text: out, restored: out, tokens: Array.isArray(tokens) ? tokens.length : 0 };
}

function evaluatePrivacyInput({ text = '', source = 'unknown', traceId = null, runId = null, autoMask = false } = {}) {
  const detection = detectPII(text);
  const masked = autoMask ? maskPII(text, { preserveType: true }) : { masked: String(text || ''), changed: false, tokens: [] };
  if (detection.total) {
    Observability.emit('privacy.event', { source, traceId, decision: autoMask ? 'mask' : 'detect', piiTypes: detection.types, piiCount: detection.total }, { runId });
  }
  return { detection, maskedText: masked.masked, changed: Boolean(masked.changed), tokens: masked.tokens };
}

module.exports = { PII_PATTERNS, detectPII, maskPII, demaskPII, evaluatePrivacyInput };

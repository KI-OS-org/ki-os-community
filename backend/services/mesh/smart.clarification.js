/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: smart.clarification.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { DOMAIN_PROFILES, inferDomain } = require('./domain.profiles');
const { getUserDefaults } = require('./user.defaults');

function inferKnownFields(query = '', body = {}, context = {}) {
  const userDefaults = getUserDefaults(context);
  const domain = inferDomain(query, body);
  const lower = String(query || '').toLowerCase();
  const fields = {
    domain,
    goal: body.goal || (/anschreiben/.test(lower) ? 'Anschreiben erstellen' : /mail|e-mail/.test(lower) ? 'Nachricht erstellen' : /analyse|bewerte/.test(lower) ? 'Analyse erstellen' : ''),
    audience: body.audience || (/cfo|ceo|vorstand|board/.test(lower) ? 'Executive Stakeholder' : ''),
    source_rules: body.source_rules || '',
    materials: body.materials || '',
    tone: body.tone || userDefaults.style_preference
  };
  return fields;
}

function buildClarification(body = {}, context = {}) {
  const query = body.message || body.query || body.input_text || '';
  const inferred = inferKnownFields(query, body, context);
  const profile = DOMAIN_PROFILES[inferred.domain] || DOMAIN_PROFILES.business;
  const missing = profile.required_if_missing.filter(k => !inferred[k]);
  const questions = profile.critical_questions.filter(q => missing.includes(q.key)).slice(0, 3);
  return {
    domain: inferred.domain,
    assumptions: [...profile.assumptions],
    inferred,
    needs_clarification: questions.length > 0,
    questions
  };
}

module.exports = { buildClarification, inferKnownFields };

/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: task.framing.service.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { buildClarification } = require('./smart.clarification');
const { analyzeStyle } = require('./style.profile.service');

function frameTask(body = {}, context = {}) {
  const query = body.message || body.query || body.input_text || '';
  const clarification = buildClarification(body, context);
  const style = analyzeStyle(query, context.styleSamples || []);
  const framed = {
    domain: clarification.domain,
    task: query,
    goal: clarification.inferred.goal || 'Ergebnis erzeugen',
    audience: clarification.inferred.audience || 'Standard',
    tone: clarification.inferred.tone || 'executive',
    assumptions: clarification.assumptions,
    style,
    needs_clarification: clarification.needs_clarification,
    questions: clarification.questions,
    summary: `Auftrag: ${clarification.inferred.goal || 'Unbekanntes Ziel'} fuer ${clarification.inferred.audience || 'allgemeine Zielgruppe'} im Bereich ${clarification.domain}.`
  };
  return framed;
}

module.exports = { frameTask };

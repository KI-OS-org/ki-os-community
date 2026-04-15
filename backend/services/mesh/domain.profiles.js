/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: domain.profiles.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';

const DOMAIN_PROFILES = {
  business: {
    assumptions: ['vorzeigbares Ergebnis', 'hoher Detailgrad', 'klare Struktur'],
    required_if_missing: ['goal', 'audience'],
    critical_questions: [
      { key: 'goal', label: 'Was ist das gewünschte Ergebnis?' },
      { key: 'audience', label: 'Für wen ist das Ergebnis gedacht?' }
    ]
  },
  academic: {
    assumptions: ['formale Sorgfalt', 'wissenschaftliche Stringenz'],
    required_if_missing: ['goal', 'source_rules'],
    critical_questions: [
      { key: 'source_rules', label: 'Gibt es Vorgaben zu Quellen oder Zitierweise?' },
      { key: 'materials', label: 'Gibt es vorhandene Unterlagen oder Literatur?' },
      { key: 'goal', label: 'Wobei soll ich zuerst helfen?' }
    ]
  },
  communication: {
    assumptions: ['passende Tonalität', 'adressatengerechte Formulierung'],
    required_if_missing: ['audience'],
    critical_questions: [
      { key: 'audience', label: 'An wen richtet sich der Text?' },
      { key: 'tone', label: 'Soll der Ton eher direkt, diplomatisch oder formell sein?' }
    ]
  }
};

function inferDomain(query = '', body = {}) {
  if (body.domain) return body.domain;
  const q = String(query || '').toLowerCase();
  if (/promotion|phd|dissertation|doktorarbeit|literaturverzeichnis|zitation|quelle/i.test(q)) return 'academic';
  if (/mail|e-mail|anschreiben|brief|reply|antwort/i.test(q)) return 'communication';
  return 'business';
}

module.exports = { DOMAIN_PROFILES, inferDomain };

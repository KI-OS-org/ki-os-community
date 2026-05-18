/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: domain.agents.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';

const DOMAIN_AGENTS = {
  executive: {
    id: 'executive-v1',
    title: 'Executive Agent',
    focus: ['decision memo', 'board summary', 'priority framing'],
    enrich(task) {
      return {
        audience: task.audience === 'Standard' ? 'Executive Stakeholder' : task.audience,
        review_lens: 'executive-review',
        success_criteria: ['klare Empfehlung', 'Risiken', 'Business Impact']
      };
    }
  },
  retail: {
    id: 'retail-v1',
    title: 'Retail Agent',
    focus: ['customer', 'store operations', 'loyalty', 'commercial impact'],
    enrich() {
      return { review_lens: 'retail-review', success_criteria: ['Kundenbezug', 'operativer Nutzen', 'messbarer Mehrwert'] }; }
  },
  marketing: {
    id: 'marketing-v1',
    title: 'Marketing Agent',
    focus: ['positioning', 'audience', 'campaign logic', 'conversion'],
    enrich() {
      return { review_lens: 'marketing-review', success_criteria: ['Zielgruppenfit', 'klare Botschaft', 'Wirkung'] }; }
  },
  it: {
    id: 'it-v1',
    title: 'IT / Architecture Agent',
    focus: ['architecture', 'security', 'operability', 'integration'],
    enrich() {
      return { review_lens: 'it-review', success_criteria: ['technische Plausibilitaet', 'Betrieb', 'Risiken'] }; }
  },
  research: {
    id: 'research-v1',
    title: 'Research Agent',
    focus: ['sources', 'evidence', 'comparison', 'method'],
    enrich() {
      return { review_lens: 'academic-review', success_criteria: ['Quellenlage', 'Vergleichbarkeit', 'Stringenz'] }; }
  }
};

function listDomainAgents() { return Object.values(DOMAIN_AGENTS); }
function getDomainAgent(name) { return DOMAIN_AGENTS[name] || null; }

module.exports = { DOMAIN_AGENTS, listDomainAgents, getDomainAgent };

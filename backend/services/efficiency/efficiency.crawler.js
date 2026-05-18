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
/**
 * KI-OS — Efficiency Agent Crawler
 * Sucht Wettbewerber-News, Trends und relevante Updates via Websearch
 */
'use strict';

const COMPETITOR_QUERIES = [
  'n8n workflow automation new features 2026',
  'Make.com AI agent features 2026',
  'LangChain LangGraph update 2026',
  'AutoGen Microsoft AI agent 2026',
  'CrewAI new features release 2026',
  'Flowise open source AI agent update',
  'Dify.ai platform features 2026',
  'AI agent orchestration platform comparison 2026',
  'workflow automation AI trends 2026',
  'multi-agent AI system enterprise 2026',
];

const TECH_QUERIES = [
  'Next.js 16 features release',
  'Node.js LTS 2026 security',
  'OpenAI GPT-6 API update',
  'Anthropic Claude 4 release',
  'Google Gemini 3 API 2026',
];

/**
 * Führt eine Websearch durch – nutzt den bestehenden Websearch-Service
 */
async function searchWeb(query) {
  try {
    const { search } = require('../websearch.service');
    const results = await search(query, { maxResults: 3 });
    if (Array.isArray(results)) {
      return results.map(r => ({
        title:   r.title   || '',
        snippet: r.snippet || r.description || '',
        url:     r.url     || r.link || '',
      }));
    }
    return [];
  } catch {
    // Fallback: Leere Ergebnisse wenn Websearch nicht verfügbar
    return [];
  }
}

/**
 * Crawlt alle Wettbewerber-Queries
 * @returns {{ competitor: SearchResult[], tech: SearchResult[] }}
 */
async function crawlAll() {
  const results = { competitor: [], tech: [], queriesRun: 0 };

  // Wettbewerber (max. 5 Queries um API-Limits zu schonen)
  const competitorSample = COMPETITOR_QUERIES.slice(0, 5);
  for (const query of competitorSample) {
    try {
      const hits = await searchWeb(query);
      results.competitor.push(...hits.map(h => ({ ...h, query })));
      results.queriesRun++;
    } catch { /* weiter */ }
  }

  // Tech-Updates (max. 3)
  const techSample = TECH_QUERIES.slice(0, 3);
  for (const query of techSample) {
    try {
      const hits = await searchWeb(query);
      results.tech.push(...hits.map(h => ({ ...h, query })));
      results.queriesRun++;
    } catch { /* weiter */ }
  }

  return results;
}

module.exports = { crawlAll };

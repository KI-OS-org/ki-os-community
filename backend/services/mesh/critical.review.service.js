/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: critical.review.service.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';

function buildReviewerLens(task = {}, context = {}) {
  const explicit = context.reviewerPersona || task.reviewerPersona || task.review_lens || null;
  if (explicit) return { reviewer: explicit, fit: 'targeted' };
  if (task.domain === 'academic') return { reviewer: 'academic-review', fit: 'strict' };
  if (task.audience && /executive|board|cfo|ceo/i.test(task.audience)) return { reviewer: 'executive-review', fit: 'high' };
  return { reviewer: 'general-review', fit: 'standard' };
}

function reviewOutput({ task = {}, answer = '', sources = [] } = {}, context = {}) {
  const lens = buildReviewerLens(task, context);
  const findings = [];
  if (task.domain === 'academic' && (!sources || sources.length === 0)) findings.push('Quellenangaben fehlen fuer einen wissenschaftlichen Kontext.');
  if (/lorem ipsum|TODO|TBD/i.test(answer)) findings.push('Platzhalter oder unfertige Teile erkannt.');
  if (answer.length < 120 && /analyse|strategie|konzept/i.test(task.task || '')) findings.push('Ergebnis wirkt fuer den Aufgabentyp zu knapp.');
  return {
    status: findings.length ? 'revise' : 'approve',
    source_count: Array.isArray(sources) ? sources.length : 0,
    reviewer_lens: lens,
    findings
  };
}

module.exports = { reviewOutput, buildReviewerLens };

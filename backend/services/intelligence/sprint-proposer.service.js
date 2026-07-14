/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const fs = require('fs');
const path = require('path');

const PROPOSALS_PATH = path.join(process.cwd(), '.ki-os-proposals.ndjson');

function readProposals() {
  try {
    if (!fs.existsSync(PROPOSALS_PATH)) return [];
    const content = fs.readFileSync(PROPOSALS_PATH, 'utf8').trim();
    if (!content) return [];
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeProposals(proposals) {
  const content = proposals.map((proposal) => JSON.stringify(proposal)).join('\n');
  fs.writeFileSync(PROPOSALS_PATH, content ? `${content}\n` : '', 'utf8');
}

function createProposal(feature, analysis) {
  const proposal = {
    id: `prop-${Date.now()}`,
    title: `feat: Integrate ${feature.name} from ${feature.provider}`,
    feature,
    score: analysis.score,
    action: analysis.action,
    estimatedCostUsd: analysis.estimatedCostUsd,
    status: 'pending',
    createdAt: new Date().toISOString(),
    brief: `## Sprint-Vorschlag\n\nFeature: ${feature.name}\nProvider: ${feature.provider}\nScore: ${analysis.score}\nAction: ${analysis.action}\n\n${feature.description || ''}`
  };

  fs.appendFileSync(PROPOSALS_PATH, `${JSON.stringify(proposal)}\n`, 'utf8');
  return proposal;
}

function getProposals() {
  return readProposals();
}

function updateProposalStatus(id, status) {
  const proposals = readProposals();
  const updated = proposals.map((proposal) => (
    proposal.id === id ? { ...proposal, status } : proposal
  ));
  writeProposals(updated);
}

module.exports = { createProposal, getProposals, updateProposalStatus };

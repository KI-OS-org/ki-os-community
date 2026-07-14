/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Skill-Synthesizer (S5) — Muster-Kandidat → generalisiertes Skill-JSON via Devstral, mit deterministischem Fallback bei LLM-Fehlern

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const llmRouter = require('../core/llm.router.js');

const PROPOSALS_PATH = path.join(os.homedir(), '.kios', 'skillforge-proposals.json');
const SKILLS_DIR = path.join(os.homedir(), '.kios', 'skills');

// Hilfsfunktion zum Lesen der Proposals-Datei
function readProposals() {
  try {
    if (!fs.existsSync(PROPOSALS_PATH)) {
      return [];
    }
    const content = fs.readFileSync(PROPOSALS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return [];
  }
}

// Hilfsfunktion zum Schreiben der Proposals-Datei
function writeProposals(proposals) {
  fs.mkdirSync(path.dirname(PROPOSALS_PATH), { recursive: true });
  fs.writeFileSync(PROPOSALS_PATH, JSON.stringify(proposals, null, 2), 'utf-8');
}

// Deterministischer Fallback-Skill
function createFallbackSkill(patternCandidate) {
  const name = 'auto-' + patternCandidate.steps
    .map(s => s.taskSignature.split(' ')[0])
    .join('-')
    .slice(0, 40)
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const description = `Automatisch erkanntes Muster (${patternCandidate.occurrenceCount}x wiederkehrend): ` +
    patternCandidate.steps.map(s => s.sampleTask).join(' → ');

  const teams = patternCandidate.steps.map((s, i) => ({
    name: `team${i + 1}`,
    adapter: s.adapter,
    model: s.model,
    task: s.sampleTask
  }));

  return {
    name,
    description,
    teams,
    budget: 0.25
  };
}

// LLM-basierte Verbesserung des Skills
async function enhanceWithLLM(fallbackSkill, patternCandidate) {
  const systemPrompt = `Du bist ein Skill-Designer für ein Multi-Agenten-System (KI-OS). Deine Aufgabe ist es, aus einer Sequenz von wiederkehrenden Arbeitsschritten einen generalisierten Skill zu erstellen.

Regeln:
1. Der Skill-Name muss in kebab-case sein (nur a-z, 0-9, -), max. 30 Zeichen
2. Die Beschreibung muss klar und prägnant sein, max. 150 Zeichen
3. Generalisiere die Beschreibung so, dass sie für ÄHNLICHE zukünftige Aufgaben wiederverwendbar ist
4. Antworte NUR mit JSON, keine Erklärung, kein Markdown

Format:
{"name": "...", "description": "..."}`;

  const userPrompt = patternCandidate.steps
    .map((s, i) => `${i + 1}. ${s.sampleTask}`)
    .join('\n') + `\n\nDieses Muster wurde ${patternCandidate.occurrenceCount}x beobachtet.`;

  try {
    const response = await llmRouter.call({
      model: 'mistralai/devstral-2512',
      systemPrompt,
      userPrompt,
      maxTokens: 300,
      temperature: 0.3
    });

    const parsed = JSON.parse(response);

    // Validierung des Namens
    let name = fallbackSkill.name;
    if (parsed.name && /^[a-z0-9-]{1,30}$/.test(parsed.name)) {
      name = parsed.name;
    }

    // Validierung der Beschreibung
    let description = fallbackSkill.description;
    if (parsed.description && parsed.description.length > 0 && parsed.description.length <= 300) {
      description = parsed.description;
    }

    return {
      ...fallbackSkill,
      name,
      description
    };
  } catch (err) {
    // Bei jedem Fehler den Fallback behalten
    return fallbackSkill;
  }
}

async function synthesize(patternCandidate) {
  // Deterministischer Fallback-Skill
  const fallbackSkill = createFallbackSkill(patternCandidate);

  // LLM-basierte Verbesserung versuchen
  const skill = await enhanceWithLLM(fallbackSkill, patternCandidate);

  // Proposal erstellen
  const proposal = {
    id: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    skill,
    sourcePattern: patternCandidate
  };

  // Proposals laden und speichern
  const proposals = readProposals();
  proposals.push(proposal);
  writeProposals(proposals);

  return proposal;
}

function listProposals(status) {
  const proposals = readProposals();
  if (!status) {
    return proposals;
  }
  return proposals.filter(p => p.status === status);
}

function getProposal(id) {
  const proposals = readProposals();
  return proposals.find(p => p.id === id);
}

function approveProposal(id) {
  const proposals = readProposals();
  const index = proposals.findIndex(p => p.id === id);

  if (index === -1) {
    return { approved: false, reason: 'not-found' };
  }

  // Status aktualisieren
  proposals[index].status = 'approved';

  // Skill-Datei schreiben
  const skillPath = path.join(SKILLS_DIR, `${proposals[index].skill.name}.json`);
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  fs.writeFileSync(skillPath, JSON.stringify(proposals[index].skill, null, 2), 'utf-8');

  // Proposals speichern
  writeProposals(proposals);

  return {
    approved: true,
    proposal: proposals[index],
    writtenTo: skillPath
  };
}

function rejectProposal(id) {
  const proposals = readProposals();
  const index = proposals.findIndex(p => p.id === id);

  if (index === -1) {
    return { rejected: false, reason: 'not-found' };
  }

  // Status aktualisieren
  proposals[index].status = 'rejected';

  // Proposals speichern
  writeProposals(proposals);

  return {
    rejected: true,
    proposal: proposals[index]
  };
}

module.exports = {
  synthesize,
  listProposals,
  getProposal,
  approveProposal,
  rejectProposal,
  PROPOSALS_PATH
};

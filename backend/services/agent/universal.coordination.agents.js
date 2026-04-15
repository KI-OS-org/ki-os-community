/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: universal.coordination.agents.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';

const UNIVERSAL_COORDINATION_AGENTS = {
  supervisor: {
    id: 'supervisor-v1',
    title: 'Supervisor Agent',
    purpose: 'Aktiviert Mesh-Modus, bewertet Risiko und steuert Fallback zur stabilen Kernel-Pipeline.'
  },
  planner: {
    id: 'planner-v1',
    title: 'Planner Agent',
    purpose: 'Zerlegt komplexe Nutzerziele in nachvollziehbare, werkzeugfähige Schritte.'
  },
  researcher: {
    id: 'researcher-v1',
    title: 'Research Agent',
    purpose: 'Sammelt externe und interne Signale über Web- und Memory-Tools.'
  },
  memory: {
    id: 'memory-v1',
    title: 'Memory Agent',
    purpose: 'Holt relevanten Kontext und persistiert wichtige Erkenntnisse.'
  },
  executor: {
    id: 'executor-v1',
    title: 'Execution Agent',
    purpose: 'Führt den Plan kontrolliert aus, verwaltet Retries, Checkpoints und Ergebnisstruktur.'
  },
  reviewer: {
    id: 'reviewer-v1',
    title: 'Reviewer Agent',
    purpose: 'Prüft Zwischenergebnisse auf Vollständigkeit, Fehler und nächste sinnvolle Schritte.'
  },
  policy: {
    id: 'policy-v1',
    title: 'Policy Agent',
    purpose: 'Wendet Sicherheits-, Trust- und Governance-Regeln auf den Mesh-Output an.'
  },
  synthesizer: {
    id: 'synthesizer-v1',
    title: 'Synthesizer Agent',
    purpose: 'Formt Ergebnisse in eine konsistente One-Voice-Antwort mit klarer Meta-Struktur.'
  }
};

function listCoordinationAgents() {
  return Object.values(UNIVERSAL_COORDINATION_AGENTS);
}

function buildMeshMeta(overrides = {}) {
  return {
    type: 'universal-coordination-mesh',
    roles: listCoordinationAgents(),
    enabled: true,
    ...overrides
  };
}

module.exports = {
  UNIVERSAL_COORDINATION_AGENTS,
  listCoordinationAgents,
  buildMeshMeta
};

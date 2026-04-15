/**
 * KI-OS · AgentMesh Demo-Szenarien
 * Scripted Sequences für die Offline-Simulation.
 * Können auch als "Warmup" vor echten Backend-Events laufen.
 */
import { useMeshStore } from "./mesh-store";

// ── Helpers ────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let _scenarioAbort: (() => void) | null = null;

function abortable() {
  let aborted = false;
  const controller = { aborted: () => aborted };
  _scenarioAbort = () => { aborted = true; };
  return controller;
}

// ── Scenario Definitions ───────────────────────────────────────────────────

export interface ScenarioDef {
  id: string;
  label: string;
  task: string;
  supMsg: [string, string];
  statuses: Record<string, string>;
  out: [string, string, string];
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: "market",
    label: "Marktanalyse",
    task: "Erstelle Marktanalyse + Executive Briefing",
    supMsg: ["Dispatch: Marktanalyse!", "Planner → Research → Execution"],
    statuses: {
      planner:     "Task → 3 Schritte",
      research:    "8 Quellen gefunden",
      memory:      "Vorwissen geladen",
      execution:   "Report PDF ready",
      policy:      "DSGVO ✓",
      reviewer:    "Qualität 98%",
      synthesizer: "One Voice bereit",
    },
    out: [
      "Marktanalyse: KI-OS adressiert €2.4B EU-Markt.",
      "Executive Briefing erstellt · PDF + 8 Slides ready.",
      "Empfehlung: Go-to-Market Q3 2026 starten.",
    ],
  },
  {
    id: "retail",
    label: "Retail Brain",
    task: "Analysiere Promo-Performance + OOS-Risiken",
    supMsg: ["Dispatch: Retail!", "Retail Brain aktiv"],
    statuses: {
      planner:     "Promo-Analyse",
      research:    "Bestandsdaten",
      memory:      "Vorjahres-KPIs",
      execution:   "Report ready",
      policy:      "DSGVO ✓",
      reviewer:    "Freigabe ✓",
      synthesizer: "Synthesis läuft",
    },
    out: [
      "Promo underperformt -8% vs. Plan. OOS-Risiko: 3 SKUs.",
      "Empfehlung: Timing-Shift Di/Do + Bestandsaufstockung.",
      "Report als PDF bereit. Retail Brain aktiv.",
    ],
  },
  {
    id: "executive",
    label: "Executive Briefing",
    task: "Executive Briefing Q2 für Board-Meeting",
    supMsg: ["Dispatch: Executive!", "Synthesis aktiv"],
    statuses: {
      planner:     "Struktur definiert",
      research:    "Kennzahlen gesammelt",
      memory:      "Q1-Basis geladen",
      execution:   "Briefing erstellt",
      policy:      "Konfidentiell ✓",
      reviewer:    "Board-ready ✓",
      synthesizer: "One Voice",
    },
    out: [
      "Umsatz +12%, EBIT stabil, NPS +4.",
      "3 strategische Handlungsfelder identifiziert.",
      "Board-Deck 6 Slides exportbereit.",
    ],
  },
];

// ── Scenario Runner ────────────────────────────────────────────────────────

export async function runScenario(def: ScenarioDef) {
  const ctrl = abortable();
  const st = useMeshStore.getState();

  // 0. Reset
  st.resetMesh();
  st.setRunning(true);
  await delay(300);
  if (ctrl.aborted()) return;

  // Phase 1: Aufgabe eingeht
  st.setPhase("DISPATCHING", def.task);
  st.pushEvent({ type: "info", message: `Neue Aufgabe: ${def.task}` });
  await delay(600);
  if (ctrl.aborted()) return;

  // Phase 2: Supervisor aktiv
  st.setAgentStatus("supervisor", "active");
  st.pushEvent({ type: "dispatch", agentId: "supervisor", message: def.supMsg[0] });
  await delay(400);
  if (ctrl.aborted()) return;

  // Phase 3: Dispatch zu allen Agenten
  st.setPhase("PLANNING", def.supMsg[1]);
  const workerIds = ["planner", "research", "memory", "execution", "policy"];

  for (const wid of workerIds) {
    st.spawnTask("supervisor", wid, "dispatch", "#fb923c");
    st.pushEvent({ type: "dispatch", agentId: wid, message: `→ ${wid}` });
    await delay(150);
    if (ctrl.aborted()) return;
  }
  await delay(700);
  if (ctrl.aborted()) return;

  // Phase 4: Agenten arbeiten
  st.setPhase("EXECUTING", "Alle Agenten aktiv");
  for (const wid of workerIds) {
    st.setAgentStatus(wid as any, "thinking");
    st.addTokens(wid, Math.floor(Math.random() * 180) + 80);
  }
  await delay(800);
  if (ctrl.aborted()) return;

  // Phase 5: Agenten melden Ergebnisse zurück
  st.setPhase("EXECUTING", "Ergebnisse eingehend");
  for (const wid of workerIds) {
    if (ctrl.aborted()) return;
    st.setAgentStatus(wid as any, "active");
    st.spawnTask(wid, "supervisor", def.statuses[wid] ?? "✓", "#22c55e");
    st.pushEvent({ type: "result", agentId: wid, message: def.statuses[wid] ?? "✓" });
    await delay(220);
  }
  await delay(600);
  if (ctrl.aborted()) return;

  // Phase 6: Reviewer
  st.setPhase("REVIEWING", "Qualitätsprüfung läuft");
  st.setAgentStatus("reviewer", "thinking");
  st.spawnTask("supervisor", "reviewer", "Qualitätsprüfung", "#a78bfa");
  await delay(500);
  if (ctrl.aborted()) return;
  st.setAgentStatus("reviewer", "done");
  st.pushEvent({ type: "result", agentId: "reviewer", message: def.statuses["reviewer"] ?? "✓" });
  st.spawnTask("reviewer", "synthesizer", "Freigabe", "#a78bfa");
  await delay(400);
  if (ctrl.aborted()) return;

  // Phase 7: Synthesizer
  st.setPhase("SYNTHESIZING", "One Voice wird erstellt…");
  st.setAgentStatus("synthesizer", "thinking");
  await delay(500);
  if (ctrl.aborted()) return;
  st.setAgentStatus("synthesizer", "active");
  st.spawnTask("synthesizer", "supervisor", "One Voice", "#5ac4ff");
  await delay(600);
  if (ctrl.aborted()) return;

  // Phase 8: Output
  st.setPhase("COMPLETE", "One Voice Output");
  st.setAgentStatus("supervisor", "done");
  st.setAgentStatus("synthesizer", "done");
  st.setOutput(def.out);
  st.pushEvent({ type: "output", message: "One Voice Output bereit" });
  for (const wid of workerIds) {
    st.setAgentStatus(wid as any, "done");
  }
  st.setRunning(false);

  // Auto-loop
  await delay(6000);
  if (ctrl.aborted()) return;
  const nextIdx = (SCENARIOS.findIndex((s) => s.id === def.id) + 1) % SCENARIOS.length;
  runScenario(SCENARIOS[nextIdx]);
}

export function stopScenario() {
  if (_scenarioAbort) {
    _scenarioAbort();
    _scenarioAbort = null;
  }
  useMeshStore.getState().resetMesh();
  useMeshStore.getState().setRunning(false);
}

export function startDefaultScenario() {
  runScenario(SCENARIOS[0]);
}

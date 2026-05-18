/**
 * KI-OS · AgentMesh Zustand Store
 * Globaler State für die Live-Visualisierung des AgentMesh.
 * Canvas-Loop liest via getState() ohne React-Re-Renders.
 */
import { create } from "zustand";

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentRole =
  | "supervisor"
  | "planner"
  | "research"
  | "memory"
  | "execution"
  | "policy"
  | "reviewer"
  | "synthesizer";

export type AgentStatus = "idle" | "thinking" | "active" | "done" | "error";

export type MeshPhase =
  | "IDLE"
  | "DISPATCHING"
  | "PLANNING"
  | "EXECUTING"
  | "REVIEWING"
  | "SYNTHESIZING"
  | "COMPLETE";

export interface MeshAgent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  color: string;
  tokenCount: number;
  shortLabel?: string;
  // Set by D3 simulation at runtime — not stored in Zustand
  // (kept here as optional for type convenience)
  x?: number;
  y?: number;
}

export interface TaskParticle {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  label: string;
  color: string;
  createdAt: number;
}

export interface MeshEvent {
  id: string;
  type: "dispatch" | "result" | "error" | "synthesis" | "policy" | "output" | "info";
  agentId?: string;
  message: string;
  ts: number;
}

// ── Agent Definitions ──────────────────────────────────────────────────────

export const AGENT_DEFS: Omit<MeshAgent, "status" | "tokenCount">[] = [
  { id: "supervisor",  name: "Supervisor",  role: "supervisor",  color: "#fb923c", shortLabel: "koordiniert"     },
  { id: "planner",     name: "Planner",     role: "planner",     color: "#5ac4ff", shortLabel: "Task zerlegen"   },
  { id: "research",    name: "Research",    role: "research",    color: "#22c55e", shortLabel: "Web · Sources"   },
  { id: "memory",      name: "Memory",      role: "memory",      color: "#4a8dff", shortLabel: "Kontext"         },
  { id: "execution",   name: "Execution",   role: "execution",   color: "#fb923c", shortLabel: "Worker · Files"  },
  { id: "policy",      name: "Policy",      role: "policy",      color: "#fbbf24", shortLabel: "DSGVO · Gov"     },
  { id: "reviewer",    name: "Reviewer",    role: "reviewer",    color: "#a78bfa", shortLabel: "Qualitäts-Check" },
  { id: "synthesizer", name: "Synthesizer", role: "synthesizer", color: "#5ac4ff", shortLabel: "One Voice"       },
];

const INITIAL_AGENTS: MeshAgent[] = AGENT_DEFS.map((d) => ({
  ...d,
  status: "idle",
  tokenCount: 0,
}));

// ── Store ──────────────────────────────────────────────────────────────────

let _tid = 0;
let _eid = 0;

interface MeshStore {
  agents: MeshAgent[];
  tasks: TaskParticle[];
  phase: MeshPhase;
  phaseDetail: string;
  events: MeshEvent[];
  output: string[];
  isConnected: boolean;
  isRunning: boolean;

  // Mutations (called from scenarios, SSE handler, or canvas)
  setAgentStatus: (id: string, status: AgentStatus) => void;
  addTokens: (id: string, count: number) => void;
  spawnTask: (from: string, to: string, label: string, color?: string) => string;
  completeTask: (id: string) => void;
  setPhase: (phase: MeshPhase, detail?: string) => void;
  pushEvent: (event: Omit<MeshEvent, "id" | "ts">) => void;
  setOutput: (lines: string[]) => void;
  setConnected: (v: boolean) => void;
  setRunning: (v: boolean) => void;
  resetMesh: () => void;
}

export const useMeshStore = create<MeshStore>((set) => ({
  agents: INITIAL_AGENTS,
  tasks: [],
  phase: "IDLE",
  phaseDetail: "Bereit",
  events: [],
  output: [],
  isConnected: false,
  isRunning: false,

  setAgentStatus: (id, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

  addTokens: (id, count) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id ? { ...a, tokenCount: a.tokenCount + count } : a
      ),
    })),

  spawnTask: (from, to, label, color = "#5ac4ff") => {
    const id = `t${++_tid}`;
    set((s) => ({
      tasks: [
        ...s.tasks,
        { id, fromAgentId: from, toAgentId: to, label, color, createdAt: Date.now() },
      ],
    }));
    return id;
  },

  completeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  setPhase: (phase, detail = "") => set({ phase, phaseDetail: detail }),

  pushEvent: (event) => {
    const e: MeshEvent = { ...event, id: `e${++_eid}`, ts: Date.now() };
    set((s) => ({ events: [e, ...s.events].slice(0, 60) }));
  },

  setOutput: (lines) => set({ output: lines }),
  setConnected: (isConnected) => set({ isConnected }),
  setRunning: (isRunning) => set({ isRunning }),

  resetMesh: () =>
    set({
      agents: INITIAL_AGENTS,
      tasks: [],
      phase: "IDLE",
      phaseDetail: "Bereit",
      events: [],
      output: [],
      isRunning: false,
    }),
}));

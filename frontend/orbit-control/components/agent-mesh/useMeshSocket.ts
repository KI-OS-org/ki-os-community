"use client";

/**
 * KI-OS · AgentMesh SSE Hook
 * Verbindet mit /api/agentmesh/events und mapped eingehende Events
 * auf Zustand-Mutations.
 *
 * Wenn kein Backend verfügbar → demo scenario läuft (mesh-scenarios.ts).
 */
import { useEffect, useRef } from "react";
import { useMeshStore } from "@/lib/mesh-store";
import { startDefaultScenario, stopScenario } from "@/lib/mesh-scenarios";

export type MeshSocketMode = "live" | "demo" | "off";

interface Options {
  runId?: string;
  mode?: MeshSocketMode;
}

export function useMeshSocket({ runId, mode = "demo" }: Options = {}) {
  const esRef      = useRef<EventSource | null>(null);
  const demoActive = useRef(false);

  useEffect(() => {
    if (mode === "off") return;

    const store = useMeshStore.getState();

    if (mode === "demo") {
      // Offline simulation
      demoActive.current = true;
      store.setConnected(false);
      startDefaultScenario();
      return () => {
        demoActive.current = false;
        stopScenario();
      };
    }

    // mode === "live"
    const qs  = runId ? `?runId=${encodeURIComponent(runId)}` : "";
    const url = `/api/agentmesh/events${qs}`;
    const es  = new EventSource(url);
    esRef.current = es;

    es.onopen = () => store.setConnected(true);
    es.onerror = () => {
      store.setConnected(false);
      // Fallback to demo after 2s
      setTimeout(() => {
        if (!demoActive.current) {
          demoActive.current = true;
          startDefaultScenario();
        }
      }, 2000);
    };

    es.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      dispatchMeshEvent(msg, store);
    };

    // Named event types from backend
    const NAMED = ["task_started", "task_update", "task_completed", "agent_error",
                   "synthesis_started", "output_ready", "phase_change", "info"];
    NAMED.forEach((type) => {
      es.addEventListener(type, (ev: MessageEvent) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        dispatchMeshEvent({ type, ...msg }, store);
      });
    });

    return () => {
      es.close();
      esRef.current = null;
      demoActive.current = false;
      stopScenario();
    };
  }, [runId, mode]);
}

// ── Event dispatcher ───────────────────────────────────────────────────────

type StoreApi = ReturnType<typeof useMeshStore.getState>;

function dispatchMeshEvent(msg: Record<string, unknown>, store: StoreApi) {
  const type    = String(msg.type ?? "");
  const agentId = String(msg.agentId ?? "");

  switch (type) {
    case "task_started":
      store.spawnTask(
        String(msg.fromAgent ?? "supervisor"),
        String(msg.toAgent   ?? agentId),
        String(msg.label     ?? "task"),
        String(msg.color     ?? "#5ac4ff")
      );
      store.setAgentStatus(String(msg.toAgent ?? agentId) as any, "thinking");
      store.pushEvent({ type: "dispatch", agentId: String(msg.toAgent ?? ""), message: String(msg.label ?? "task") });
      break;

    case "task_update":
      store.setAgentStatus(agentId as any, msg.status === "thinking" ? "thinking" : "active");
      if (msg.message) store.pushEvent({ type: "info", agentId, message: String(msg.message) });
      break;

    case "task_completed":
      if (msg.taskId) store.completeTask(String(msg.taskId));
      store.setAgentStatus(agentId as any, "done");
      if (msg.tokens) store.addTokens(agentId, Number(msg.tokens));
      store.pushEvent({ type: "result", agentId, message: String(msg.result ?? "✓") });
      break;

    case "agent_error":
      store.setAgentStatus(agentId as any, "error");
      store.pushEvent({ type: "error", agentId, message: String(msg.error ?? "Unknown error") });
      break;

    case "synthesis_started":
      store.setPhase("SYNTHESIZING", "One Voice wird erstellt…");
      store.setAgentStatus("synthesizer" as any, "thinking");
      store.pushEvent({ type: "synthesis", message: "Synthesis gestartet" });
      break;

    case "output_ready":
      store.setPhase("COMPLETE", "One Voice Output");
      const lines = Array.isArray(msg.output) ? msg.output.map(String) : [String(msg.output ?? "")];
      store.setOutput(lines);
      store.pushEvent({ type: "output", message: "Output bereit" });
      break;

    case "phase_change":
      store.setPhase(String(msg.phase ?? "IDLE") as any, String(msg.detail ?? ""));
      break;

    case "info":
    default:
      if (msg.message) store.pushEvent({ type: "info", message: String(msg.message) });
      break;
  }
}

"use client";

/**
 * KI-OS · AgentMesh Vollansicht
 * Kombiniert Canvas + Status-Panel + Event-Log + One Voice Output.
 * Steuerung: Demo ↔ Live (SSE).
 */
import { useEffect, useState, useCallback } from "react";
import { Play, Square, Radio, Zap, Network } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMeshStore } from "@/lib/mesh-store";
import { AgentMeshCanvas } from "./AgentMeshCanvas";
import { AgentStatusPanel } from "./StatusCapsule";
import { MeshEventLog } from "./MeshEventLog";
import { OneVoiceOutput } from "./OneVoiceOutput";
import { useMeshSocket } from "./useMeshSocket";
import { SCENARIOS, runScenario, stopScenario } from "@/lib/mesh-scenarios";
import type { MeshSocketMode } from "./useMeshSocket";

// ── Main View ──────────────────────────────────────────────────────────────

interface Props {
  /** runId: wenn gesetzt → Live-SSE für diesen spezifischen Run */
  runId?: string;
  /** Startet im Demo-Modus; Live-Modus braucht Backend */
  defaultMode?: MeshSocketMode;
}

export function AgentMeshView({ runId, defaultMode = "demo" }: Props) {
  const [mode, setMode] = useState<MeshSocketMode>(defaultMode);

  // State aus Store
  const agents   = useMeshStore((s) => s.agents);
  const events   = useMeshStore((s) => s.events);
  const phase    = useMeshStore((s) => s.phase);
  const output   = useMeshStore((s) => s.output);
  const running  = useMeshStore((s) => s.isRunning);
  const connected = useMeshStore((s) => s.isConnected);

  // SSE / Demo hook
  useMeshSocket({ runId, mode });

  const handleScenario = useCallback((scenarioId: string) => {
    const def = SCENARIOS.find((s) => s.id === scenarioId);
    if (!def) return;
    setMode("off");
    setTimeout(() => {
      setMode("off");
      runScenario(def);
    }, 100);
  }, []);

  const handleStop = useCallback(() => {
    stopScenario();
    useMeshStore.getState().resetMesh();
    setMode("off");
  }, []);

  const handleLive = useCallback(() => {
    stopScenario();
    setMode("live");
  }, []);

  const handleDemo = useCallback(() => {
    stopScenario();
    useMeshStore.getState().resetMesh();
    setMode("demo");
  }, []);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Controls row ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Mode indicators */}
        <div
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
          style={{
            background: mode === "live"
              ? "rgba(34,197,94,0.08)" : "rgba(90,196,255,0.06)",
            border: mode === "live"
              ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(90,196,255,0.15)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {mode === "live" ? (
            <>
              <span className="size-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
              <span style={{ color: "#22c55e" }}>LIVE</span>
              {connected && <span style={{ color: "#4a5272" }}>· backend</span>}
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full" style={{ background: "#5ac4ff" }} />
              <span style={{ color: "#5ac4ff" }}>DEMO</span>
            </>
          )}
        </div>

        {/* Scenario buttons */}
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => handleScenario(s.id)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.04)",
              border:     "1px solid rgba(255,255,255,0.08)",
              color:      "#a9b7e6",
            }}
          >
            <Play className="size-3" />
            {s.label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Mode controls */}
        <button
          onClick={handleDemo}
          disabled={mode === "demo" && running}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all hover:opacity-80 disabled:opacity-40"
          style={{
            background: "rgba(90,196,255,0.06)",
            border:     "1px solid rgba(90,196,255,0.15)",
            color:      "#5ac4ff",
          }}
        >
          <Zap className="size-3" />
          Demo
        </button>

        <button
          onClick={handleLive}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all hover:opacity-80"
          style={{
            background: "rgba(34,197,94,0.06)",
            border:     "1px solid rgba(34,197,94,0.15)",
            color:      "#22c55e",
          }}
        >
          <Radio className="size-3" />
          Live
        </button>

        {running && (
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all hover:opacity-80"
            style={{
              background: "rgba(248,113,113,0.06)",
              border:     "1px solid rgba(248,113,113,0.2)",
              color:      "#f87171",
            }}
          >
            <Square className="size-3" />
            Stop
          </button>
        )}
      </div>

      {/* ── Main grid: Canvas + Side panels ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 280px" }}>

        {/* Canvas */}
        <div className="flex flex-col gap-4">
          <AgentMeshCanvas className="w-full" style={{ height: 500 } as React.CSSProperties} />

          {/* One Voice Output */}
          <OneVoiceOutput
            phase={phase}
            output={output}
            taskDescription={SCENARIOS.find(() => true)?.task}
          />
        </div>

        {/* Side panels */}
        <div className="flex flex-col gap-4 min-w-0">
          <AgentStatusPanel agents={agents} />
          <MeshEventLog events={events} maxHeight={340} />
        </div>
      </div>
    </div>
  );
}

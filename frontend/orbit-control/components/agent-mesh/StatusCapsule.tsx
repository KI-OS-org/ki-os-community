"use client";

/**
 * KI-OS · Agent Status-Kapsel
 * Animated badge — Framer Motion slide when status changes.
 */
import { AnimatePresence, motion } from "framer-motion";
import type { AgentStatus, MeshAgent } from "@/lib/mesh-store";

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bg: string; border: string }> = {
  idle: {
    label:  "IDLE",
    color:  "#4a5272",
    bg:     "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.06)",
  },
  thinking: {
    label:  "THINKING",
    color:  "#fbbf24",
    bg:     "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.25)",
  },
  active: {
    label:  "ACTIVE",
    color:  "#22c55e",
    bg:     "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.25)",
  },
  done: {
    label:  "DONE",
    color:  "#5ac4ff",
    bg:     "rgba(90,196,255,0.06)",
    border: "rgba(90,196,255,0.20)",
  },
  error: {
    label:  "ERROR",
    color:  "#f87171",
    bg:     "rgba(248,113,113,0.08)",
    border: "rgba(248,113,113,0.25)",
  },
};

interface Props {
  agent: MeshAgent;
}

export function StatusCapsule({ agent }: Props) {
  const cfg = STATUS_CONFIG[agent.status];

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      {/* Agent name */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="size-2 rounded-full shrink-0"
          style={{ background: agent.color }}
        />
        <span
          className="text-xs font-semibold truncate"
          style={{ color: "#a9b7e6", fontFamily: "'JetBrains Mono', monospace" }}
        >
          {agent.name.toUpperCase()}
        </span>
      </div>

      {/* Status badge with AnimatePresence */}
      <AnimatePresence mode="popLayout">
        <motion.span
          key={agent.status}
          initial={{ opacity: 0, x: 6, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -6, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{
            background: cfg.bg,
            border:     `1px solid ${cfg.border}`,
            color:      cfg.color,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize:   9,
            letterSpacing: 1,
          }}
        >
          {cfg.label}
          {agent.status === "thinking" && (
            <span className="ml-1 inline-block animate-bounce">…</span>
          )}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ── Agent Status Panel ─────────────────────────────────────────────────────

interface PanelProps {
  agents: MeshAgent[];
}

export function AgentStatusPanel({ agents }: PanelProps) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(5,8,22,0.85)",
        border:     "1px solid rgba(90,196,255,0.12)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ background: "#22c55e" }}
        />
        <span
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5ac4ff", letterSpacing: 1.5 }}
        >
          AGENT STATUS
        </span>
      </div>
      <div className="px-4 py-2">
        {agents.map((agent, i) => (
          <div key={agent.id} style={i > 0 ? { borderTop: "1px solid rgba(255,255,255,0.04)" } : {}}>
            <StatusCapsule agent={agent} />
          </div>
        ))}
      </div>
    </div>
  );
}

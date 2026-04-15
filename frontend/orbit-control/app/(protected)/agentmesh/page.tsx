"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Network,
  Play,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react";
import { AgentMeshView } from "@/components/agent-mesh/AgentMeshView";

// ── Types ─────────────────────────────────────────────────────────────────────

type RunStatus =
  | "PENDING"
  | "PLANNING"
  | "EXECUTING"
  | "REVIEWING"
  | "SYNTHESIZING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

interface MeshRun {
  runId: string;
  taskDescription: string;
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES: RunStatus[] = [
  "PENDING",
  "PLANNING",
  "EXECUTING",
  "REVIEWING",
  "SYNTHESIZING",
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(ms: number | null, start?: string | null, end?: string | null) {
  const duration =
    ms ??
    (start && end
      ? new Date(end).getTime() - new Date(start).getTime()
      : null);
  if (!duration) return "—";
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
}

function statusBadgeStyle(status: RunStatus | string) {
  switch (status) {
    case "COMPLETED":
      return {
        bg: "rgba(34,197,94,0.12)",
        border: "rgba(34,197,94,0.3)",
        color: "#22c55e",
        pulse: false,
      };
    case "FAILED":
      return {
        bg: "rgba(248,113,113,0.12)",
        border: "rgba(248,113,113,0.3)",
        color: "#f87171",
        pulse: false,
      };
    case "CANCELLED":
      return {
        bg: "rgba(113,113,122,0.12)",
        border: "rgba(113,113,122,0.3)",
        color: "#71717a",
        pulse: false,
      };
    case "EXECUTING":
    case "REVIEWING":
    case "SYNTHESIZING":
      return {
        bg: "rgba(90,196,255,0.12)",
        border: "rgba(90,196,255,0.3)",
        color: "#5ac4ff",
        pulse: true,
      };
    case "PENDING":
    case "PLANNING":
    default:
      return {
        bg: "rgba(234,179,8,0.12)",
        border: "rgba(234,179,8,0.3)",
        color: "#eab308",
        pulse: false,
      };
  }
}

function StatusBadge({ status }: { status: string }) {
  const s = statusBadgeStyle(status as RunStatus);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold${s.pulse ? " animate-pulse" : ""}`}
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {s.pulse && <span className="size-1.5 rounded-full bg-current" />}
      {status}
    </span>
  );
}

// ── Stats Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-4"
    >
      <div
        className="flex items-center justify-center rounded-xl size-11 shrink-0"
        style={{ background: `${color}1a`, border: `1px solid ${color}40` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Strategy Mode Card ────────────────────────────────────────────────────────

const STRATEGY_MODES = [
  {
    id: "sequential",
    label: "Sequential",
    description: "Agents run one after another in a fixed order. Deterministic, easy to debug.",
    color: "#5ac4ff",
  },
  {
    id: "parallel",
    label: "Parallel",
    description: "Independent agents run concurrently. Faster for tasks that can be split.",
    color: "#22c55e",
  },
  {
    id: "adaptive",
    label: "Adaptive",
    description: "The supervisor dynamically decides execution order based on context and results.",
    color: "#a855f7",
  },
];

function StrategyCard({ strategy }: { strategy: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="size-4" style={{ color: "var(--accent)" }} />
        <h3 className="font-semibold text-sm text-[var(--foreground)]">
          Execution Strategy
        </h3>
        {strategy && (
          <span
            className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
            style={{
              background: "rgba(90,196,255,0.12)",
              border: "1px solid rgba(90,196,255,0.3)",
              color: "#5ac4ff",
            }}
          >
            {strategy}
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {STRATEGY_MODES.map((m) => (
          <div
            key={m.id}
            className="rounded-xl px-3 py-2.5"
            style={{
              background:
                strategy?.toLowerCase() === m.id
                  ? `${m.color}14`
                  : "rgba(255,255,255,0.03)",
              border:
                strategy?.toLowerCase() === m.id
                  ? `1px solid ${m.color}40`
                  : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p
              className="text-xs font-semibold mb-1"
              style={{ color: strategy?.toLowerCase() === m.id ? m.color : "var(--muted-foreground)" }}
            >
              {m.label}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              {m.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quick-Start Form ──────────────────────────────────────────────────────────

function QuickStartForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [task, setTask] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!task.trim()) return;
    setSubmitError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/agentmesh/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task: task.trim() }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSubmitError(json?.message ?? json?.error ?? "Fehler beim Starten");
          return;
        }
        onSuccess();
        router.push("/agentmesh/runs");
      } catch {
        setSubmitError("Netzwerkfehler — bitte erneut versuchen");
      }
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Play className="size-4" style={{ color: "var(--accent)" }} />
        <h3 className="font-semibold text-sm text-[var(--foreground)]">
          Quick-Start
        </h3>
      </div>

      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Beschreibe die Aufgabe für den AgentMesh…"
        rows={4}
        className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "var(--foreground)",
        }}
      />

      {submitError && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
          <AlertCircle className="size-3.5 shrink-0" />
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted-foreground)]">
          {task.length} Zeichen · Nach dem Start → Weiterleitung zu Runs
        </p>
        <button
          onClick={handleSubmit}
          disabled={!task.trim() || isPending}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-opacity disabled:opacity-50"
          style={{
            background: "rgba(90,196,255,0.15)",
            border: "1px solid rgba(90,196,255,0.3)",
            color: "var(--accent)",
          }}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          {isPending ? "Startet…" : "AgentMesh Run starten"}
        </button>
      </div>
    </div>
  );
}

// ── Recent Runs Table ─────────────────────────────────────────────────────────

function RecentRunsTable({ runs }: { runs: MeshRun[] }) {
  const recent = runs.slice(0, 10);

  if (recent.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="size-4" style={{ color: "var(--accent)" }} />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Letzte Runs</h3>
        </div>
        <div className="flex flex-col items-center py-8 gap-2">
          <Activity className="size-8 opacity-20" style={{ color: "var(--accent)" }} />
          <p className="text-sm text-[var(--muted-foreground)]">
            Noch keine Runs vorhanden.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Activity className="size-4" style={{ color: "var(--accent)" }} />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Letzte Runs</h3>
        </div>
        <a
          href="/agentmesh/runs"
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)" }}
        >
          Alle anzeigen →
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Run ID</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Aufgabe</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Status</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Gestartet</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Dauer</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((run, i) => (
              <tr
                key={run.runId}
                style={{
                  borderBottom:
                    i < recent.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
                className="transition-colors hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 font-mono text-[var(--muted-foreground)]">
                  {run.runId.slice(0, 12)}
                </td>
                <td className="px-4 py-3 text-[var(--foreground)] max-w-xs">
                  <span className="truncate block" title={run.taskDescription}>
                    {run.taskDescription.length > 60
                      ? run.taskDescription.slice(0, 60) + "…"
                      : run.taskDescription}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] whitespace-nowrap">
                  {fmtDate(run.startedAt ?? run.createdAt)}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] whitespace-nowrap">
                  {fmtDuration(run.durationMs, run.startedAt, run.completedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AgentMeshOverviewPage() {
  const [runs, setRuns] = useState<MeshRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/agentmesh/runs");
      const json = await res.json().catch(() => ({}));
      const list: MeshRun[] = Array.isArray(json?.runs) ? json.runs : [];
      setRuns(list);
      setError(null);
    } catch {
      setError("Fehler beim Laden der Runs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Derive stats
  const total = runs.length;
  const active = runs.filter((r) => ACTIVE_STATUSES.includes(r.status as RunStatus)).length;
  const completed = runs.filter((r) => r.status === "COMPLETED").length;
  const failed = runs.filter((r) => r.status === "FAILED").length;

  // Detect current strategy from any run's mode field
  const strategy =
    (runs.find((r) => (r as any).mode)  as any)?.mode ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Network className="size-6" style={{ color: "var(--accent)" }} />
            AgentMesh Overview
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Live-Visualisierung · Status · Runs · Quick-Start
          </p>
        </div>
        <button
          onClick={fetchRuns}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-opacity hover:opacity-70"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--muted-foreground)",
          }}
        >
          <RefreshCw className="size-3.5" />
          Aktualisieren
        </button>
      </div>

      {/* ── AgentMesh Live Visualisierung ── */}
      <AgentMeshView defaultMode="demo" />

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gesamt" value={total} icon={<Activity className="size-5" />} color="#5ac4ff" />
        <StatCard label="Aktiv" value={active} icon={<Zap className="size-5" />} color="#eab308" />
        <StatCard label="Abgeschlossen" value={completed} icon={<CheckCircle2 className="size-5" />} color="#22c55e" />
        <StatCard label="Fehlgeschlagen" value={failed} icon={<XCircle className="size-5" />} color="#f87171" />
      </div>

      {/* Global error */}
      {error && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3"
        >
          <AlertCircle className="size-4 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
          <button
            onClick={() => { setError(null); fetchRuns(); }}
            className="ml-auto text-xs text-red-300 underline"
          >
            Wiederholen
          </button>
        </div>
      )}

      {/* Recent runs */}
      <RecentRunsTable runs={runs} />

      {/* Strategy info */}
      <StrategyCard strategy={strategy} />

      {/* Quick-start form */}
      <QuickStartForm onSuccess={fetchRuns} />
    </div>
  );
}

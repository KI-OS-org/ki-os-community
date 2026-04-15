"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  StopCircle,
  X,
  XCircle,
  Zap,
} from "lucide-react";

// ── Failure Category ───────────────────────────────────────────────────────────

function getFailureCategory(run: any): 'timeout' | 'orphan' | 'policy' | 'cancelled' | 'error' | null {
  if (run.status !== 'FAILED') return null;
  const err = String(run.error || '').toLowerCase();
  if (err.includes('timeout exceeded')) return 'timeout';
  if (err.includes('orphan_recovered')) return 'orphan';
  if (err.includes('policy denied') || err.includes('403')) return 'policy';
  return 'error';
}

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

type StepStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

type AgentRole =
  | "supervisor"
  | "planner"
  | "researcher"
  | "memory"
  | "executor"
  | "reviewer"
  | "synthesizer"
  | "policy";

interface MeshStep {
  stepId: string;
  runId: string;
  agentId: string;
  role: AgentRole | string;
  description: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown> | null;
  status: StepStatus;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  toolCalls: unknown[];
  policyDecision: string | null;
  reviewDecision: string | null;
}

interface MeshRun {
  runId: string;
  taskDescription: string;
  userId: string;
  tenantId: string;
  mode: string;
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  steps: MeshStep[];
  result: unknown;
  error: string | null;
  durationMs: number | null;
  executionStrategy?: string;
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

function roleStyle(role: string) {
  const map: Record<string, { bg: string; border: string; color: string }> = {
    supervisor: {
      bg: "rgba(168,85,247,0.12)",
      border: "rgba(168,85,247,0.3)",
      color: "#a855f7",
    },
    planner: {
      bg: "rgba(90,196,255,0.12)",
      border: "rgba(90,196,255,0.3)",
      color: "#5ac4ff",
    },
    researcher: {
      bg: "rgba(249,115,22,0.12)",
      border: "rgba(249,115,22,0.3)",
      color: "#f97316",
    },
    memory: {
      bg: "rgba(234,179,8,0.12)",
      border: "rgba(234,179,8,0.3)",
      color: "#eab308",
    },
    executor: {
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.3)",
      color: "#22c55e",
    },
    reviewer: {
      bg: "rgba(236,72,153,0.12)",
      border: "rgba(236,72,153,0.3)",
      color: "#ec4899",
    },
    synthesizer: {
      bg: "rgba(6,182,212,0.12)",
      border: "rgba(6,182,212,0.3)",
      color: "#06b6d4",
    },
    policy: {
      bg: "rgba(248,113,113,0.12)",
      border: "rgba(248,113,113,0.3)",
      color: "#f87171",
    },
  };
  return (
    map[role.toLowerCase()] ?? {
      bg: "rgba(255,255,255,0.06)",
      border: "rgba(255,255,255,0.12)",
      color: "var(--muted-foreground)",
    }
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

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

// ── StepRow ───────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: MeshStep }) {
  const [open, setOpen] = useState(false);
  const rs = roleStyle(step.role);
  const ss = statusBadgeStyle(step.status as RunStatus);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Role badge */}
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
          style={{
            background: rs.bg,
            border: `1px solid ${rs.border}`,
            color: rs.color,
          }}
        >
          {step.role}
        </span>

        {/* Description */}
        <span className="flex-1 truncate text-sm text-[var(--foreground)]">
          {step.description || step.agentId}
        </span>

        {/* Status */}
        <span
          className="shrink-0 text-xs"
          style={{ color: ss.color }}
        >
          {step.status}
        </span>

        {/* Duration */}
        <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
          {fmtDuration(null, step.startedAt, step.completedAt)}
        </span>

        {open ? (
          <ChevronUp className="size-4 shrink-0 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-[var(--muted-foreground)]" />
        )}
      </button>

      {open && (
        <div
          className="px-4 pb-4 space-y-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {/* Inputs */}
          {step.inputs && Object.keys(step.inputs).length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mt-3 mb-1 uppercase tracking-wider">
                Inputs
              </p>
              <pre
                className="text-xs rounded-lg p-3 overflow-auto max-h-40"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  color: "#5ac4ff",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {JSON.stringify(step.inputs, null, 2)}
              </pre>
            </div>
          )}

          {/* Outputs */}
          {step.outputs && (
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1 uppercase tracking-wider">
                Outputs
              </p>
              <pre
                className="text-xs rounded-lg p-3 overflow-auto max-h-40"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  color: "#22c55e",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {JSON.stringify(step.outputs, null, 2)}
              </pre>
            </div>
          )}

          {/* Tool calls */}
          {Array.isArray(step.toolCalls) && step.toolCalls.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1 uppercase tracking-wider">
                Tool Calls ({step.toolCalls.length})
              </p>
              <pre
                className="text-xs rounded-lg p-3 overflow-auto max-h-32"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  color: "#f97316",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {JSON.stringify(step.toolCalls, null, 2)}
              </pre>
            </div>
          )}

          {/* Policy decision */}
          {step.policyDecision && (
            <p className="text-xs">
              <span className="text-[var(--muted-foreground)] font-medium">
                Policy Decision:
              </span>{" "}
              <span style={{ color: "#f87171" }}>{step.policyDecision}</span>
            </p>
          )}

          {/* Review decision */}
          {step.reviewDecision && (
            <p className="text-xs">
              <span className="text-[var(--muted-foreground)] font-medium">
                Review Decision:
              </span>{" "}
              <span style={{ color: "#ec4899" }}>{step.reviewDecision}</span>
            </p>
          )}

          {/* Error */}
          {step.error && (
            <p className="text-xs" style={{ color: "#f87171" }}>
              <span className="font-medium">Error:</span> {step.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── RunDetail ─────────────────────────────────────────────────────────────────

function RunDetail({
  run,
  onCancel,
  cancelling,
  onRetry,
  retrying,
}: {
  run: MeshRun;
  onCancel: () => void;
  cancelling: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  const isActive = ACTIVE_STATUSES.includes(run.status as RunStatus);
  const isRetryable = run.status === "FAILED" || run.status === "CANCELLED";
  const steps = run.steps ?? [];

  return (
    <div className="space-y-4">
      {/* Run meta */}
      <div
        className="glass-card p-5"
        style={{ borderLeft: "3px solid var(--accent)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--muted-foreground)] font-mono mb-1">
              {run.runId}
            </p>
            <p className="text-sm font-medium text-[var(--foreground)] leading-relaxed">
              {run.taskDescription}
            </p>
          </div>
          <StatusBadge status={run.status} />
        </div>

        <div className="flex flex-wrap gap-4 mt-3 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> Started: {fmtDate(run.startedAt ?? run.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Activity className="size-3" /> Duration:{" "}
            {fmtDuration(run.durationMs, run.startedAt, run.completedAt)}
          </span>
          <span>User: {run.userId}</span>
          <span>Tenant: {run.tenantId}</span>
        </div>

        <div className="mt-3 flex gap-2 flex-wrap">
          {isActive && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
              style={{
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171",
              }}
            >
              {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <StopCircle className="size-3.5" />}
              {cancelling ? "Cancelling…" : "Cancel Run"}
            </button>
          )}
          {isRetryable && (
            <button
              onClick={onRetry}
              disabled={retrying}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
              style={{
                background: "rgba(90,196,255,0.12)",
                border: "1px solid rgba(90,196,255,0.3)",
                color: "#5ac4ff",
              }}
            >
              {retrying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              {retrying ? "Retrying…" : "Retry Run"}
            </button>
          )}
        </div>
      </div>

      {/* Steps timeline */}
      {steps.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="size-4" style={{ color: "var(--accent)" }} />
            <h3 className="font-semibold text-sm text-[var(--foreground)]">
              Steps ({steps.length})
            </h3>
          </div>
          <div className="space-y-2">
            {steps.map((step) => (
              <StepRow key={step.stepId} step={step} />
            ))}
          </div>
        </div>
      )}

      {/* Final answer */}
      {run.status === "COMPLETED" && run.result && (
        <div
          className="glass-card p-5"
          style={{ borderLeft: "3px solid #22c55e" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4" style={{ color: "#22c55e" }} />
            <h3 className="font-semibold text-sm text-[var(--foreground)]">
              Final Answer
            </h3>
          </div>
          <pre
            className="text-xs rounded-lg p-3 overflow-auto max-h-60 whitespace-pre-wrap"
            style={{
              background: "rgba(34,197,94,0.05)",
              border: "1px solid rgba(34,197,94,0.15)",
              color: "var(--foreground)",
            }}
          >
            {typeof run.result === "string"
              ? run.result
              : JSON.stringify(run.result, null, 2)}
          </pre>
        </div>
      )}

      {/* Error */}
      {run.status === "FAILED" && run.error && (
        <div
          className="glass-card p-5"
          style={{ borderLeft: "3px solid #f87171" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="size-4" style={{ color: "#f87171" }} />
            <h3 className="font-semibold text-sm" style={{ color: "#f87171" }}>
              Error
            </h3>
          </div>
          <p className="text-sm text-[var(--foreground)]">{run.error}</p>
          {/* Failure category badge */}
          {(() => {
            const cat = getFailureCategory(run);
            if (!cat) return null;
            const badges: Record<string, { bg: string; border: string; color: string; label: string }> = {
              timeout: { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.3)", color: "#fb923c", label: "⏱ Timeout" },
              orphan:  { bg: "rgba(113,113,122,0.12)", border: "rgba(113,113,122,0.3)", color: "#a1a1aa", label: "🔄 Nach Neustart wiederhergestellt" },
              policy:  { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", color: "#f87171", label: "🛡 Policy-Block" },
              error:   { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", color: "#f87171", label: "Fehler" },
            };
            const b = badges[cat];
            return (
              <span
                className="inline-flex mt-2 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: b.bg, border: `1px solid ${b.border}`, color: b.color }}
              >
                {b.label}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── NewRunForm ────────────────────────────────────────────────────────────────

function NewRunForm({
  onSubmit,
  onClose,
  submitting,
}: {
  onSubmit: (task: string) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [task, setTask] = useState("");

  return (
    <div
      className="glass-card p-5 space-y-4"
      style={{ borderLeft: "3px solid var(--accent)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="size-4" style={{ color: "var(--accent)" }} />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">
            New AgentMesh Run
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 transition-opacity hover:opacity-60"
        >
          <X className="size-4 text-[var(--muted-foreground)]" />
        </button>
      </div>

      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Describe the task for the agent mesh…"
        rows={4}
        className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-colors"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "var(--foreground)",
        }}
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-xs text-[var(--muted-foreground)] transition-opacity hover:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={() => task.trim() && onSubmit(task.trim())}
          disabled={!task.trim() || submitting}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-opacity disabled:opacity-50"
          style={{
            background: "rgba(90,196,255,0.15)",
            border: "1px solid rgba(90,196,255,0.3)",
            color: "var(--accent)",
          }}
        >
          <Play className="size-3.5" />
          {submitting ? "Starting…" : "Start Run"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<RunStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "PLANNING",
  "EXECUTING",
  "REVIEWING",
  "SYNTHESIZING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export default function AgentMeshRunsPage() {
  const [runs, setRuns] = useState<MeshRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<MeshRun | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RunStatus | "ALL">("ALL");
  const [showNewRun, setShowNewRun] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const prevRunStatuses = useRef<Record<string, string>>({});

  const fetchRuns = useCallback(async () => {
    try {
      const qs = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/agentmesh/runs${qs}`);
      const json = await res.json().catch(() => ({}));
      const newRuns: MeshRun[] = Array.isArray(json?.runs) ? json.runs : [];
      setRuns(newRuns);
      setError(null);

      // Detect status transitions to terminal states
      const newStatuses: Record<string, string> = {};
      for (const r of newRuns) newStatuses[r.runId] = r.status;

      for (const [runId, newStatus] of Object.entries(newStatuses)) {
        const prevStatus = prevRunStatuses.current[runId];
        if (prevStatus && prevStatus !== newStatus) {
          const shortId = runId.slice(0, 12);
          if (newStatus === 'COMPLETED') {
            setToast({ message: `Run ${shortId} abgeschlossen ✓`, type: 'success' });
          } else if (newStatus === 'FAILED') {
            setToast({ message: `Run ${shortId} fehlgeschlagen`, type: 'error' });
          } else if (newStatus === 'CANCELLED') {
            setToast({ message: `Run ${shortId} abgebrochen`, type: 'info' });
          }
        }
      }
      prevRunStatuses.current = newStatuses;
    } catch {
      setError("Failed to load runs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchDetail = useCallback(async (runId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/agentmesh/runs/${runId}`);
      const json = await res.json().catch(() => ({}));
      const run: MeshRun = json?.run ?? json;
      if (run?.runId) setSelectedRun(run);
    } catch {
      /* ignore */
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Auto-refresh when active runs exist
  useEffect(() => {
    const hasActive = runs.some((r) => ACTIVE_STATUSES.includes(r.status as RunStatus));
    if (!hasActive) return;
    const t = setInterval(fetchRuns, 5000);
    return () => clearInterval(t);
  }, [runs, fetchRuns]);

  // Refresh detail when active
  useEffect(() => {
    if (!selectedId) return;
    if (!selectedRun) return;
    const isActive = ACTIVE_STATUSES.includes(selectedRun.status as RunStatus);
    if (!isActive) return;
    const t = setInterval(() => fetchDetail(selectedId), 3000);
    return () => clearInterval(t);
  }, [selectedId, selectedRun, fetchDetail]);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleRowClick = (run: MeshRun) => {
    setSelectedId(run.runId);
    setSelectedRun(run);
    fetchDetail(run.runId);
  };

  const handleNewRun = (task: string) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/agentmesh/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task }),
        });
        const json = await res.json().catch(() => ({}));
        if (json?.runId) {
          setShowNewRun(false);
          await fetchRuns();
          // select the new run
          setTimeout(() => {
            handleRowClick({ runId: json.runId, status: "PENDING", taskDescription: task } as MeshRun);
          }, 300);
        }
      } catch {
        /* ignore */
      }
    });
  };

  const handleCancel = async () => {
    if (!selectedId) return;
    setCancelling(true);
    try {
      await fetch(`/api/agentmesh/runs/${selectedId}?action=cancel`, { method: "POST" });
      await fetchRuns();
      await fetchDetail(selectedId);
    } finally {
      setCancelling(false);
    }
  };

  const handleRetry = async () => {
    if (!selectedId) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/agentmesh/runs/${selectedId}?action=retry`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      await fetchRuns();
      // If the retry created a new run, select it; otherwise re-fetch detail of current run
      if (json?.runId && json.runId !== selectedId) {
        setSelectedId(json.runId);
        await fetchDetail(json.runId);
      } else {
        await fetchDetail(selectedId);
      }
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const filtered =
    statusFilter === "ALL"
      ? runs
      : runs.filter((r) => r.status === statusFilter);

  // Execution strategy banner: show when strategy is not 'full' and runs exist
  const execStrategy = runs[0]?.executionStrategy;
  const showStrategyBanner =
    runs.length > 0 &&
    execStrategy &&
    execStrategy !== 'full';

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Activity className="size-6" style={{ color: "var(--accent)" }} />
            AgentMesh Runs
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Runtime execution — start tasks, monitor multi-agent progress, review results
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            Refresh
          </button>
          <button
            onClick={() => setShowNewRun(true)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium"
            style={{
              background: "rgba(90,196,255,0.15)",
              border: "1px solid rgba(90,196,255,0.3)",
              color: "var(--accent)",
            }}
          >
            <Play className="size-3.5" />
            New Run
          </button>
        </div>
      </div>

      {/* New Run Form */}
      {showNewRun && (
        <NewRunForm
          onSubmit={handleNewRun}
          onClose={() => setShowNewRun(false)}
          submitting={isPending}
        />
      )}

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={
              statusFilter === s
                ? {
                    background: "rgba(90,196,255,0.15)",
                    border: "1px solid rgba(90,196,255,0.3)",
                    color: "var(--accent)",
                  }
                : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--muted-foreground)",
                  }
            }
          >
            {s}
            {s !== "ALL" && (
              <span className="ml-1 opacity-60">
                ({runs.filter((r) => r.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="glass-card p-4 flex items-center gap-2 text-sm"
          style={{ borderLeft: "3px solid #f87171", color: "#f87171" }}
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Execution strategy info banner */}
      {showStrategyBanner && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
          style={{
            background: "rgba(234,179,8,0.08)",
            border: "1px solid rgba(234,179,8,0.25)",
            color: "#eab308",
          }}
        >
          <Info className="size-3.5 shrink-0" />
          <span>
            <strong>Execution Strategy: {execStrategy?.toUpperCase()}</strong>
            {execStrategy === 'minimal'
              ? " — Nur 4 Agenten aktiv (supervisor, policy, executor, synthesizer)"
              : execStrategy === 'reduced'
              ? " — Reduzierter Agenten-Pool aktiv"
              : null}
          </span>
        </div>
      )}

      {/* Main layout: run list + detail */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        {/* Run List */}
        <div className="glass-card overflow-hidden">
          <div
            className="px-5 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Runs
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {filtered.length} total
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Activity
                className="size-10 mx-auto mb-3"
                style={{ color: "var(--accent)", opacity: 0.3 }}
              />
              <p className="text-sm text-[var(--muted-foreground)]">
                {statusFilter === "ALL"
                  ? "No runs yet. Start your first AgentMesh run."
                  : `No runs with status "${statusFilter}".`}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ divideColor: "rgba(255,255,255,0.04)" }}>
              {filtered.map((run) => (
                <button
                  key={run.runId}
                  className="w-full text-left px-5 py-4 transition-colors hover:bg-white/[0.03]"
                  style={
                    selectedId === run.runId
                      ? { background: "rgba(90,196,255,0.06)" }
                      : {}
                  }
                  onClick={() => handleRowClick(run)}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-[var(--muted-foreground)]">
                          {run.runId.slice(0, 12)}
                        </span>
                        <StatusBadge status={run.status} />
                        {getFailureCategory(run) === 'timeout' && (
                          <Clock className="size-3.5 shrink-0" style={{ color: "#fb923c" }} title="Timeout" />
                        )}
                        {getFailureCategory(run) === 'orphan' && (
                          <RefreshCw className="size-3.5 shrink-0" style={{ color: "#71717a" }} title="Nach Neustart wiederhergestellt" />
                        )}
                      </div>
                      <p className="text-sm text-[var(--foreground)] truncate">
                        {run.taskDescription}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted-foreground)]">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {fmtDate(run.createdAt)}
                        </span>
                        <span>
                          {fmtDuration(run.durationMs, run.startedAt, run.completedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Run Detail */}
        <div>
          {loadingDetail ? (
            <div className="glass-card p-10 flex items-center justify-center">
              <Loader2
                className="size-5 animate-spin"
                style={{ color: "var(--accent)" }}
              />
            </div>
          ) : selectedRun ? (
            <RunDetail
              run={selectedRun}
              onCancel={handleCancel}
              cancelling={cancelling}
              onRetry={handleRetry}
              retrying={retrying}
            />
          ) : (
            <div
              className="glass-card p-10 text-center"
              style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
            >
              <Activity
                className="size-10 mx-auto mb-3"
                style={{ color: "var(--accent)", opacity: 0.25 }}
              />
              <p className="text-sm text-[var(--muted-foreground)]">
                Select a run to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg transition-all
            ${toast.type === 'success' ? 'bg-green-900/90 border border-green-500/30 text-green-200' :
              toast.type === 'error' ? 'bg-red-900/90 border border-red-500/30 text-red-200' :
              'bg-[#1a2030] border border-white/10 text-white/80'}`}
        >
          {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
          {toast.type === 'error' && <XCircle className="h-4 w-4 text-red-400" />}
          {toast.type === 'info' && <Info className="h-4 w-4 text-blue-400" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  );
}

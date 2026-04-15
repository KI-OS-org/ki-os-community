"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RunOutput  { timestamp: string; type?: string; content?: string; text?: string; }
interface RunError   { timestamp: string; message?: string; code?: string; }
interface RunStep    { id: string; name: string; status: string; timestamp: string; worker?: string | null; }

interface Run {
  runId:      string;
  status:     string;
  agentId:    string;
  createdAt:  string;
  completedAt?: string | null;
  steps:      RunStep[];
  outputs:    RunOutput[];
  errors:     RunError[];
  task?:      string;
  projection?: { summary?: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type StatusKey = "COMPLETED" | "FAILED" | "RUNNING" | "CANCELLED" | string;

const STATUS_BADGE: Record<StatusKey, string> = {
  COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  FAILED:    "border-red-500/30 bg-red-500/10 text-red-300",
  CANCELLED: "border-white/20 bg-white/5 text-white/50",
};

const ACTIVE_STATES = new Set([
  "CREATED","INTENT_RESOLVED","PLANNING","ROUTED",
  "EXECUTING","VERIFYING","REVIEWING","WAITING_APPROVAL",
]);

function statusBadgeClass(status: string) {
  if (ACTIVE_STATES.has(status))  return "border-[rgba(90,196,255,0.35)] bg-[rgba(90,196,255,0.08)] text-[var(--accent)] animate-pulse";
  return STATUS_BADGE[status] ?? "border-white/20 bg-white/5 text-white/50";
}

function duration(run: Run) {
  if (!run.createdAt) return "–";
  const end = run.completedAt ? new Date(run.completedAt) : new Date();
  const ms  = end.getTime() - new Date(run.createdAt).getTime();
  if (ms < 0) return "–";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function outputPreview(run: Run) {
  const last = run.outputs?.[run.outputs.length - 1];
  if (!last) return "–";
  const text = last.content ?? last.text ?? JSON.stringify(last);
  return text.length > 80 ? text.slice(0, 80) + "…" : text;
}

function workerName(run: Run) {
  const last = [...(run.steps ?? [])].reverse().find(s => s.worker);
  return last?.worker ?? "–";
}

// ─── Filter options ──────────────────────────────────────────────────────────

const FILTERS = ["All", "COMPLETED", "FAILED", "RUNNING", "CANCELLED"] as const;
type Filter = (typeof FILTERS)[number];

const PAGE_SIZE = 15;

// ─── Component ───────────────────────────────────────────────────────────────

export default function AgentRunsPage() {
  const params  = useParams<{ id: string }>();
  const agentId = params.id;

  const [runs,      setRuns]      = useState<Run[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [filter,    setFilter]    = useState<Filter>("All");
  const [page,      setPage]      = useState(0);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/runs?agentId=${encodeURIComponent(agentId)}&limit=200`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: Run[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items) ? data.items : [];
      setRuns(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(runId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(runId) ? next.delete(runId) : next.add(runId);
      return next;
    });
  }

  // Filter
  const filtered = runs.filter(r => {
    if (filter === "All")     return true;
    if (filter === "RUNNING") return ACTIVE_STATES.has(r.status);
    return r.status === filter;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function setFilterAndReset(f: Filter) {
    setFilter(f);
    setPage(0);
  }

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link
        href={`/agents/${agentId}`}
        className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-white"
      >
        <ChevronLeft className="size-4" /> Agent Details
      </Link>

      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">Run History</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Alle Ausführungen für Agent <code className="font-mono text-xs text-[var(--accent)]">{agentId}</code>
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-white/8 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </button>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilterAndReset(f)}
            className="rounded-full border px-3 py-1 text-xs font-medium transition"
            style={{
              background:  filter === f ? "rgba(90,196,255,0.10)" : "rgba(255,255,255,0.04)",
              borderColor: filter === f ? "rgba(90,196,255,0.35)" : "rgba(255,255,255,0.10)",
              color:       filter === f ? "var(--accent)"         : "var(--muted-foreground)",
            }}
          >
            {f}
            {f !== "All" && (
              <span className="ml-1.5 opacity-60">
                {f === "RUNNING"
                  ? runs.filter(r => ACTIVE_STATES.has(r.status)).length
                  : runs.filter(r => r.status === f).length}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-[var(--muted-foreground)]">
          {filtered.length} Runs
        </span>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20 backdrop-blur">
        {error && (
          <div className="p-6 text-sm text-red-400">{error}</div>
        )}

        {!error && loading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-[12px] bg-white/5" />
            ))}
          </div>
        )}

        {!error && !loading && filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">
            Keine Runs gefunden.
          </div>
        )}

        {!error && !loading && paginated.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/8 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  <th className="py-3 pl-5 pr-3 text-left font-medium">Run ID</th>
                  <th className="px-3 py-3 text-left font-medium">Status</th>
                  <th className="px-3 py-3 text-left font-medium">Gestartet</th>
                  <th className="px-3 py-3 text-left font-medium">Dauer</th>
                  <th className="px-3 py-3 text-left font-medium">Worker</th>
                  <th className="px-3 py-3 pr-5 text-left font-medium">Output</th>
                  <th className="w-8 py-3 pr-5" />
                </tr>
              </thead>
              <tbody>
                {paginated.map(run => {
                  const isOpen = expanded.has(run.runId);
                  return (
                    <>
                      <tr
                        key={run.runId}
                        onClick={() => toggleExpand(run.runId)}
                        className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/4"
                      >
                        <td className="py-3 pl-5 pr-3 font-mono text-xs text-white/70">
                          {run.runId.length > 18 ? run.runId.slice(0, 18) + "…" : run.runId}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClass(run.status)}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-white/60">{fmtDate(run.createdAt)}</td>
                        <td className="px-3 py-3 text-xs text-white/60">{duration(run)}</td>
                        <td className="px-3 py-3 text-xs text-white/60">{workerName(run)}</td>
                        <td className="max-w-[200px] overflow-hidden truncate px-3 py-3 pr-5 text-xs text-white/50">
                          {outputPreview(run)}
                        </td>
                        <td className="pr-5 text-white/30">
                          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isOpen && (
                        <tr key={`${run.runId}-detail`} className="border-b border-white/5 last:border-0">
                          <td colSpan={7} className="bg-white/3 px-5 pb-5 pt-3">
                            <div className="space-y-4">

                              {/* Task */}
                              {run.task && (
                                <div>
                                  <p className="mb-1 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Task</p>
                                  <p className="text-xs text-white/70">{run.task}</p>
                                </div>
                              )}

                              {/* Steps */}
                              {run.steps?.length > 0 && (
                                <div>
                                  <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Steps</p>
                                  <div className="space-y-1">
                                    {run.steps.map(step => (
                                      <div key={step.id} className="flex items-center gap-3 rounded-[10px] border border-white/6 bg-white/3 px-3 py-1.5 text-xs">
                                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(step.status)}`}>
                                          {step.status}
                                        </span>
                                        <span className="text-white/70">{step.name}</span>
                                        {step.worker && <span className="text-white/40">{step.worker}</span>}
                                        <span className="ml-auto text-white/30">{fmtDate(step.timestamp)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Full Output */}
                              {run.outputs?.length > 0 && (
                                <div>
                                  <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Output</p>
                                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[14px] border border-white/8 bg-white/4 p-3 font-mono text-xs text-white/70">
                                    {run.outputs.map(o => o.content ?? o.text ?? JSON.stringify(o)).join("\n\n")}
                                  </pre>
                                </div>
                              )}

                              {/* Errors */}
                              {run.errors?.length > 0 && (
                                <div>
                                  <p className="mb-2 text-[10px] uppercase tracking-widest text-red-400/70">Fehler</p>
                                  <div className="space-y-1">
                                    {run.errors.map((err, i) => (
                                      <div key={i} className="rounded-[10px] border border-red-500/20 bg-red-500/6 px-3 py-2 text-xs text-red-300">
                                        <span className="font-mono">{err.code ?? "ERR"}</span>
                                        {err.message && <span className="ml-2 text-red-300/80">{err.message}</span>}
                                        {err.timestamp && <span className="ml-2 text-red-400/40">{fmtDate(err.timestamp)}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/8 px-5 py-3">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-[var(--muted-foreground)] transition hover:bg-white/8 disabled:opacity-40"
            >
              Zurück
            </button>
            <span className="text-xs text-[var(--muted-foreground)]">
              Seite {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-[var(--muted-foreground)] transition hover:bg-white/8 disabled:opacity-40"
            >
              Weiter
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

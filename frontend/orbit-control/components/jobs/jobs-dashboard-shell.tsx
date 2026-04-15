"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock, Loader2, Play, RefreshCw, XCircle } from "lucide-react";

type RunItem   = Record<string, unknown>;
type EventItem = Record<string, unknown>;

const STATUS_META: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  running:   { icon: <Loader2  className="size-3 animate-spin" />, cls: "bg-blue-500/10   text-blue-400   border-blue-500/20",   label: "Running"   },
  pending:   { icon: <Clock    className="size-3" />,              cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Pending"   },
  queued:    { icon: <Clock    className="size-3" />,              cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Queued"    },
  completed: { icon: <CheckCircle2 className="size-3" />,          cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Done"  },
  failed:    { icon: <XCircle  className="size-3" />,              cls: "bg-red-500/10    text-red-400    border-red-500/20",    label: "Failed"    },
  error:     { icon: <AlertCircle className="size-3" />,           cls: "bg-red-500/10    text-red-400    border-red-500/20",    label: "Error"     },
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.queued;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
}

function RunRow({ run }: { run: RunItem }) {
  const id      = String(run.runId ?? run.id ?? "");
  const label   = String(run.label ?? run.name ?? run.goal ?? id.slice(0, 12) + "…");
  const status  = String(run.status ?? "queued").toLowerCase();
  const started = String(run.startedAt ?? run.createdAt ?? "");
  const ended   = String(run.endedAt   ?? run.completedAt ?? "");
  const model   = String(run.model ?? run.modelId ?? "");
  const cost    = typeof run.totalCost === "number" ? `$${run.totalCost.toFixed(4)}` : "";

  return (
    <a href={`/runs/${id}`}
      className="glass-card flex items-center gap-3 px-4 py-3 hover:border-[rgba(90,196,255,0.3)] transition group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{label}</p>
        <p className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--muted-foreground)" }}>{id.slice(0, 16)}…</p>
      </div>
      <StatusPill status={status} />
      {model && <span className="hidden sm:block text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.04)", color: "var(--muted-foreground)" }}>{model}</span>}
      {cost  && <span className="text-[10px] font-semibold" style={{ color: "var(--accent)" }}>{cost}</span>}
      <div className="text-[10px] text-right" style={{ color: "var(--muted-foreground)" }}>
        {started && <div>{fmt(started)}</div>}
        {ended   && <div className="opacity-60">{fmt(ended)}</div>}
      </div>
    </a>
  );
}

function EventRow({ ev }: { ev: EventItem }) {
  const type  = String(ev.type ?? ev.eventType ?? "event");
  const msg   = String(ev.message ?? ev.description ?? ev.data ?? "");
  const ts    = String(ev.timestamp ?? ev.createdAt ?? "");
  const level = String(ev.level ?? "info").toLowerCase();

  const levelCls = level === "error" ? "text-red-400" : level === "warn" ? "text-yellow-400" : "text-emerald-400";

  return (
    <div className="flex items-start gap-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <span className={`mt-0.5 text-[10px] font-semibold uppercase ${levelCls}`}>{level}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded mr-2" style={{ background: "rgba(90,196,255,0.08)", color: "var(--accent)" }}>{type}</span>
        <span className="text-xs" style={{ color: "var(--foreground)" }}>{msg}</span>
      </div>
      {ts && <span className="text-[10px] whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>{fmt(ts)}</span>}
    </div>
  );
}

interface JobsDashboardShellProps {
  runs:   Record<string, unknown> | null;
  events: Record<string, unknown> | null;
}

const STATUS_FILTERS = ["all", "running", "pending", "completed", "failed"];

export function JobsDashboardShell({ runs: initialRuns, events: initialEvents }: JobsDashboardShellProps) {
  const [runs,    setRuns]    = useState<RunItem[]>(
    Array.isArray((initialRuns as Record<string, unknown>)?.items)
      ? (initialRuns as Record<string, unknown[]>).items as RunItem[]
      : Array.isArray(initialRuns) ? initialRuns as RunItem[] : []
  );
  const [events,  setEvents]  = useState<EventItem[]>(
    Array.isArray((initialEvents as Record<string, unknown>)?.items)
      ? (initialEvents as Record<string, unknown[]>).items as EventItem[]
      : Array.isArray(initialEvents) ? initialEvents as EventItem[] : []
  );
  const [filter,  setFilter]  = useState("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, e] = await Promise.allSettled([
        fetch("/api/jobs").then((x) => x.json()),
        fetch("/api/jobs").then((x) => x.json()),
      ]);
      if (r.status === "fulfilled") {
        const data = r.value;
        const list = Array.isArray(data?.runs?.items) ? data.runs.items
          : Array.isArray(data?.runs) ? data.runs
          : Array.isArray(data?.items) ? data.items : [];
        setRuns(list);
        const evs = Array.isArray(data?.events?.items) ? data.events.items
          : Array.isArray(data?.events) ? data.events : [];
        setEvents(evs);
      }
    } finally { setLoading(false); }
  }, []);

  // auto-refresh every 15s
  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const visible = filter === "all"
    ? runs
    : runs.filter((r) => String(r.status ?? "queued").toLowerCase() === filter);

  const counts = {
    running:   runs.filter((r) => String(r.status ?? "").toLowerCase() === "running").length,
    pending:   runs.filter((r) => ["pending", "queued"].includes(String(r.status ?? "").toLowerCase())).length,
    completed: runs.filter((r) => String(r.status ?? "").toLowerCase() === "completed").length,
    failed:    runs.filter((r) => ["failed", "error"].includes(String(r.status ?? "").toLowerCase())).length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Activity className="size-5" style={{ color: "var(--accent)" }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Jobs Dashboard</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {runs.length} Gesamt · {counts.running} aktiv · {counts.failed} Fehler
              </p>
            </div>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition"
            style={{ background: "rgba(90,196,255,0.10)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { label: "Running",   value: counts.running,   icon: <Loader2 className="size-3 animate-spin" />, color: "text-blue-400"    },
            { label: "Pending",   value: counts.pending,   icon: <Clock   className="size-3" />,              color: "text-yellow-400"  },
            { label: "Done",      value: counts.completed, icon: <CheckCircle2 className="size-3" />,         color: "text-emerald-400" },
            { label: "Failed",    value: counts.failed,    icon: <XCircle className="size-3" />,              color: "text-red-400"     },
          ].map((s) => (
            <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${s.color}`}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {s.icon}{s.value} {s.label}
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition capitalize"
              style={{
                background: filter === f ? "rgba(90,196,255,0.15)" : "rgba(255,255,255,0.04)",
                border:     filter === f ? "1px solid rgba(90,196,255,0.35)" : "1px solid var(--border)",
                color:      filter === f ? "var(--accent)" : "var(--muted-foreground)",
              }}>
              {f === "all" ? `Alle (${runs.length})` : f}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Run list */}
        <div className="xl:col-span-2 space-y-2">
          {loading && (
            <div className="text-center py-8" style={{ color: "var(--muted-foreground)" }}>
              <RefreshCw className="mx-auto size-6 animate-spin mb-2 opacity-40" />
              <p className="text-sm">Lade Jobs…</p>
            </div>
          )}
          {!loading && visible.length === 0 && (
            <div className="text-center py-16" style={{ color: "var(--muted-foreground)" }}>
              <Play className="mx-auto size-12 mb-3 opacity-20" />
              <p className="text-sm">Keine Jobs gefunden.</p>
            </div>
          )}
          {!loading && visible.map((run, i) => {
            const id = String(run.runId ?? run.id ?? `run-${i}`);
            return <RunRow key={id} run={run} />;
          })}
        </div>

        {/* Event stream */}
        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <Activity className="size-4" style={{ color: "var(--accent)" }} />
            Live Events
          </h2>
          {events.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--muted-foreground)" }}>Keine Events</p>
          ) : (
            <div className="overflow-y-auto max-h-[500px]">
              {events.slice(0, 100).map((ev, i) => (
                <EventRow key={i} ev={ev} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

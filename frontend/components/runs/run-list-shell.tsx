"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Activity, RefreshCw, Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";

const STATUS_STYLES: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  queued:     { label: "Queued",     cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",    icon: <Clock    className="size-3" /> },
  planning:   { label: "Planning",   cls: "bg-cyan-500/10 text-cyan--400 border-cyan-500/20",   icon: <Activity className="size-3" /> },
  researching:{ label: "Recherche",  cls: "bg-sky-500/10 text-sky-400 border-sky-500/20",       icon: <Activity className="size-3" /> },
  executing:  { label: "Executing",  cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: <Loader2 className="size-3 animate-spin" /> },
  verifying:  { label: "Verifying",  cls: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: <Activity className="size-3" /> },
  done:       { label: "Done",       cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle className="size-3" /> },
  completed:  { label: "Completed",  cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle className="size-3" /> },
  failed:     { label: "Failed",     cls: "bg-red-500/10 text-red-400 border-red-500/20",       icon: <XCircle  className="size-3" /> },
};

const FILTERS = ["all", "queued", "executing", "done", "completed", "failed"] as const;

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status?.toLowerCase()] ?? { label: status, cls: "bg-white/10 text-white/60 border-white/10", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

export function RunListShell({ initialRuns }: { initialRuns: unknown[] }) {
  const [runs,    setRuns]    = useState<Record<string, unknown>[]>(
    (initialRuns as Record<string, unknown>[]) ?? []
  );
  const [filter,  setFilter]  = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/runs?limit=50");
      const j = await r.json();
      setRuns(Array.isArray(j?.items) ? j.items : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const visible = filter === "all"
    ? runs
    : runs.filter((r) => String(r.status ?? "").toLowerCase() === filter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity className="size-5" style={{ color: "var(--accent)" }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Agent Runtime</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {runs.length} Runs · Live-Transparenz über alle Agenten-Ausführungen
              </p>
            </div>
          </div>
          <button onClick={refresh} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition"
            style={{ background: "rgba(90,196,255,0.10)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition"
              style={{
                background: filter === f ? "rgba(90,196,255,0.15)" : "rgba(255,255,255,0.04)",
                border:     filter === f ? "1px solid rgba(90,196,255,0.35)" : "1px solid var(--border)",
                color:      filter === f ? "var(--accent)" : "var(--muted-foreground)",
              }}>
              {f === "all" ? `Alle (${runs.length})` : STATUS_STYLES[f]?.label ?? f}
            </button>
          ))}
        </div>
      </section>

      {/* Run cards */}
      {visible.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--muted-foreground)" }}>
          <Activity className="mx-auto size-12 mb-3 opacity-20" />
          <p className="text-sm">Keine Runs gefunden. Starte einen Task im Workspace.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((run, i) => {
            const id = String(run.runId ?? run.id ?? `run-${i}`);
            return (
              <Link key={id} href={`/runs/${id}`}>
                <div className="glass-card p-4 h-full cursor-pointer group">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <StatusBadge status={String(run.status ?? "queued")} />
                    <span className="text-xs font-mono opacity-50 truncate max-w-[120px]">{id}</span>
                  </div>
                  <p className="text-sm font-medium mb-2 line-clamp-2" style={{ color: "var(--foreground)" }}>
                    {String(run.task ?? run.type ?? "Agent Task")}
                  </p>
                  <div className="flex items-center justify-between text-xs mt-3" style={{ color: "var(--muted-foreground)" }}>
                    <span>{run.createdAt ? fmt(String(run.createdAt)) : "—"}</span>
                    {run.agentId != null && <span className="font-mono">{String(run.agentId)}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

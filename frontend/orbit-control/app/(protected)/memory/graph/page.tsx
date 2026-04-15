"use client";

import { useState, useEffect, useMemo } from "react";
import { BrainCircuit, RefreshCw, Filter } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemoryNode {
  id: string;
  content?: string;
  category?: string;
  sensitivity?: string;
  relevanceScore?: number;
  connections?: string[];
  createdAt?: string;
  tags?: string[];
}

interface GraphData {
  nodes: MemoryNode[];
  edges?: { source: string; target: string; weight?: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sensitivityColor(s?: string) {
  switch (s?.toLowerCase()) {
    case "high":     return "#f87171";
    case "medium":   return "#eab308";
    case "low":      return "#22c55e";
    default:         return "#5ac4ff";
  }
}

function scoreBar(score?: number) {
  const pct = score != null ? Math.min(100, Math.max(0, score * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#5ac4ff" }} />
      </div>
      <span className="text-xs text-[var(--muted-foreground)] w-8 text-right">{score != null ? score.toFixed(2) : "—"}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MemoryGraphPage() {
  const [graph,          setGraph]          = useState<GraphData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSens,     setFilterSens]     = useState("");

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/memory/graph");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? "Fehler");
      setGraph(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const nodes = graph?.nodes ?? [];

  const categories = useMemo(
    () => [...new Set(nodes.map(n => n.category).filter(Boolean))] as string[],
    [nodes]
  );

  const sensitivities = useMemo(
    () => [...new Set(nodes.map(n => n.sensitivity).filter(Boolean))] as string[],
    [nodes]
  );

  const filtered = useMemo(() => nodes.filter(n => {
    if (filterCategory && n.category !== filterCategory) return false;
    if (filterSens     && n.sensitivity !== filterSens)     return false;
    return true;
  }), [nodes, filterCategory, filterSens]);

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <BrainCircuit className="size-6" style={{ color: "var(--accent)" }} />
            Memory Graph
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Memory-Knoten, Verbindungen und Relevanz-Scores
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: "rgba(90,196,255,0.12)", border: "1px solid rgba(90,196,255,0.25)", color: "#5ac4ff" }}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      {nodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="size-4 text-[var(--muted-foreground)]" />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-xs outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
          >
            <option value="">Alle Kategorien</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filterSens}
            onChange={e => setFilterSens(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-xs outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
          >
            <option value="">Alle Sensitivitäten</option>
            {sensitivities.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <span className="text-xs text-[var(--muted-foreground)]">
            {filtered.length} / {nodes.length} Knoten
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="size-6 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : nodes.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-2">
          <BrainCircuit className="size-12 mx-auto" style={{ color: "var(--accent)", opacity: 0.3 }} />
          <p className="text-[var(--foreground)] font-medium">Kein Memory-Graph verfügbar</p>
          <p className="text-sm text-[var(--muted-foreground)]">Noch keine Memory-Knoten vorhanden</p>
        </div>
      ) : (
        <div className="glass-card p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted-foreground)] border-b border-white/5">
                  <th className="pb-3 pr-4 font-medium">ID</th>
                  <th className="pb-3 pr-4 font-medium">Inhalt</th>
                  <th className="pb-3 pr-4 font-medium">Kategorie</th>
                  <th className="pb-3 pr-4 font-medium">Sensitivität</th>
                  <th className="pb-3 pr-4 font-medium">Relevanz</th>
                  <th className="pb-3 font-medium">Verbindungen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(n => (
                  <tr key={n.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4">
                      <code className="text-xs text-[var(--muted-foreground)] font-mono">{n.id.slice(0, 12)}…</code>
                    </td>
                    <td className="py-3 pr-4 max-w-xs">
                      <p className="text-sm text-[var(--foreground)] truncate">{n.content ?? "—"}</p>
                      {(n.tags?.length ?? 0) > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {n.tags!.slice(0, 3).map(t => (
                            <span key={t} className="text-xs rounded px-1.5 py-0.5" style={{ background: "rgba(90,196,255,0.1)", color: "#5ac4ff" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {n.category ? (
                        <span className="text-xs rounded-full px-2 py-0.5" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
                          {n.category}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {n.sensitivity ? (
                        <span className="text-xs font-medium" style={{ color: sensitivityColor(n.sensitivity) }}>
                          {n.sensitivity}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 pr-4 w-32">{scoreBar(n.relevanceScore)}</td>
                    <td className="py-3">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {n.connections?.length ?? 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edge summary if available */}
      {(graph?.edges?.length ?? 0) > 0 && (
        <div className="glass-card p-4 flex items-center gap-3">
          <BrainCircuit className="size-4 shrink-0" style={{ color: "var(--accent)" }} />
          <p className="text-sm text-[var(--muted-foreground)]">
            <span className="text-[var(--foreground)] font-medium">{graph!.edges!.length}</span> Verbindungen im Graph
          </p>
        </div>
      )}
    </div>
  );
}

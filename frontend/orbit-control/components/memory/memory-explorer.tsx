"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Eye, EyeOff, Lock, Pin, RefreshCw, Search, Trash2, X } from "lucide-react";

type MemItem = Record<string, unknown>;

const SCOPE_COLORS: Record<string, string> = {
  workspace:    "bg-blue-500/10   text-blue-400   border-blue-500/20",
  user:         "bg-cyan-500/10   text-cyan-400   border-cyan-500/20",
  "run-summary":"bg-purple-500/10 text-purple-400 border-purple-500/20",
  conversation: "bg-sky-500/10   text-sky-400    border-sky-500/20",
  system:       "bg-gray-500/10  text-gray-400   border-gray-500/20",
  analysis:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score <= 1 ? score * 100 : score);
  const color = pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";
  return <span className={`text-[10px] font-semibold ${color}`}>{pct}%</span>;
}

function MemoryCard({ item, onForget, onPin }: { item: MemItem; onForget: () => void; onPin: () => void }) {
  const [expanded,  setExpanded]  = useState(false);
  const [showSens,  setShowSens]  = useState(false);
  const [confirming, setConfirming] = useState(false);

  const text      = String(item.text ?? item.summary ?? item.content ?? "");
  const category  = String(item.category ?? item.sourceType ?? "system");
  const scope     = String(item.scope ?? "workspace");
  const ts        = String(item.timestamp ?? item.createdAt ?? "");
  const score     = typeof item.relevanceScore === "number" ? item.relevanceScore : undefined;
  const sensitive = !!(item.sensitive ?? (item.metadata as Record<string,unknown>)?.sensitive ?? (item.semantic as Record<string,unknown>)?.sensitivity);
  const pinned    = !!(item.pinned ?? (item.metadata as Record<string,unknown>)?.pinned);
  const runId     = String(item.linkedRunId ?? item.runId ?? "");

  const scopeCls = SCOPE_COLORS[scope] ?? SCOPE_COLORS.system;
  const blurred  = sensitive && !showSens;

  function fmt(iso: string) {
    try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); }
    catch { return iso; }
  }

  return (
    <div className={`glass-card p-4 group transition ${pinned ? "border-[rgba(90,196,255,0.35)]" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${scopeCls}`}>{category}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${scopeCls}`}>{scope}</span>
          {sensitive && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-500/10 text-red-400 border-red-500/20 flex items-center gap-1">
              <Lock className="size-2.5" /> Sensitiv
            </span>
          )}
          {pinned && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">Gepinnt</span>}
        </div>
        {score !== undefined && <ScoreBadge score={score} />}
      </div>

      {/* Body */}
      <div className={`text-sm leading-relaxed transition ${blurred ? "blur-sm select-none" : ""}`} style={{ color: "var(--foreground)" }}>
        <p className={expanded ? "" : "line-clamp-3"}>{text}</p>
        {text.length > 200 && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs mt-1 hover:opacity-80"
            style={{ color: "var(--accent)" }}>
            {expanded ? "Weniger" : "Mehr anzeigen"}
          </button>
        )}
      </div>
      {sensitive && !showSens && (
        <button onClick={() => setShowSens(true)}
          className="mt-2 flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg transition"
          style={{ background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
          <Eye className="size-3" /> Entsperren
        </button>
      )}
      {sensitive && showSens && (
        <button onClick={() => setShowSens(false)} className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <EyeOff className="size-3" /> Verbergen
        </button>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          {ts && <span>{fmt(ts)}</span>}
          {runId && <span className="font-mono">run:{runId.slice(0, 12)}…</span>}
        </div>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
          <button onClick={onPin} title={pinned ? "Unpin" : "Pin"}
            className="p-1.5 rounded-lg hover:bg-white/8 transition" style={{ color: "var(--muted-foreground)" }}>
            <Pin className={`size-3 ${pinned ? "fill-cyan-400 text-cyan-400" : ""}`} />
          </button>
          {!confirming
            ? <button onClick={() => setConfirming(true)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition" style={{ color: "var(--muted-foreground)" }}>
                <Trash2 className="size-3" />
              </button>
            : <div className="flex items-center gap-1">
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Löschen?</span>
                <button onClick={() => { onForget(); setConfirming(false); }}
                  className="text-[10px] px-2 py-0.5 rounded-md text-red-400 hover:bg-red-500/10">Ja</button>
                <button onClick={() => setConfirming(false)}
                  className="text-[10px] px-2 py-0.5 rounded-md" style={{ color: "var(--muted-foreground)" }}>Nein</button>
              </div>
          }
        </div>
      </div>
    </div>
  );
}

const SCOPE_FILTERS = ["all", "workspace", "user", "run-summary", "conversation", "system"];

export function MemoryExplorer({ initialItems }: { initialItems?: unknown[] }) {
  const [items,   setItems]   = useState<MemItem[]>((initialItems as MemItem[]) ?? []);
  const [query,   setQuery]   = useState("");
  const [scope,   setScope]   = useState("all");
  const [loading, setLoading] = useState(false);
  const debounce  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async (q: string, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: "demo", limit: "100" });
      if (q) params.set("q", q);
      const r = await fetch(`/api/memory?${params}`);
      const j = await r.json();
      let list = Array.isArray(j?.items) ? j.items as MemItem[] : [];
      if (s !== "all") list = list.filter((i) => String(i.scope ?? i.sourceType ?? "workspace") === s);
      setItems(list);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(query, scope), 300);
    return () => clearTimeout(debounce.current);
  }, [query, scope, load]);

  function handleForget(id: string) {
    setItems((prev) => prev.filter((i) => String(i.memoryId ?? i.id ?? "") !== id));
  }

  function handlePin(id: string) {
    setItems((prev) => prev.map((i) =>
      String(i.memoryId ?? i.id ?? "") === id ? { ...i, pinned: !i.pinned } : i
    ));
  }

  const stats = {
    total:  items.length,
    scopes: new Set(items.map((i) => String(i.scope ?? "workspace"))).size,
    pinned: items.filter((i) => i.pinned).length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Brain className="size-5" style={{ color: "var(--accent)" }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Memory Explorer</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {stats.total} Einträge · {stats.scopes} Scopes · {stats.pinned} Gepinnt
              </p>
            </div>
          </div>
          <button onClick={() => load(query, scope)} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition"
            style={{ background: "rgba(90,196,255,0.10)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Memory durchsuchen…"
            className="w-full rounded-xl py-2.5 pl-10 pr-9 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="size-4" style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
        </div>

        {/* Scope filter */}
        <div className="flex flex-wrap gap-2">
          {SCOPE_FILTERS.map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition"
              style={{
                background: scope === s ? "rgba(90,196,255,0.15)" : "rgba(255,255,255,0.04)",
                border:     scope === s ? "1px solid rgba(90,196,255,0.35)" : "1px solid var(--border)",
                color:      scope === s ? "var(--accent)" : "var(--muted-foreground)",
              }}>
              {s === "all" ? `Alle (${stats.total})` : s}
            </button>
          ))}
        </div>
      </section>

      {/* Memory grid */}
      {loading && (
        <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
          <RefreshCw className="mx-auto size-8 animate-spin mb-3 opacity-40" />
          <p className="text-sm">Lade Memory…</p>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--muted-foreground)" }}>
          <Brain className="mx-auto size-12 mb-3 opacity-20" />
          <p className="text-sm">Noch keine Memory-Einträge. Starte einen Chat oder einen Task.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, i) => {
            const id = String(item.memoryId ?? item.id ?? `item-${i}`);
            return (
              <MemoryCard key={id} item={item}
                onForget={() => handleForget(id)}
                onPin={()    => handlePin(id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

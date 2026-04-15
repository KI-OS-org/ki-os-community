"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Search, X, FileText, Workflow, PlugZap, Bot, Play, Megaphone, BrainCircuit } from "lucide-react";

const CATEGORIES = [
  { id: "all",          label: "Alle",           icon: Search     },
  { id: "runs",         label: "Runs",           icon: Play       },
  { id: "agents",       label: "Agents",         icon: Bot        },
  { id: "flows",        label: "Flows",          icon: Workflow   },
  { id: "integrations", label: "Integrationen",  icon: PlugZap    },
  { id: "files",        label: "Dateien",        icon: FileText   },
  { id: "campaigns",    label: "Kampagnen",      icon: Megaphone  },
  { id: "memory",       label: "Memory",         icon: BrainCircuit },
];

const TYPE_LINKS: Record<string, (item: Record<string, unknown>) => string | null> = {
  run:       (i) => i.runId ? `/runs/${i.runId}` : null,
  agent:     (i) => i.id    ? `/agents/${i.id}`  : null,
  campaign:  (i) => i.id    ? `/campaigns`       : null,
  connector: ()  => `/integrations`,
  flow:      (i) => i.dagId ? `/flows`           : null,
  file:      ()  => `/files`,
  memory:    ()  => `/memory`,
};

export default function SearchPage() {
  const [query, setQuery]       = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<Record<string, unknown>[]>([]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search/app?q=${encodeURIComponent(q)}&category=${category}`);
      const json = await res.json();
      setResults(Array.isArray(json.items) ? json.items : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  return (
    <div className="min-h-screen p-6 animate-fade-in" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.30em] mb-2" style={{ color: "var(--accent)" }}>
            KI-OS Orbit Control
          </p>
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            Globale Suche
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Durchsuche Flows, Integrationen, Dateien, Tenants und Runs
          </p>
        </div>

        {/* Search input */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); runSearch(e.target.value); }}
            placeholder="Suche eingeben…"
            className="w-full rounded-2xl py-4 pl-12 pr-12 text-sm outline-none focus:ring-2 transition"
            style={{
              background: "rgba(8,12,30,0.80)",
              border: "1px solid var(--border-accent)",
              color: "var(--foreground)",
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.id); runSearch(query); }}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition"
                style={{
                  background: active ? "var(--accent-dim)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "var(--border-accent)" : "var(--border)"}`,
                  color: active ? "var(--accent)" : "var(--muted-foreground)",
                }}
              >
                <Icon className="size-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {loading && (
          <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
            <div className="inline-block size-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            <p className="mt-4 text-sm">Suche läuft…</p>
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
            <Search className="mx-auto size-10 mb-3 opacity-30" />
            <p className="text-sm">Keine Ergebnisse für „{query}"</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((item, i) => {
              const t    = String(item.type ?? "");
              const href = TYPE_LINKS[t]?.(item as Record<string, unknown>) ?? null;
              const title = String(item.title ?? item.name ?? item.id ?? "–");
              const desc  = String(item.description ?? item.summary ?? item.goal ?? item.content ?? "");
              const Card = href ? Link : "div";
              return (
                <Card
                  key={i}
                  href={href ?? ""}
                  className="glass-card p-4 animate-fade-in block hover:border-[rgba(90,196,255,0.3)] transition-colors"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>
                        {title}
                      </p>
                      {desc && (
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                          {desc}
                        </p>
                      )}
                    </div>
                    {t && <span className="pill-cyan shrink-0">{t}</span>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {!query && (
          <div className="text-center py-16" style={{ color: "var(--muted-foreground)" }}>
            <Search className="mx-auto size-14 mb-4 opacity-20" />
            <p className="text-sm">Gib einen Suchbegriff ein, um loszulegen</p>
          </div>
        )}
      </div>
    </div>
  );
}

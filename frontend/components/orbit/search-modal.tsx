"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, X, FileText, Workflow, PlugZap, Users, Play } from "lucide-react";
import { useOrbitShellStore } from "@/lib/orbit-store";

const CATEGORIES = [
  { id: "all",          label: "Alle",          icon: Search },
  { id: "flows",        label: "Flows",         icon: Workflow },
  { id: "integrations", label: "Integrationen", icon: PlugZap },
  { id: "files",        label: "Dateien",       icon: FileText },
  { id: "tenants",      label: "Tenants",       icon: Users },
  { id: "runs",         label: "Runs",          icon: Play },
];

export function SearchModal() {
  const open    = useOrbitShellStore((s) => s.searchModalOpen);
  const setOpen = useOrbitShellStore((s) => s.setSearchModalOpen);

  const [query,    setQuery]    = useState("");
  const [category, setCategory] = useState("all");
  const [loading,  setLoading]  = useState(false);
  const [results,  setResults]  = useState<Record<string, unknown>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setCategory("all");
  }

  const runSearch = useCallback(async (q: string, cat: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search/app?q=${encodeURIComponent(q)}&category=${cat}`);
      const json = await res.json();
      setResults(Array.isArray(json.items) ? json.items : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-[15%] z-50 w-full max-w-2xl -translate-x-1/2 rounded-[32px] border border-white/10 bg-black/80 p-1 shadow-2xl backdrop-blur"
        style={{ boxShadow: "0 0 60px rgba(90,196,255,0.12), 0 24px 60px rgba(0,0,0,0.7)" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-white/5 px-4 py-3">
          <Search className="size-4 shrink-0 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); runSearch(e.target.value, category); }}
            placeholder="Flows, Integrationen, Dateien, Runs durchsuchen…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[var(--muted-foreground)] sm:inline-flex">
              ESC
            </kbd>
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-[var(--muted-foreground)] transition hover:bg-white/10 hover:text-white"
              aria-label="Schließen"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setCategory(cat.id); runSearch(query, cat.id); }}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition"
                style={{
                  background: active ? "rgba(90,196,255,0.12)" : "rgba(255,255,255,0.04)",
                  borderColor: active ? "rgba(90,196,255,0.3)" : "rgba(255,255,255,0.08)",
                  color: active ? "var(--accent)" : "var(--muted-foreground)",
                }}
              >
                <Icon className="size-3" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div className="mt-2 max-h-[400px] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-10 text-sm text-[var(--muted-foreground)]">
              <div
                className="size-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
              />
              Suche läuft…
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              Keine Ergebnisse für „{query}"
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-1">
              {results.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-[18px] px-3 py-2.5 transition hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {String(item.title ?? item.name ?? "–")}
                    </p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {String(item.description ?? item.summary ?? "")}
                    </p>
                  </div>
                  {item.type != null && (
                    <span className="shrink-0 rounded-full border border-[rgba(90,196,255,0.2)] bg-[rgba(90,196,255,0.08)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                      {String(item.type)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {!query && (
            <div className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              <Search className="mx-auto mb-3 size-8 opacity-20" />
              Suchbegriff eingeben…
            </div>
          )}
        </div>
      </div>
    </>
  );
}

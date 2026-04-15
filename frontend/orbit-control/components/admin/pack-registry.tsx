"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, RefreshCw, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

type RegistryPack = {
  id: string;
  name: string;
  version: string;
  description: string;
  category?: string;
  author?: string;
  installed?: boolean;
};

const DEMO_PACKS: RegistryPack[] = [
  { id: "retail-pack", name: "Retail Pack", version: "1.2.0", description: "E-Commerce Integrationen und Flows", category: "Commerce", author: "KI-OS Team", installed: true },
  { id: "analytics-pack", name: "Analytics Pack", version: "2.0.1", description: "BI-Dashboards und Datenexporte", category: "Analytics", author: "KI-OS Team", installed: false },
  { id: "compliance-pack", name: "Compliance Pack", version: "1.0.4", description: "DSGVO, Audit-Logs und Reports", category: "Governance", author: "KI-OS Team", installed: true },
  { id: "ai-pack", name: "AI/ML Pack", version: "3.1.0", description: "LLM-Integrationen und Prompt-Management", category: "AI", author: "KI-OS Team", installed: false },
];

const categoryColors: Record<string, string> = {
  Commerce: "text-amber-300 border-amber-500/20 bg-amber-500/8",
  Analytics: "text-purple-300 border-purple-500/20 bg-purple-500/8",
  Governance: "text-emerald-300 border-emerald-500/20 bg-emerald-500/8",
  AI: "text-[var(--accent)] border-[rgba(90,196,255,0.2)] bg-[rgba(90,196,255,0.06)]",
};

export function PackRegistry() {
  const [packs, setPacks] = useState<RegistryPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/packs/registry", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: RegistryPack[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.packs)
          ? data.packs
          : [];
      setPacks(list.length ? list : DEMO_PACKS);
    } catch {
      setPacks(DEMO_PACKS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = filter
    ? packs.filter(
        (p) =>
          p.name.toLowerCase().includes(filter.toLowerCase()) ||
          p.category?.toLowerCase().includes(filter.toLowerCase()) ||
          p.description.toLowerCase().includes(filter.toLowerCase()),
      )
    : packs;

  return (
    <div className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Pack Registry</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Alle verfügbaren Packs im Überblick.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:border-[rgba(90,196,255,0.3)] hover:bg-[rgba(90,196,255,0.08)] disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Aktualisieren
        </button>
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Packs filtern…"
        className="mt-4 w-full rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-[var(--muted-foreground)] focus:border-[rgba(90,196,255,0.4)] transition"
      />

      <div className="mt-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="size-4 animate-spin" />
            Registry laden…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
            Keine Packs gefunden.
          </div>
        ) : (
          filtered.map((pack) => (
            <div
              key={pack.id}
              className="flex flex-wrap items-start gap-3 rounded-[20px] border border-white/10 bg-white/4 p-4"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(90,196,255,0.1)] text-[var(--accent)]">
                <Package className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{pack.name}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">
                    v{pack.version}
                  </span>
                  {pack.category && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                        categoryColors[pack.category] ??
                          "text-[var(--muted-foreground)] border-white/10 bg-white/5",
                      )}
                    >
                      <Tag className="size-2.5" />
                      {pack.category}
                    </span>
                  )}
                  {pack.installed && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                      Installiert
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {pack.description}
                </p>
                {pack.author && (
                  <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                    Von {pack.author}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

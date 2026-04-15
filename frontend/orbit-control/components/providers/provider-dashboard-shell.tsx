"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, RefreshCw, Zap, XCircle, Clock,
  GitBranch, Search, ChevronDown, ExternalLink,
  Cpu, DollarSign, BookOpen,
} from "lucide-react";

const DIRECT_PROVIDERS = [
  {
    id: "openai", name: "OpenAI", color: "#10a37f",
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    models: [
      { id: "openai/gpt-5.4",       label: "GPT-5.4",          tier: "flagship"  },
      { id: "openai/gpt-5.4-pro",   label: "GPT-5.4 Pro",      tier: "flagship"  },
      { id: "openai/gpt-5.4-mini",  label: "GPT-5.4 Mini",     tier: "standard"  },
      { id: "openai/gpt-5.4-nano",  label: "GPT-5.4 Nano",     tier: "fast"      },
      { id: "openai/gpt-5.3-chat",  label: "GPT-5.3 Chat",     tier: "standard"  },
      { id: "openai/gpt-5.3-codex", label: "GPT-5.3 Codex",    tier: "reasoning" },
      { id: "openai/gpt-5.2-pro",   label: "GPT-5.2 Pro",      tier: "standard"  },
    ],
  },
  {
    id: "anthropic", name: "Anthropic", color: "#d97706",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    models: [
      { id: "anthropic/claude-opus-4.6",   label: "Claude Opus 4.6",   tier: "flagship"  },
      { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", tier: "standard"  },
      { id: "anthropic/claude-opus-4.5",   label: "Claude Opus 4.5",   tier: "flagship"  },
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", tier: "standard"  },
      { id: "anthropic/claude-haiku-4.5",  label: "Claude Haiku 4.5",  tier: "fast"      },
      { id: "anthropic/claude-3.7-sonnet", label: "Claude 3.7 Sonnet", tier: "standard"  },
    ],
  },
  {
    id: "google", name: "Google Gemini", color: "#4285f4",
    badge: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    models: [
      { id: "google/gemini-3.1-pro-preview",        label: "Gemini 3.1 Pro",        tier: "flagship" },
      { id: "google/gemini-3.1-flash-lite-preview",  label: "Gemini 3.1 Flash Lite", tier: "fast"     },
      { id: "google/gemini-3-pro-preview",           label: "Gemini 3 Pro",          tier: "flagship" },
      { id: "google/gemini-3-flash-preview",         label: "Gemini 3 Flash",        tier: "fast"     },
      { id: "google/gemini-2.5-flash",               label: "Gemini 2.5 Flash",      tier: "standard" },
      { id: "google/gemini-2.5-flash-lite",          label: "Gemini 2.5 Flash Lite", tier: "fast"     },
    ],
  },
  {
    id: "deepseek", name: "DeepSeek", color: "#a78bfa",
    badge: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    models: [
      { id: "deepseek/deepseek-v3.2",      label: "DeepSeek V3.2",      tier: "flagship"  },
      { id: "deepseek/deepseek-v3.2-exp",  label: "DeepSeek V3.2 Exp",  tier: "standard"  },
      { id: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1",      tier: "standard"  },
      { id: "deepseek/deepseek-r1-0528",   label: "DeepSeek R1 0528",   tier: "reasoning" },
      { id: "deepseek/deepseek-r1",        label: "DeepSeek R1",        tier: "reasoning" },
    ],
  },
  {
    id: "x-ai", name: "xAI Grok", color: "#e5e7eb",
    badge: "bg-white/8 text-white/80 border-white/15",
    models: [
      { id: "x-ai/grok-4",           label: "Grok 4",          tier: "flagship"  },
      { id: "x-ai/grok-4-fast",      label: "Grok 4 Fast",     tier: "fast"      },
      { id: "x-ai/grok-4.20-beta",   label: "Grok 4.20 Beta",  tier: "flagship"  },
      { id: "x-ai/grok-4.1-fast",    label: "Grok 4.1 Fast",   tier: "fast"      },
      { id: "x-ai/grok-3",           label: "Grok 3",          tier: "standard"  },
      { id: "x-ai/grok-3-mini",      label: "Grok 3 Mini",     tier: "fast"      },
    ],
  },
  {
    id: "mistralai", name: "Mistral AI", color: "#f97316",
    badge: "bg-orange-500/10 text-orange-300 border-orange-500/20",
    models: [
      { id: "mistralai/mistral-large-2512",  label: "Mistral Large 3",   tier: "flagship"  },
      { id: "mistralai/mistral-medium-3.1",  label: "Mistral Medium 3.1",tier: "standard"  },
      { id: "mistralai/mistral-small-2603",  label: "Mistral Small 4",   tier: "fast"      },
      { id: "mistralai/devstral-2512",       label: "Devstral 2",        tier: "reasoning" },
      { id: "mistralai/codestral-2508",      label: "Codestral 2508",    tier: "reasoning" },
      { id: "mistralai/devstral-small",      label: "Devstral Small",    tier: "fast"      },
    ],
  },
  {
    id: "minimax", name: "MiniMax", color: "#ec4899",
    badge: "bg-pink-500/10 text-pink-300 border-pink-500/20",
    models: [
      { id: "minimax/minimax-m2.7",      label: "MiniMax M2.7",     tier: "flagship"  },
      { id: "minimax/minimax-m2.5",      label: "MiniMax M2.5",     tier: "standard"  },
      { id: "minimax/minimax-m2-her",    label: "MiniMax M2 Her",   tier: "standard"  },
      { id: "minimax/minimax-m2.5:free", label: "MiniMax M2.5 Free",tier: "fast"      },
    ],
  },
];

const TIER_STYLE: Record<string, string> = {
  flagship:  "bg-[rgba(90,196,255,0.12)] text-[var(--accent)] border-[rgba(90,196,255,0.25)]",
  standard:  "bg-white/6 text-white/70 border-white/10",
  fast:      "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  reasoning: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

type Provider = typeof DIRECT_PROVIDERS[0];

function DirectProviderCard({ p, active, latency, selected, onSelect }: {
  p: Provider; active: boolean; latency: string;
  selected: string | null; onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={[
        "glass-card p-4 transition-all cursor-pointer select-none",
        active    ? "border-[rgba(90,196,255,0.35)]" : "",
        selected === p.id ? "ring-1 ring-[rgba(90,196,255,0.4)]" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-full" style={{
            background: active ? "#22c55e" : "#64748b",
            boxShadow:  active ? "0 0 8px #22c55e" : "none",
          }} />
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {active && <span className="pill-cyan text-[10px]">Aktiv</span>}
          <button
            className={`text-[10px] px-2 py-0.5 rounded-full border transition ${p.badge}`}
            onClick={(e) => { e.stopPropagation(); onSelect(selected === p.id ? "" : p.id); }}
          >
            {selected === p.id ? "Aktiv ✓" : "Wählen"}
          </button>
          <ChevronDown
            className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--muted-foreground)" }}
          />
        </div>
      </div>
      <div className="space-y-1">
        {(expanded ? p.models : p.models.slice(0, 3)).map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-xs py-0.5">
            <span className="size-1.5 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="font-mono flex-1" style={{ color: "var(--muted-foreground)" }}>{m.id}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${TIER_STYLE[m.tier] ?? TIER_STYLE.standard}`}>
              {m.tier}
            </span>
          </div>
        ))}
        {!expanded && p.models.length > 3 && (
          <p className="text-[10px] pl-3.5" style={{ color: "var(--accent)" }}>+{p.models.length - 3} weitere…</p>
        )}
      </div>
      {active && latency !== "—" && (
        <div className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <Clock className="size-3" /><span>Latenz: {latency}ms</span>
        </div>
      )}
    </div>
  );
}

// ── OpenRouter live model panel ───────────────────────────────────────────────
type OModel = { id: string; name: string; description: string; context: number; provider: string; pricing?: Record<string, unknown>; };

function OpenRouterPanel() {
  const [models,  setModels]  = useState<OModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [query,   setQuery]   = useState("");
  const [prov,    setProv]    = useState("all");
  const [loaded,  setLoaded]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/providers/openrouter");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setModels(j.models ?? []); setLoaded(true);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }, []);

  const provList = ["all", ...Array.from(new Set(models.map((m) => m.provider))).sort()];
  const ql = query.toLowerCase();
  const filtered = models.filter((m) =>
    (ql === "" || m.name.toLowerCase().includes(ql) || m.id.toLowerCase().includes(ql)) &&
    (prov === "all" || m.provider === prov)
  );
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>OpenRouter — Modell-Katalog</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {loaded ? `${models.length} Modelle verfügbar · ${filtered.length} Treffer` : "Live-Abfrage von openrouter.ai"}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition"
          style={{ background: "rgba(90,196,255,0.10)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}>
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          {loaded ? "Aktualisieren" : "Modelle laden"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-xs text-red-300">
          Fehler: {error} — Optional: OPENROUTER_API_KEY in .env.local setzen
        </div>
      )}

      {!loaded && !loading && !error && (
        <div className="py-8 text-center" style={{ color: "var(--muted-foreground)" }}>
          <ExternalLink className="mx-auto size-8 mb-3 opacity-20" />
          <p className="text-xs"><b style={{ color: "var(--foreground)" }}>Modelle laden</b> — ruft openrouter.ai/api/v1/models ab.</p>
          <p className="text-[10px] mt-1 opacity-60">Kein API-Key nötig · mit Key werden mehr Modelle angezeigt</p>
        </div>
      )}

      {loaded && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--muted-foreground)" }} />
              <input
                type="text" placeholder="Modell oder ID suchen…" value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/4 pl-9 pr-3 py-2 text-xs"
                style={{ color: "var(--foreground)" }}
              />
            </div>
            <select value={prov} onChange={(e) => setProv(e.target.value)}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs"
              style={{ color: "var(--foreground)", background: "rgba(5,8,22,0.95)" }}>
              {provList.slice(0, 40).map((pr) => (
                <option key={pr} value={pr} style={{ background: "#0d1117" }}>
                  {pr === "all" ? `Alle Provider (${models.length})` : pr}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1">
            {filtered.slice(0, 120).map((m) => (
              <div key={m.id}
                className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 px-3 py-2 text-xs hover:bg-white/5 transition">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate" style={{ color: "var(--foreground)" }}>{m.name}</p>
                  <p className="font-mono text-[10px] truncate mt-0.5" style={{ color: "var(--accent)" }}>{m.id}</p>
                  {m.description && (
                    <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "var(--muted-foreground)" }}>{m.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 border border-white/10">{m.provider}</span>
                  {m.context > 0 && (
                    <div className="flex items-center gap-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>
                      <BookOpen className="size-2.5" />{fmt(m.context)} tok
                    </div>
                  )}
                  {m.pricing?.prompt != null && (
                    <div className="flex items-center gap-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>
                      <DollarSign className="size-2.5" />
                      {Number(m.pricing.prompt) === 0 ? "Free" : `$${Number(m.pricing.prompt).toFixed(6)}/t`}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filtered.length > 120 && (
              <p className="text-center text-[10px] py-2" style={{ color: "var(--muted-foreground)" }}>
                … {filtered.length - 120} weitere — Suche verfeinern
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Decision card ─────────────────────────────────────────────────────────────
function DecisionCard({ d, i }: { d: Record<string, unknown>; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-card p-3 text-xs animate-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-mono text-[11px]" style={{ color: "var(--accent)" }}>
          {String(d.runId ?? d.id ?? `dec-${i}`).slice(0, 22)}…
        </span>
        <span className="pill-cyan shrink-0">{String(d.model ?? d.provider ?? "—")}</span>
      </div>
      {d.reason != null && (
        <p className="mb-1.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{String(d.reason).slice(0, 120)}</p>
      )}
      <button className="text-[10px] hover:opacity-80 transition" style={{ color: "var(--accent)" }}
        onClick={() => setOpen(!open)}>{open ? "Weniger" : "Details"}</button>
      {open && (
        <pre className="mt-2 text-[10px] font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto"
          style={{ color: "var(--foreground)", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px" }}>
          {JSON.stringify(d, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────
type Tab = "direct" | "openrouter" | "routing";

export function ProviderDashboardShell({ live, decisions, models, scorecards }: {
  live?:       Record<string, unknown> | null;
  decisions?:  Record<string, unknown> | null;
  models?:     Record<string, unknown> | null;
  scorecards?: Record<string, unknown> | null;
}) {
  const [data,     setData]     = useState({ live, decisions, models, scorecards });
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<Tab>("direct");
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/providers"); setData(await r.json()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const id = setInterval(refresh, 30_000); return () => clearInterval(id); }, [refresh]);

  const routing  = (data.live as Record<string, unknown>)?.routing as Record<string, unknown> | null ?? null;
  const decItems = Array.isArray((data.decisions as Record<string, unknown>)?.items)
    ? (data.decisions as Record<string, unknown[]>).items as Record<string, unknown>[]
    : [];
  const fallback = Array.isArray(routing?.fallbackChain)
    ? routing.fallbackChain as string[]
    : ["openai/gpt-5.4", "anthropic/claude-sonnet-4.6", "google/gemini-3.1-pro-preview", "deepseek/deepseek-v3.2", "x-ai/grok-4", "mistralai/mistral-large-2512", "minimax/minimax-m2.7"];

  const TABS: { id: Tab; label: string }[] = [
    { id: "direct",     label: "Direkte Provider" },
    { id: "openrouter", label: "OpenRouter" },
    { id: "routing",    label: "Routing & Fallback" },
  ];

  return (
    <div className="space-y-4">
      {/* Header + Tabs */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <GitBranch className="size-5" style={{ color: "var(--accent)" }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Provider &amp; Modelle</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                OpenAI · Anthropic · Google · DeepSeek · OpenRouter
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selected && (
              <span className="pill-cyan text-xs flex items-center gap-1.5">
                <Cpu className="size-3" />
                {DIRECT_PROVIDERS.find((p) => p.id === selected)?.name ?? selected}
              </span>
            )}
            <button onClick={refresh} disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition"
              style={{ background: "rgba(90,196,255,0.10)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
        {routing && (
          <div className="mt-3 flex flex-wrap gap-2">
            {routing.model    != null && <span className="pill-cyan">Modell: {String(routing.model)}</span>}
            {routing.provider != null && <span className="pill-cyan">Provider: {String(routing.provider)}</span>}
          </div>
        )}
        {/* Tab bar */}
        <div className="mt-5 flex gap-1 border-b border-white/8">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-all border-b-2 ${
                tab === t.id
                  ? "border-[var(--accent)] text-[var(--accent)] bg-white/4"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-white"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab: Direct Providers */}
      {tab === "direct" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DIRECT_PROVIDERS.map((p) => {
              const rp = String(routing?.provider ?? "").toLowerCase();
              const active  = rp.includes(p.id);
              const latency = active ? String((routing as Record<string, unknown>)?.latency ?? "—") : "—";
              return (
                <DirectProviderCard key={p.id} p={p} active={active} latency={latency}
                  selected={selected} onSelect={setSelected} />
              );
            })}
          </div>
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>
              Tier-Legende
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TIER_STYLE).map(([tier, cls]) => (
                <span key={tier} className={`text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>{tier}</span>
              ))}
            </div>
            <p className="mt-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              <b style={{ color: "var(--foreground)" }}>flagship</b> – Bestes Modell des Anbieters ·{" "}
              <b style={{ color: "var(--foreground)" }}>reasoning</b> – Optimiert für Denkketten ·{" "}
              <b style={{ color: "var(--foreground)" }}>fast</b> – Niedrige Latenz, günstig
            </p>
          </div>
        </div>
      )}

      {/* Tab: OpenRouter */}
      {tab === "openrouter" && (
        <div className="space-y-4">
          <div className="glass-card p-4" style={{ borderColor: "rgba(245,158,11,0.2)" }}>
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="size-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-300">OpenRouter — Unified Gateway</h3>
            </div>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              200+ Modelle aller großen Anbieter über eine einzige API.
              Ideal für Fallback-Routing, Kostenoptimierung und Modell-Vergleiche.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["openai/*", "google/*", "anthropic/*", "meta-llama/*", "mistralai/*", "cohere/*", "deepseek/*", "+200 weitere"].map((tag, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border bg-white/6 border-white/10 text-white/60">{tag}</span>
              ))}
            </div>
          </div>
          <OpenRouterPanel />
        </div>
      )}

      {/* Tab: Routing & Fallback */}
      {tab === "routing" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          {/* Decision feed */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: "var(--muted-foreground)" }}>
              Routing-Entscheidungen ({decItems.length})
            </h2>
            {decItems.length === 0 ? (
              <div className="glass-card p-6 text-center" style={{ color: "var(--muted-foreground)" }}>
                <Zap className="mx-auto size-8 mb-2 opacity-20" />
                <p className="text-xs">Noch keine Entscheidungen — starte einen Run.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[580px] overflow-y-auto">
                {decItems.slice(0, 20).map((d, i) => <DecisionCard key={i} d={d} i={i} />)}
              </div>
            )}
          </div>

          {/* Sidebar: fallback + weights + status */}
          <div className="space-y-4">
            {/* Fallback chain */}
            <div className="glass-card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--muted-foreground)" }}>
                Fallback-Kaskade
              </h2>
              <div className="space-y-2">
                {fallback.map((model, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="size-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: i === 0 ? "rgba(90,196,255,0.15)" : "rgba(255,255,255,0.06)",
                        color: i === 0 ? "var(--accent)" : "var(--muted-foreground)",
                        border: `1px solid ${i === 0 ? "rgba(90,196,255,0.30)" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {i + 1}
                    </div>
                    <span className="text-xs font-mono flex-1"
                      style={{ color: i === 0 ? "var(--foreground)" : "var(--muted-foreground)" }}>
                      {model}
                    </span>
                    {i === 0
                      ? <CheckCircle className="size-3.5 text-emerald-400" />
                      : <XCircle className="size-3.5 opacity-25" style={{ color: "var(--muted-foreground)" }} />
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Router weights */}
            <div className="glass-card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--muted-foreground)" }}>
                Router Gewichte
              </h2>
              {DIRECT_PROVIDERS.map((p, i) => {
                const w = [28, 20, 18, 12, 10, 8, 4][i];
                return (
                  <div key={p.id} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: "var(--muted-foreground)" }}>{p.name}</span>
                      <span style={{ color: "var(--foreground)" }}>{w}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${w}%`, background: p.color, opacity: 0.8 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live status */}
            <div className="glass-card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>
                Provider Status
              </h2>
              <div className="space-y-2">
                {DIRECT_PROVIDERS.map((p) => {
                  const active = String(routing?.provider ?? "").toLowerCase().includes(p.id.split("/")[0]);
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <div className="size-2 rounded-full"
                        style={{ background: active ? "#22c55e" : "#64748b", boxShadow: active ? "0 0 6px #22c55e" : "none" }} />
                      <span style={{ color: "var(--foreground)" }}>{p.name}</span>
                      <span className="ml-auto" style={{ color: "var(--muted-foreground)" }}>{active ? "Online" : "Standby"}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 text-xs border-t border-white/8 pt-2 mt-1">
                  <div className="size-2 rounded-full" style={{ background: "#f59e0b" }} />
                  <span style={{ color: "var(--foreground)" }}>OpenRouter</span>
                  <span className="ml-auto" style={{ color: "var(--muted-foreground)" }}>Gateway</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

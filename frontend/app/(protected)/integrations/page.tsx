"use client";

import { useState, useEffect } from "react";
import {
  PlugZap, Plus, RefreshCw, Loader2, AlertTriangle,
  CheckCircle, XCircle, Zap, ExternalLink, Search
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

interface Connector {
  id: string;
  name: string;
  protocol: string;
  active: boolean;
  capabilities: string[];
  health: "healthy" | "degraded" | "offline" | "unknown";
  trustLevel: string;
  metadata: { category?: string; owner?: string };
  registeredAt: string;
}

// ── Health Badge ───────────────────────────────────────────────────────────

function HealthDot({ health }: { health: string }) {
  const map: Record<string, string> = {
    healthy:  "bg-green-400",
    degraded: "bg-yellow-400",
    offline:  "bg-red-400",
    unknown:  "bg-gray-500",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${map[health] ?? map.unknown}`} />;
}

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    healthy:  { cls: "bg-green-500/10  border-green-500/30  text-green-400",  label: "Healthy"  },
    degraded: { cls: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400", label: "Degraded" },
    offline:  { cls: "bg-red-500/10    border-red-500/30    text-red-400",    label: "Offline"  },
    unknown:  { cls: "bg-gray-500/10   border-gray-500/30   text-gray-400",   label: "Unknown"  },
  };
  const { cls, label } = map[health] ?? map.unknown;
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${cls}`}>{label}</span>;
}

// ── Category Color ─────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  memory:        "text-purple-400",
  connectors:    "text-[#5ac4ff]",
  files:         "text-blue-400",
  research:      "text-teal-400",
  erp:           "text-orange-400",
  crm:           "text-pink-400",
  ecommerce:     "text-yellow-400",
  communication: "text-green-400",
  storage:       "text-cyan-400",
  marketing:     "text-rose-400",
  custom:        "text-gray-400",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [query, setQuery]           = useState("");
  const [filterHealth, setFilterHealth] = useState<string>("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/connectors/registry");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Fehler");
      const list = Array.isArray(data) ? data : (data?.connectors ?? []);
      setConnectors(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = connectors.filter(c => {
    const q = query.toLowerCase();
    const matchesQ = !q || c.id.includes(q) || c.name.toLowerCase().includes(q) ||
      c.capabilities.some(cap => cap.includes(q)) ||
      (c.metadata.category ?? "").includes(q);
    const matchesH = filterHealth === "all" || c.health === filterHealth;
    return matchesQ && matchesH;
  });

  const stats = {
    total:   connectors.length,
    healthy: connectors.filter(c => c.health === "healthy").length,
    offline: connectors.filter(c => c.health === "offline" || c.health === "degraded").length,
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PlugZap className="text-[#5ac4ff]" size={26} />
            <div>
              <h1 className="text-xl font-bold">Integrations Hub</h1>
              <p className="text-sm text-gray-400">Connector Galaxy — alle registrierten Konnektoren</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-40">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <Link href="/integrations/connections/new"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors">
              <Plus size={14} /> Neuer Connector
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Connectors",    value: stats.total,   icon: PlugZap,       color: "text-[#5ac4ff]" },
            { label: "Healthy",       value: stats.healthy, icon: CheckCircle,   color: "text-green-400" },
            { label: "Probleme",      value: stats.offline, icon: XCircle,       color: "text-red-400"   },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 flex items-center gap-3">
              <Icon size={18} className={color} />
              <div>
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="flex gap-3">
          <Link href="/integrations/webhooks"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-300 hover:text-white transition-colors">
            <Zap size={14} className="text-[#5ac4ff]" /> Webhook Studio
          </Link>
          <Link href="/governance"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-300 hover:text-white transition-colors">
            <ExternalLink size={14} className="text-[#5ac4ff]" /> Governance Studio
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Connector suchen..."
              className="w-full bg-[#0d1117] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5ac4ff]/50 transition-colors"
            />
          </div>
          {["all", "healthy", "degraded", "offline"].map(h => (
            <button
              key={h}
              onClick={() => setFilterHealth(h)}
              className={`px-3 py-2 rounded-xl border text-xs transition-colors ${filterHealth === h ? "bg-[#5ac4ff]/10 border-[#5ac4ff]/30 text-[#5ac4ff]" : "border-white/10 text-gray-400 hover:text-white"}`}
            >
              {h === "all" ? "Alle" : h.charAt(0).toUpperCase() + h.slice(1)}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-[#5ac4ff]" size={24} />
          </div>
        )}

        {/* Connector Grid */}
        {!loading && (
          <>
            {filtered.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <PlugZap className="mx-auto text-gray-600" size={32} />
                <p className="text-sm text-gray-500">
                  {query || filterHealth !== "all" ? "Keine Connectors gefunden" : "Keine Connectors registriert"}
                </p>
                <Link href="/integrations/connections/new" className="text-sm text-[#5ac4ff] hover:underline">
                  + Ersten Connector registrieren
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filtered.map(c => {
                  const category = c.metadata?.category ?? "custom";
                  const catColor = CATEGORY_COLOR[category] ?? "text-gray-400";
                  return (
                    <Link
                      key={c.id}
                      href={`/integrations/${c.id}`}
                      className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07] transition-colors group"
                    >
                      {/* Health dot */}
                      <HealthDot health={c.health} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white group-hover:text-[#5ac4ff] transition-colors">{c.name}</span>
                          <span className={`text-xs ${catColor}`}>{category}</span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{c.id}</div>
                        {c.capabilities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {c.capabilities.slice(0, 5).map(cap => (
                              <span key={cap} className="px-1.5 py-0.5 rounded text-xs bg-white/5 border border-white/10 text-gray-400">{cap}</span>
                            ))}
                            {c.capabilities.length > 5 && (
                              <span className="px-1.5 py-0.5 rounded text-xs text-gray-500">+{c.capabilities.length - 5}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right side */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <HealthBadge health={c.health} />
                        <span className="text-xs text-gray-500">{c.protocol}</span>
                        <span className="text-xs text-gray-600">{c.trustLevel}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            {filtered.length > 0 && (
              <p className="text-xs text-gray-600 text-center">{filtered.length} von {connectors.length} Connectors</p>
            )}
          </>
        )}

      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, RefreshCw, Loader2, TrendingUp, TrendingDown,
  Minus, AlertTriangle, CheckCircle, BarChart2, Package,
  Store, Zap, Briefcase, Play, ArrowUpRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type KpiEntry = { value: number; trend: "up" | "down" | "flat"; unit: string };
type KpiPayload  = { kpis: Record<string, KpiEntry>; scorecard: string[] };
type OpsIncident = { id: string; severity: "high" | "medium" | "low"; title: string; storeCluster: string; owner: string };
type OpsPayload  = { incidents: OpsIncident[]; actions: string[] };
type Workflow    = { workflowId: string; status: string; owner: string };
type MktPayload  = { workflows: Workflow[] };
type PromoResult = {
  basePrice: number; promoPrice: number; cost: number;
  marginBefore: number; marginAfter: number;
  decision: "approved" | "review"; actions: string[];
};
type ExecDecision = { decisions: string[]; summary: { revenue: number; marginRate: number; riskLevel: string; recommendedMode: string } };

type Tab = "kpis" | "ops" | "marketplace" | "promo" | "executive";

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function eur(v: number) { return v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }); }

function TrendIcon({ t }: { t: string }) {
  if (t === "up")   return <TrendingUp  size={13} className="text-green-400" />;
  if (t === "down") return <TrendingDown size={13} className="text-red-400" />;
  return <Minus size={13} className="text-gray-500" />;
}

function SeverityBadge({ s }: { s: string }) {
  const cfg = {
    high:   "bg-red-500/10 border-red-500/30 text-red-400",
    medium: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    low:    "bg-gray-500/10 border-gray-600 text-gray-400",
  }[s] ?? "bg-gray-500/10 border-gray-600 text-gray-400";
  return <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${cfg}`}>{s}</span>;
}

function StatusBadge({ s }: { s: string }) {
  const cfg = {
    active:   "bg-green-500/10 border-green-500/30 text-green-400",
    pilot:    "bg-blue-500/10 border-blue-500/30 text-blue-400",
    inactive: "bg-gray-500/10 border-gray-600 text-gray-400",
  }[s] ?? "bg-gray-500/10 border-gray-600 text-gray-400";
  return <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${cfg}`}>{s}</span>;
}

const KPI_LABELS: Record<string, string> = {
  revenue:         "Umsatz",
  marginRate:      "Marge",
  outOfStockRate:  "Out-of-Stock",
  conversionRate:  "Conversion",
  adCostRatio:     "Werbekosten",
};

function formatKpiValue(key: string, entry: KpiEntry) {
  if (entry.unit === "EUR") return eur(entry.value);
  if (entry.unit === "ratio") return pct(entry.value);
  return String(entry.value);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function RetailSolutionPage() {
  const [tab, setTab]           = useState<Tab>("kpis");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [kpis,        setKpis]        = useState<KpiPayload | null>(null);
  const [ops,         setOps]         = useState<OpsPayload | null>(null);
  const [marketplace, setMarketplace] = useState<MktPayload | null>(null);
  const [promo,       setPromo]       = useState<PromoResult | null>(null);
  const [executive,   setExecutive]   = useState<ExecDecision | null>(null);

  // Promo-Rechner
  const [basePrice,  setBasePrice]  = useState("99");
  const [promoPrice, setPromoPrice] = useState("89");
  const [cost,       setCost]       = useState("61");
  const [calcLoading, setCalcLoading] = useState(false);

  const load = useCallback(async (section: Tab) => {
    setLoading(true);
    setError(null);
    try {
      if (section === "kpis" && !kpis) {
        const r = await fetch("/api/retail/kpis");
        setKpis(await r.json());
      }
      if (section === "ops" && !ops) {
        const r = await fetch("/api/retail/ops");
        setOps(await r.json());
      }
      if (section === "marketplace" && !marketplace) {
        const r = await fetch("/api/retail/marketplace");
        setMarketplace(await r.json());
      }
      if (section === "promo" && !promo) {
        const r = await fetch("/api/retail/promo-pricing");
        setPromo(await r.json());
      }
      if (section === "executive" && !executive) {
        const r = await fetch("/api/retail/executive");
        setExecutive(await r.json());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ladefehler");
    } finally {
      setLoading(false);
    }
  }, [kpis, ops, marketplace, promo, executive]);

  useEffect(() => { load(tab); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function calcPromo() {
    setCalcLoading(true);
    try {
      const r = await fetch(`/api/retail/promo-pricing?basePrice=${basePrice}&promoPrice=${promoPrice}&cost=${cost}`);
      setPromo(await r.json());
    } finally {
      setCalcLoading(false);
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "kpis",        label: "KPIs",        icon: BarChart2   },
    { id: "ops",         label: "Operations",  icon: AlertTriangle },
    { id: "marketplace", label: "Marketplace", icon: Store       },
    { id: "promo",       label: "Promo / Preis",icon: Zap        },
    { id: "executive",   label: "Executive",   icon: Briefcase   },
  ];

  const inputCls = "w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5ac4ff]/50 transition-colors";

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="text-[#5ac4ff]" size={28} />
            <div>
              <h1 className="text-2xl font-bold">Retail & E-Commerce</h1>
              <p className="text-sm text-gray-400">KI-OS Retail Solution — Ops, KPIs, Marketplace, Promo, Executive</p>
            </div>
          </div>
          <button onClick={() => load(tab)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  tab === t.id ? "bg-[#5ac4ff]/20 text-[#5ac4ff] border border-[#5ac4ff]/30" : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-gray-400 text-sm">
            <Loader2 className="animate-spin" size={20} /> Lade Daten...
          </div>
        ) : (
          <>

            {/* ── KPIs ──────────────────────────────────────────── */}
            {tab === "kpis" && kpis && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {kpis.scorecard.map(key => {
                  const entry = kpis.kpis[key];
                  if (!entry) return null;
                  return (
                    <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-400">{KPI_LABELS[key] ?? key}</span>
                        <TrendIcon t={entry.trend} />
                      </div>
                      <div className="text-2xl font-bold text-white">{formatKpiValue(key, entry)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Ops ───────────────────────────────────────────── */}
            {tab === "ops" && ops && (
              <div className="space-y-4">
                <div className="space-y-2">
                  {ops.incidents.map(inc => (
                    <div key={inc.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <AlertTriangle size={15} className={
                            inc.severity === "high" ? "text-red-400" : inc.severity === "medium" ? "text-yellow-400" : "text-gray-400"
                          } />
                          <div>
                            <div className="text-sm font-medium text-white">{inc.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Cluster: {inc.storeCluster} · Owner: {inc.owner}</div>
                          </div>
                        </div>
                        <SeverityBadge s={inc.severity} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-gray-400 mb-3 font-medium">Verfügbare Aktionen</div>
                  <div className="flex flex-wrap gap-2">
                    {ops.actions.map(a => (
                      <button key={a} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5ac4ff]/10 border border-[#5ac4ff]/20 text-[#5ac4ff] text-xs hover:bg-[#5ac4ff]/20 transition-colors">
                        <Play size={10} />
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Marketplace ───────────────────────────────────── */}
            {tab === "marketplace" && marketplace && (
              <div className="space-y-3">
                {marketplace.workflows.map(w => (
                  <div key={w.workflowId} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package size={15} className="text-[#5ac4ff]" />
                        <div>
                          <div className="text-sm font-medium">{w.workflowId}</div>
                          <div className="text-xs text-gray-500">Owner: {w.owner}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge s={w.status} />
                        <button className="p-1.5 rounded-lg text-gray-500 hover:text-[#5ac4ff] transition-colors">
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Promo / Preis ─────────────────────────────────── */}
            {tab === "promo" && (
              <div className="grid grid-cols-2 gap-5">
                {/* Rechner */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <div className="text-sm font-medium text-gray-300">Margenkalkulation</div>
                  {[
                    { label: "Regulärpreis (€)", value: basePrice, set: setBasePrice },
                    { label: "Aktionspreis (€)", value: promoPrice, set: setPromoPrice },
                    { label: "Einkaufspreis (€)", value: cost,     set: setCost      },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={e => set(e.target.value)}
                        className={inputCls}
                        step="0.01"
                        min="0"
                      />
                    </div>
                  ))}
                  <button
                    onClick={calcPromo}
                    disabled={calcLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
                  >
                    {calcLoading ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                    Berechnen
                  </button>
                </div>

                {/* Ergebnis */}
                {promo && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                    <div className="text-sm font-medium text-gray-300">Ergebnis</div>
                    <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${
                      promo.decision === "approved"
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                    }`}>
                      {promo.decision === "approved" ? "✓ Aktion genehmigt" : "⚠ Überprüfung empfohlen"}
                    </div>
                    <div className="space-y-2 text-sm">
                      {[
                        { label: "Marge vorher", value: pct(promo.marginBefore) },
                        { label: "Marge nachher", value: pct(promo.marginAfter) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-gray-400">{label}</span>
                          <span className="text-white font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-2">Empfohlene Aktionen</div>
                      <div className="flex flex-wrap gap-2">
                        {promo.actions.map(a => (
                          <span key={a} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300">{a}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Executive ─────────────────────────────────────── */}
            {tab === "executive" && executive && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Umsatz",     value: eur(executive.summary.revenue)                   },
                    { label: "Marge",      value: pct(executive.summary.marginRate)                 },
                    { label: "Risiko",     value: executive.summary.riskLevel                       },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                      <div className="text-xl font-bold text-white">{value}</div>
                      <div className="text-xs text-gray-400 mt-1">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={15} className="text-[#5ac4ff]" />
                    <span className="text-sm font-medium text-gray-300">Empfohlener Modus: <span className="text-[#5ac4ff]">{executive.summary.recommendedMode}</span></span>
                  </div>
                  <div className="space-y-2">
                    {executive.decisions.map((d, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <CheckCircle size={14} className="text-[#5ac4ff] mt-0.5 shrink-0" />
                        <span className="text-gray-200">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}

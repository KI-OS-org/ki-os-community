"use client";

import { useState, useEffect, useTransition } from "react";
import {
  TrendingUp, Zap, AlertCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, Lightbulb, Target, Shield,
  ArrowUpRight, Play, CheckCircle2, BarChart3, Cpu
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureSuggestion {
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  effort: string;
  category: string;
  rationale: string;
  inspired_by?: string;
}

interface QuickWin {
  title: string;
  description: string;
  effort: string;
  impact: "HIGH" | "MEDIUM";
}

interface CompetitorHighlight {
  competitor: string;
  feature: string;
  relevance: string;
  source?: string;
}

interface UpdateRecommendation {
  package: string;
  current: string;
  latest: string;
  urgency: "critical" | "recommended" | "optional";
  reason: string;
}

interface TechDebt {
  area: string;
  description: string;
  risk: "high" | "medium" | "low";
}

interface EfficiencyReport {
  id: string;
  generatedAt: string;
  source?: string;
  durationMs?: number;
  executiveSummary: string;
  trendInsights?: string;
  featureSuggestions: FeatureSuggestion[];
  quickWins: QuickWin[];
  competitorHighlights: CompetitorHighlight[];
  updateRecommendations: UpdateRecommendation[];
  technicalDebt: TechDebt[];
}

interface AgentStatus {
  state: string;
  running: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  currentStep: string | null;
  reportCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function priorityStyle(p: string) {
  switch (p) {
    case "HIGH":   return { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", color: "#f87171" };
    case "MEDIUM": return { bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.3)",  color: "#eab308" };
    default:       return { bg: "rgba(90,196,255,0.08)", border: "rgba(90,196,255,0.2)", color: "#5ac4ff" };
  }
}

function urgencyStyle(u: string) {
  switch (u) {
    case "critical":    return { color: "#f87171", label: "Kritisch" };
    case "recommended": return { color: "#eab308", label: "Empfohlen" };
    default:            return { color: "#5ac4ff", label: "Optional" };
  }
}

function categoryIcon(cat: string) {
  switch (cat) {
    case "security":     return <Shield className="size-3.5" />;
    case "performance":  return <Zap className="size-3.5" />;
    case "integration":  return <ArrowUpRight className="size-3.5" />;
    case "ux":           return <Target className="size-3.5" />;
    default:             return <Lightbulb className="size-3.5" />;
  }
}

// ── Subkomponenten ────────────────────────────────────────────────────────────

function StatusBar({ status, onTrigger, triggering }: {
  status: AgentStatus | null;
  onTrigger: () => void;
  triggering: boolean;
}) {
  const isRunning = status?.running;
  const step = status?.currentStep;

  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="size-5" style={{ color: "var(--accent)" }} />
            <span className="font-semibold text-[var(--foreground)]">Efficiency Agent</span>
          </div>

          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={isRunning
              ? { background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)", color: "#eab308" }
              : { background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}
          >
            {isRunning ? `Läuft… (${step || "analysiere"})` : "Bereit"}
          </span>

          {status?.reportCount !== undefined && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {status.reportCount} Report{status.reportCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
          {status?.lastRunAt && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> Letzter Lauf: {fmtDate(status.lastRunAt)}
            </span>
          )}
          {status?.nextRunAt && !isRunning && (
            <span className="flex items-center gap-1">
              <RefreshCw className="size-3" /> Nächster: {fmtDate(status.nextRunAt)}
            </span>
          )}

          <button
            onClick={onTrigger}
            disabled={triggering || isRunning}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
            style={{
              background: "rgba(90,196,255,0.12)",
              border: "1px solid rgba(90,196,255,0.25)",
              color: "var(--accent)",
            }}
          >
            <Play className="size-3" />
            {triggering || isRunning ? "Läuft…" : "Jetzt analysieren"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCards({ report }: { report: EfficiencyReport }) {
  const highCount  = report.featureSuggestions?.filter(f => f.priority === "HIGH").length || 0;
  const winsCount  = report.quickWins?.length || 0;
  const compCount  = report.competitorHighlights?.length || 0;
  const critDeps   = report.updateRecommendations?.filter(u => u.urgency === "critical").length || 0;

  const cards = [
    { label: "HIGH Prio Features",    value: highCount, color: "#f87171", icon: <TrendingUp className="size-4" /> },
    { label: "Quick Wins",            value: winsCount, color: "#22c55e", icon: <Zap className="size-4" /> },
    { label: "Wettbewerber-Highlights", value: compCount, color: "#5ac4ff", icon: <BarChart3 className="size-4" /> },
    { label: "Kritische Updates",     value: critDeps,  color: critDeps > 0 ? "#f87171" : "#22c55e", icon: <Shield className="size-4" /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(c => (
        <div
          key={c.label}
          className="glass-card p-4 text-center"
          style={{ border: `1px solid ${c.color}22` }}
        >
          <div className="flex justify-center mb-1" style={{ color: c.color }}>{c.icon}</div>
          <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

function FeatureList({ features }: { features: FeatureSuggestion[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = [...features].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="size-5" style={{ color: "var(--accent)" }} />
        <h3 className="font-semibold text-[var(--foreground)]">Feature-Vorschläge</h3>
        <span className="pill-cyan">{features.length}</span>
      </div>

      <div className="space-y-2">
        {sorted.map((f, i) => {
          const ps  = priorityStyle(f.priority);
          const key = `${i}-${f.title}`;
          const open = expanded === key;
          return (
            <div
              key={key}
              className="rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpanded(open ? null : key)}
              >
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ background: ps.bg, border: `1px solid ${ps.border}`, color: ps.color }}
                >
                  {f.priority}
                </span>
                <span className="flex-1 text-sm font-medium text-[var(--foreground)]">{f.title}</span>
                <span
                  className="flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-xs"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}
                >
                  {categoryIcon(f.category)} {f.category}
                </span>
                <span className="text-xs text-[var(--muted-foreground)] shrink-0">{f.effort}</span>
                {open ? <ChevronUp className="size-4 shrink-0 text-[var(--muted-foreground)]" /> : <ChevronDown className="size-4 shrink-0 text-[var(--muted-foreground)]" />}
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-2 border-t border-white/5">
                  <p className="text-sm text-[var(--foreground)] mt-3">{f.description}</p>
                  {f.rationale && (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      <span className="font-medium text-[var(--foreground)]">Begründung:</span> {f.rationale}
                    </p>
                  )}
                  {f.inspired_by && (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      <span className="font-medium text-[var(--foreground)]">Inspiriert von:</span> {f.inspired_by}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickWinList({ wins }: { wins: QuickWin[] }) {
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="size-5" style={{ color: "#22c55e" }} />
        <h3 className="font-semibold text-[var(--foreground)]">Quick Wins</h3>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}
        >
          {wins.length}
        </span>
      </div>
      <div className="space-y-2">
        {wins.map((w, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)" }}
          >
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" style={{ color: "#22c55e" }} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">{w.title}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{w.description}</p>
              <div className="flex gap-2 mt-1.5">
                <span className="text-xs text-[var(--muted-foreground)]">⏱ {w.effort}</span>
                <span className="text-xs" style={{ color: w.impact === "HIGH" ? "#22c55e" : "#eab308" }}>
                  Impact: {w.impact}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitorPanel({ highlights }: { highlights: CompetitorHighlight[] }) {
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="size-5" style={{ color: "var(--accent)" }} />
        <h3 className="font-semibold text-[var(--foreground)]">Wettbewerber-Highlights</h3>
      </div>
      <div className="space-y-2">
        {highlights.map((c, i) => (
          <div
            key={i}
            className="rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: "rgba(90,196,255,0.12)", border: "1px solid rgba(90,196,255,0.22)", color: "#5ac4ff" }}
              >
                {c.competitor}
              </span>
              {c.source && (
                <a href={c.source} target="_blank" rel="noreferrer" className="text-xs text-[var(--muted-foreground)] hover:text-[var(--accent)] flex items-center gap-0.5">
                  Quelle <ArrowUpRight className="size-3" />
                </a>
              )}
            </div>
            <p className="text-sm font-medium text-[var(--foreground)]">{c.feature}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{c.relevance}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpdatesPanel({ updates }: { updates: UpdateRecommendation[] }) {
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="size-5" style={{ color: "#eab308" }} />
        <h3 className="font-semibold text-[var(--foreground)]">Dependency-Updates</h3>
      </div>
      <div className="space-y-2">
        {updates.map((u, i) => {
          const us = urgencyStyle(u.urgency);
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <span className="shrink-0 text-xs font-semibold mt-0.5" style={{ color: us.color }}>
                {us.label}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--foreground)]">{u.package}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {u.current} → <span style={{ color: us.color }}>{u.latest}</span>
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{u.reason}</p>
              </div>
            </div>
          );
        })}
        {updates.length === 0 && (
          <p className="text-sm text-center text-[var(--muted-foreground)] py-4">
            Alle Abhängigkeiten aktuell ✓
          </p>
        )}
      </div>
    </div>
  );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────

export default function EfficiencyPage() {
  const [reports, setReports]   = useState<EfficiencyReport[]>([]);
  const [status, setStatus]     = useState<AgentStatus | null>(null);
  const [selected, setSelected] = useState<EfficiencyReport | null>(null);
  const [loading, setLoading]   = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchAll = async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        fetch("/api/efficiency"),
        fetch("/api/efficiency/status"),
      ]);
      const rData = await rRes.json().catch(() => ({}));
      const sData = await sRes.json().catch(() => ({}));

      const list = rData.reports || [];
      setReports(list);
      setStatus(sData);
      if (!selected && list.length > 0) setSelected(list[0]);
    } catch {/* ignore */} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  const trigger = () => {
    startTransition(async () => {
      try {
        await fetch("/api/efficiency/trigger", { method: "POST" });
        setTimeout(fetchAll, 3000);
      } catch {/* ignore */}
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="size-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <TrendingUp className="size-6" style={{ color: "var(--accent)" }} />
          Efficiency &amp; Intelligence
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Wöchentliche KI-Analyse: Wettbewerber, Feature-Vorschläge, Quick Wins — automatisch für den Admin
        </p>
      </div>

      {/* Status Bar */}
      <StatusBar status={status} onTrigger={trigger} triggering={isPending} />

      {/* Kein Report vorhanden */}
      {reports.length === 0 && (
        <div className="glass-card p-12 text-center space-y-4">
          <TrendingUp className="size-12 mx-auto" style={{ color: "var(--accent)", opacity: 0.4 }} />
          <p className="text-[var(--foreground)] font-medium">Noch kein Report vorhanden</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Klicke auf „Jetzt analysieren" um den ersten Report zu starten.<br />
            Danach läuft der Agent wöchentlich automatisch.
          </p>
        </div>
      )}

      {/* Report-Inhalt */}
      {selected && (
        <>
          {/* Report-Selektor falls mehrere */}
          {reports.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              {reports.slice(0, 8).map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="rounded-lg px-3 py-1.5 text-xs transition-colors"
                  style={selected.id === r.id
                    ? { background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.35)", color: "var(--accent)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--muted-foreground)" }}
                >
                  {fmtDate(r.generatedAt)}
                  {r.source === "manual" || r.source === "api" ? " ✦" : ""}
                </button>
              ))}
            </div>
          )}

          {/* Executive Summary */}
          <div
            className="glass-card p-5"
            style={{ borderLeft: "3px solid var(--accent)" }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
              Executive Summary — {fmtDate(selected.generatedAt)}
            </p>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              {selected.executiveSummary}
            </p>
          </div>

          {/* KPI-Karten */}
          <SummaryCards report={selected} />

          {/* 2-Spalten Layout */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Links: Feature Suggestions */}
            {(selected.featureSuggestions?.length ?? 0) > 0 && (
              <FeatureList features={selected.featureSuggestions} />
            )}

            {/* Rechts: Quick Wins + Competitors */}
            <div className="space-y-4">
              {(selected.quickWins?.length ?? 0) > 0 && (
                <QuickWinList wins={selected.quickWins} />
              )}
              {(selected.competitorHighlights?.length ?? 0) > 0 && (
                <CompetitorPanel highlights={selected.competitorHighlights} />
              )}
            </div>
          </div>

          {/* Updates + Tech Debt */}
          <div className="grid gap-4 lg:grid-cols-2">
            {(selected.updateRecommendations?.length ?? 0) > 0 && (
              <UpdatesPanel updates={selected.updateRecommendations} />
            )}

            {(selected.technicalDebt?.length ?? 0) > 0 && (
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="size-5" style={{ color: "#f87171" }} />
                  <h3 className="font-semibold text-[var(--foreground)]">Technische Schulden</h3>
                </div>
                <div className="space-y-2">
                  {selected.technicalDebt.map((d, i) => (
                    <div key={i} className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--foreground)]">{d.area}</span>
                        <span className="text-xs" style={{ color: d.risk === "high" ? "#f87171" : d.risk === "medium" ? "#eab308" : "#5ac4ff" }}>
                          Risiko: {d.risk}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">{d.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trend Insights */}
          {selected.trendInsights && (
            <div className="glass-card p-5" style={{ borderLeft: "3px solid #7c3aed" }}>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                📈 Trend-Einblicke
              </p>
              <p className="text-sm leading-relaxed text-[var(--foreground)]">{selected.trendInsights}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

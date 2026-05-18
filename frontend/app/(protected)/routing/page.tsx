"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoutingScorecard {
  provider: string;
  model?: string;
  successRate?: number;
  successRatePercent?: number;
  latencyP50Ms?: number;
  latencyP95Ms?: number;
  errorRate?: number;
  errorRatePercent?: number;
  totalRequests?: number;
  lastTestedAt?: string | null;
  [key: string]: unknown;
}

interface RoutingProfile {
  id?: string;
  name?: string;
  strategy?: string;
  providers?: string[];
  fallbackEnabled?: boolean;
  [key: string]: unknown;
}

interface RoutingDecision {
  id?: string;
  requestId?: string;
  provider?: string;
  model?: string;
  reason?: string;
  latencyMs?: number;
  success?: boolean;
  timestamp?: string;
  createdAt?: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pct(val: number | undefined) {
  if (val === undefined || val === null) return "—";
  // handle both 0-1 and 0-100 scale
  const v = val > 1 ? val : val * 100;
  return `${v.toFixed(1)}%`;
}

function latencyColor(ms: number | undefined) {
  if (!ms) return "var(--muted-foreground)";
  if (ms < 500) return "#22c55e";
  if (ms < 1500) return "#eab308";
  return "#f87171";
}

function successColor(rate: number | undefined) {
  if (rate === undefined) return "var(--muted-foreground)";
  const v = rate > 1 ? rate : rate * 100;
  if (v >= 95) return "#22c55e";
  if (v >= 80) return "#eab308";
  return "#f87171";
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabId = "scorecards" | "profiles" | "decisions";

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "scorecards", label: "Scorecards", icon: <BarChart3 className="size-4" /> },
  { id: "profiles",   label: "Profiles",   icon: <GitBranch className="size-4" /> },
  { id: "decisions",  label: "Decisions",  icon: <Activity className="size-4" /> },
];

// ── ScorecardTable ────────────────────────────────────────────────────────────

function ScorecardTable({ cards }: { cards: RoutingScorecard[] }) {
  if (!cards.length) {
    return (
      <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">
        No scorecard data available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cards.map((card, i) => {
        const sr = card.successRate ?? card.successRatePercent;
        const er = card.errorRate ?? card.errorRatePercent;
        return (
          <div
            key={i}
            className="rounded-xl px-5 py-4"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Provider name */}
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {card.provider}
                </p>
                {card.model && (
                  <p className="text-xs text-[var(--muted-foreground)] font-mono">
                    {card.model}
                  </p>
                )}
              </div>

              {/* Metrics */}
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="text-center">
                  <p className="text-[var(--muted-foreground)] mb-0.5">Success</p>
                  <p className="font-semibold" style={{ color: successColor(sr) }}>
                    {pct(sr)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[var(--muted-foreground)] mb-0.5">Latency p50</p>
                  <p
                    className="font-semibold"
                    style={{ color: latencyColor(card.latencyP50Ms) }}
                  >
                    {card.latencyP50Ms ? `${card.latencyP50Ms}ms` : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[var(--muted-foreground)] mb-0.5">Latency p95</p>
                  <p
                    className="font-semibold"
                    style={{ color: latencyColor(card.latencyP95Ms) }}
                  >
                    {card.latencyP95Ms ? `${card.latencyP95Ms}ms` : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[var(--muted-foreground)] mb-0.5">Error Rate</p>
                  <p
                    className="font-semibold"
                    style={{ color: er && (er > 1 ? er : er * 100) > 5 ? "#f87171" : "#22c55e" }}
                  >
                    {pct(er)}
                  </p>
                </div>
                {card.totalRequests !== undefined && (
                  <div className="text-center">
                    <p className="text-[var(--muted-foreground)] mb-0.5">Requests</p>
                    <p className="font-semibold text-[var(--foreground)]">
                      {card.totalRequests}
                    </p>
                  </div>
                )}
              </div>

              {/* Last tested */}
              <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
                <Clock className="size-3" />
                {fmtDate(card.lastTestedAt as string | undefined)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ProfilesPanel ─────────────────────────────────────────────────────────────

function ProfilesPanel({ profiles }: { profiles: RoutingProfile[] }) {
  if (!profiles.length) {
    return (
      <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">
        No routing profiles configured.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {profiles.map((p, i) => (
        <div
          key={p.id ?? i}
          className="rounded-xl p-4 space-y-2"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {p.name ?? p.id ?? `Profile ${i + 1}`}
            </p>
            {p.strategy && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "rgba(90,196,255,0.1)",
                  border: "1px solid rgba(90,196,255,0.2)",
                  color: "#5ac4ff",
                }}
              >
                {p.strategy}
              </span>
            )}
          </div>

          {Array.isArray(p.providers) && p.providers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {p.providers.map((prov, j) => (
                <span
                  key={j}
                  className="rounded-full px-2 py-0.5 text-xs text-[var(--muted-foreground)]"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {prov}
                </span>
              ))}
            </div>
          )}

          {p.fallbackEnabled !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              {p.fallbackEnabled ? (
                <CheckCircle2 className="size-3" style={{ color: "#22c55e" }} />
              ) : (
                <AlertCircle className="size-3" style={{ color: "#71717a" }} />
              )}
              <span className="text-[var(--muted-foreground)]">
                Fallback {p.fallbackEnabled ? "enabled" : "disabled"}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── DecisionsTable ────────────────────────────────────────────────────────────

function DecisionsTable({ decisions }: { decisions: RoutingDecision[] }) {
  if (!decisions.length) {
    return (
      <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">
        No recent routing decisions.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {["Time", "Provider", "Model", "Latency", "Status", "Reason"].map((h) => (
              <th
                key={h}
                className="text-left px-4 py-2 font-medium text-[var(--muted-foreground)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {decisions.map((d, i) => (
            <tr
              key={d.id ?? d.requestId ?? i}
              className="transition-colors hover:bg-white/[0.02]"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                {fmtDate(d.timestamp ?? d.createdAt)}
              </td>
              <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">
                {d.provider ?? "—"}
              </td>
              <td className="px-4 py-2.5 font-mono text-[var(--muted-foreground)]">
                {d.model ?? "—"}
              </td>
              <td
                className="px-4 py-2.5 font-medium"
                style={{ color: latencyColor(d.latencyMs) }}
              >
                {d.latencyMs ? `${d.latencyMs}ms` : "—"}
              </td>
              <td className="px-4 py-2.5">
                {d.success ? (
                  <span style={{ color: "#22c55e" }}>OK</span>
                ) : (
                  <span style={{ color: "#f87171" }}>FAIL</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-[var(--muted-foreground)] max-w-[200px] truncate">
                {d.reason ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RoutingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("scorecards");
  const [scorecards, setScorecards] = useState<RoutingScorecard[]>([]);
  const [profiles, setProfiles] = useState<RoutingProfile[]>([]);
  const [decisions, setDecisions] = useState<RoutingDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scRes, prRes, dcRes] = await Promise.allSettled([
        fetch("/api/routing?path=scorecards&limit=50").then((r) => r.json()),
        fetch("/api/routing?path=profiles&limit=50").then((r) => r.json()),
        fetch("/api/routing?path=decisions&limit=50").then((r) => r.json()),
      ]);

      if (scRes.status === "fulfilled") {
        const d = scRes.value;
        setScorecards(
          Array.isArray(d?.scorecards)
            ? d.scorecards
            : Array.isArray(d?.items)
            ? d.items
            : Array.isArray(d)
            ? d
            : []
        );
      }
      if (prRes.status === "fulfilled") {
        const d = prRes.value;
        setProfiles(
          Array.isArray(d?.profiles)
            ? d.profiles
            : Array.isArray(d?.items)
            ? d.items
            : Array.isArray(d)
            ? d
            : []
        );
      }
      if (dcRes.status === "fulfilled") {
        const d = dcRes.value;
        setDecisions(
          Array.isArray(d?.items)
            ? d.items
            : Array.isArray(d?.decisions)
            ? d.decisions
            : Array.isArray(d)
            ? d
            : []
        );
      }
    } catch {
      setError("Failed to load routing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Zap className="size-6" style={{ color: "var(--accent)" }} />
            Routing Intelligence
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Provider scorecards, routing profiles and recent decision history
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-opacity hover:opacity-70"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--muted-foreground)",
          }}
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Scorecards",
            value: scorecards.length,
            color: "#5ac4ff",
            icon: <BarChart3 className="size-4" />,
          },
          {
            label: "Profiles",
            value: profiles.length,
            color: "#a855f7",
            icon: <GitBranch className="size-4" />,
          },
          {
            label: "Decisions",
            value: decisions.length,
            color: "#22c55e",
            icon: <Activity className="size-4" />,
          },
          {
            label: "Avg Success",
            value:
              scorecards.length > 0
                ? pct(
                    scorecards.reduce((acc, s) => {
                      const sr = s.successRate ?? s.successRatePercent ?? 0;
                      return acc + (sr > 1 ? sr / 100 : sr);
                    }, 0) / scorecards.length
                  )
                : "—",
            color: "#22c55e",
            icon: <ShieldCheck className="size-4" />,
          },
        ].map((c) => (
          <div
            key={c.label}
            className="glass-card p-4 text-center"
            style={{ border: `1px solid ${c.color}22` }}
          >
            <div className="flex justify-center mb-1" style={{ color: c.color }}>
              {c.icon}
            </div>
            <p className="text-2xl font-bold" style={{ color: c.color }}>
              {c.value}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div
          className="glass-card p-4 flex items-center gap-2 text-sm"
          style={{ borderLeft: "3px solid #f87171", color: "#f87171" }}
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="glass-card overflow-hidden">
        <div
          className="flex border-b"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors"
              style={
                activeTab === tab.id
                  ? {
                      color: "var(--accent)",
                      borderBottom: "2px solid var(--accent)",
                    }
                  : {
                      color: "var(--muted-foreground)",
                      borderBottom: "2px solid transparent",
                    }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "scorecards" && <ScorecardTable cards={scorecards} />}
          {activeTab === "profiles" && <ProfilesPanel profiles={profiles} />}
          {activeTab === "decisions" && <DecisionsTable decisions={decisions} />}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Activity, AlertTriangle, BarChart3, Clock, Database, DollarSign, GitBranch, RefreshCw } from "lucide-react";
import { Line, LineChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TraceRow = {
  trace_id: string;
  started_at: string;
  span_count: number;
  service: string;
  operations: string[];
  max_duration_ms: number;
  p95_duration_ms: number;
  error_count: number;
};

type LatencyPoint = { bucket: string; p50: number; p90: number; p99: number; count: number };
type CostRow = { provider: string; model: string; total_usd: number; calls: number };
type ErrorPoint = { bucket: string; total: number; errors: number; error_rate: number };

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

function fmtMs(value: number) {
  if (!Number.isFinite(value)) return "0 ms";
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

function fmtTime(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      headers: { "content-type": "application/json", "x-user-id": "orbit-control", "x-role": "admin" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default function AnalyticsPage() {
  const [isPending, startTransition] = useTransition();
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<"started_at" | "max_duration_ms" | "error_count">("started_at");
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [latency, setLatency] = useState<LatencyPoint[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [errors, setErrors] = useState<{ summary?: { error_rate: number; error_spans: number; total_spans: number }; timeline?: ErrorPoint[] }>({});
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);

  const load = () => {
    startTransition(async () => {
      const qs = new URLSearchParams({ limit: "50" });
      if (serviceFilter) qs.set("service", serviceFilter);
      if (statusFilter) qs.set("status", statusFilter);
      const [traceData, latencyData, costData, errorData] = await Promise.all([
        fetchJson<{ traces: TraceRow[] }>(`/api/analytics/traces?${qs}`),
        fetchJson<{ series: LatencyPoint[] }>("/api/analytics/latency?window=24%20HOUR"),
        fetchJson<{ costs: CostRow[] }>("/api/analytics/costs?window=24%20HOUR"),
        fetchJson<typeof errors>("/api/analytics/errors?window=24%20HOUR"),
      ]);
      setTraces(traceData?.traces || []);
      setLatency(latencyData?.series || []);
      setCosts(costData?.costs || []);
      setErrors(errorData || {});
    });
  };

  useEffect(() => {
    load();
  }, []);

  const sortedTraces = useMemo(() => {
    return [...traces].sort((a, b) => {
      if (sortKey === "started_at") return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
      return Number(b[sortKey] || 0) - Number(a[sortKey] || 0);
    });
  }, [traces, sortKey]);

  const totalCost = costs.reduce((sum, row) => sum + Number(row.total_usd || 0), 0);
  const p99 = latency.at(-1)?.p99 || 0;
  const errorRate = Number(errors.summary?.error_rate || 0);
  const chartLatency = latency.map((p) => ({ ...p, label: fmtTime(p.bucket) }));
  const chartErrors = (errors.timeline || []).map((p) => ({ ...p, label: fmtTime(p.bucket), rate: Number(p.error_rate || 0) * 100 }));
  const chartCosts = costs.map((c) => ({ name: c.provider || "unknown", cost: Number(c.total_usd || 0), calls: Number(c.calls || 0) }));

  return (
    <main className="space-y-6 p-6">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(90,196,255,0.18),transparent_38%),linear-gradient(135deg,rgba(5,12,22,0.96),rgba(7,22,31,0.88))] p-6 shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(90,196,255,0.24)] bg-[rgba(90,196,255,0.08)] px-3 py-1 text-xs text-[var(--accent)]">
              <Database className="size-3.5" /> ClickHouse Trace Analytics
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">Telemetry Flight Recorder</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              OTel-Spans, Kostenattribute und Fehlerpfade aus ClickHouse. Filtere Services, sortiere Traces und erkenne Latenz- oder Kosten-Ausreißer.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(90,196,255,0.25)] bg-[rgba(90,196,255,0.12)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:bg-[rgba(90,196,255,0.2)] disabled:opacity-60"
            disabled={isPending}
          >
            <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} /> Aktualisieren
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Traces", value: traces.length, icon: <GitBranch className="size-4" />, color: "#5ac4ff" },
          { label: "P99 Latenz", value: fmtMs(p99), icon: <Clock className="size-4" />, color: "#fb923c" },
          { label: "24h Kosten", value: `$${totalCost.toFixed(4)}`, icon: <DollarSign className="size-4" />, color: "#22c55e" },
          { label: "Error Rate", value: `${(errorRate * 100).toFixed(2)}%`, icon: <AlertTriangle className="size-4" />, color: errorRate > 0.05 ? "#f87171" : "#5ac4ff" },
        ].map((card) => (
          <div key={card.label} className="glass-card p-4" style={{ borderColor: `${card.color}33` }}>
            <div className="mb-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
              <span>{card.label}</span>
              <span style={{ color: card.color }}>{card.icon}</span>
            </div>
            <p className="text-2xl font-bold text-white" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="glass-card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="size-5 text-[var(--accent)]" />
            <h2 className="font-semibold text-white">Latency p50 / p90 / p99</h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartLatency}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" stroke="#708099" fontSize={11} />
                <YAxis stroke="#708099" fontSize={11} />
                <Tooltip contentStyle={{ background: "#07111f", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p90" stroke="#fb923c" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p99" stroke="#f87171" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="size-5 text-[var(--accent)]" />
            <h2 className="font-semibold text-white">Kosten nach Provider</h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartCosts}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="#708099" fontSize={11} />
                <YAxis stroke="#708099" fontSize={11} />
                <Tooltip contentStyle={{ background: "#07111f", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }} />
                <Bar dataKey="cost" fill="#22c55e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="glass-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-[var(--accent)]" />
              <h2 className="font-semibold text-white">Trace-Liste</h2>
              <span className="pill-cyan">{sortedTraces.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} placeholder="Service filter" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent)]" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent)]">
                <option value="">Alle Stati</option>
                <option value="OK">OK</option>
                <option value="ERROR">ERROR</option>
              </select>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent)]">
                <option value="started_at">Neueste</option>
                <option value="max_duration_ms">Latenz</option>
                <option value="error_count">Fehler</option>
              </select>
              <button onClick={load} className="rounded-xl border border-[rgba(90,196,255,0.24)] bg-[rgba(90,196,255,0.08)] px-3 py-2 text-xs text-[var(--accent)]">Anwenden</button>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {sortedTraces.map((trace) => (
              <button key={trace.trace_id} onClick={() => setSelectedTrace(trace.trace_id)} className="grid w-full gap-3 p-4 text-left transition hover:bg-white/[0.03] md:grid-cols-[1.1fr_0.8fr_0.6fr_0.5fr]">
                <div>
                  <p className="font-mono text-xs text-[var(--accent)]">{trace.trace_id}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{fmtTime(trace.started_at)} · {trace.span_count} Spans</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{trace.service || "unknown"}</p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">{(trace.operations || []).slice(0, 3).join(", ")}</p>
                </div>
                <p className="text-sm text-white">{fmtMs(Number(trace.max_duration_ms || 0))}</p>
                <span className={trace.error_count ? "text-sm font-semibold text-red-300" : "text-sm text-emerald-300"}>{trace.error_count ? `${trace.error_count} Fehler` : "OK"}</span>
              </button>
            ))}
            {!sortedTraces.length && <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">Keine ClickHouse-Traces gefunden oder Backend offline.</div>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="size-5 text-[var(--accent)]" />
              <h2 className="font-semibold text-white">Error-Rate</h2>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartErrors}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="label" stroke="#708099" fontSize={11} />
                  <YAxis stroke="#708099" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#07111f", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="rate" stroke="#f87171" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="mb-3 font-semibold text-white">Trace Drilldown</h2>
            {selectedTrace ? (
              <div className="space-y-2">
                <p className="break-all font-mono text-xs text-[var(--accent)]">{selectedTrace}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Endpoint: /api/analytics/traces/{selectedTrace}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">Wähle einen Trace aus der Liste, um die Trace-ID für den Detail-Endpunkt zu fixieren.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Cpu, RefreshCw, Play, CheckCircle2, AlertCircle, Zap } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface McpCapability {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  category?: string;
  version?: string;
}

interface McpHealth {
  status: string;
  version?: string;
  uptime?: number;
  tools?: number;
  latencyMs?: number;
  services?: { name: string; status: string }[];
}

interface InvokeResult {
  result?: unknown;
  error?: string;
  durationMs?: number;
  tool?: string;
}

type Tab = "capabilities" | "invoke" | "health";

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthColor(s: string) {
  if (s === "healthy" || s === "ok" || s === "up") return "#22c55e";
  if (s === "degraded") return "#eab308";
  return "#f87171";
}

function JsonPreview({ data }: { data: unknown }) {
  return (
    <pre
      className="text-xs font-mono leading-relaxed overflow-auto max-h-72 p-4 rounded-xl whitespace-pre-wrap break-all"
      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--foreground)" }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function CapabilitiesTab() {
  const [data, setData] = useState<McpCapability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mcp?section=capabilities")
      .then(r => r.json()).catch(() => [])
      .then(d => setData(Array.isArray(d) ? d : (d.capabilities ?? d.tools ?? [])))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="size-5 animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-[var(--muted-foreground)]">{data.length} Tool{data.length !== 1 ? "s" : ""} verfügbar</span>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-center text-[var(--muted-foreground)] py-8">Keine Capabilities verfügbar</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map(c => (
            <div key={c.name} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start gap-2">
                <Zap className="size-4 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] font-mono">{c.name}</p>
                  {c.description && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{c.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {c.category && (
                      <span className="text-xs rounded-full px-2 py-0.5" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                        {c.category}
                      </span>
                    )}
                    {c.version && (
                      <span className="text-xs text-[var(--muted-foreground)]">v{c.version}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InvokeTab() {
  const [capabilities, setCapabilities] = useState<McpCapability[]>([]);
  const [selected, setSelected] = useState("");
  const [params, setParams] = useState("{}");
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mcp?section=capabilities")
      .then(r => r.json()).catch(() => [])
      .then(d => {
        const list = Array.isArray(d) ? d : (d.capabilities ?? d.tools ?? []);
        setCapabilities(list);
        if (list.length > 0) setSelected(list[0].name);
      });
  }, []);

  const invoke = async () => {
    if (!selected) return;
    setLoading(true); setError(null); setResult(null);
    try {
      let parsedParams = {};
      try { parsedParams = JSON.parse(params); } catch { parsedParams = { raw: params }; }
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: selected, params: parsedParams }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Fehler");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Capability / Tool</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
        >
          {capabilities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          {capabilities.length === 0 && <option value="">— Lade Capabilities —</option>}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Parameter (JSON)</label>
        <textarea
          value={params}
          onChange={e => setParams(e.target.value)}
          rows={5}
          className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none font-mono"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
        />
      </div>

      <button
        onClick={invoke}
        disabled={loading || !selected}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
        style={{ background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.3)", color: "#5ac4ff" }}
      >
        {loading ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
        {loading ? "Invoking…" : "Invoke"}
      </button>

      {error && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <AlertCircle className="size-4 shrink-0" style={{ color: "#f87171" }} />
          <span style={{ color: "#f87171" }}>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4" style={{ color: "#22c55e" }} />
            <span className="text-sm font-medium text-[var(--foreground)]">Ergebnis</span>
            {result.durationMs != null && (
              <span className="text-xs text-[var(--muted-foreground)]">{result.durationMs}ms</span>
            )}
          </div>
          <JsonPreview data={result.result ?? result} />
        </div>
      )}
    </div>
  );
}

function HealthTab() {
  const [data, setData] = useState<McpHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/mcp?section=health")
      .then(r => r.json()).catch(() => null)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="size-5 animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className="rounded-xl p-4 flex flex-wrap items-center gap-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="size-3 rounded-full" style={{ background: data ? healthColor(data.status) : "#94a3b8" }} />
          <span className="text-sm font-semibold text-[var(--foreground)]">MCP Service</span>
          <span className="text-sm font-medium" style={{ color: data ? healthColor(data.status) : "#94a3b8" }}>
            {data?.status ?? "Unbekannt"}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
          {data?.version   && <span>Version: {data.version}</span>}
          {data?.uptime    != null && <span>Uptime: {data.uptime}s</span>}
          {data?.tools     != null && <span>{data.tools} Tools</span>}
          {data?.latencyMs != null && <span>{data.latencyMs}ms Latenz</span>}
        </div>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted-foreground)" }}
        >
          <RefreshCw className="size-3" /> Refresh
        </button>
      </div>

      {/* Services */}
      {(data?.services?.length ?? 0) > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {data!.services!.map(s => (
            <div key={s.name} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-sm text-[var(--foreground)]">{s.name}</span>
              <span className="text-xs font-medium" style={{ color: healthColor(s.status) }}>{s.status}</span>
            </div>
          ))}
        </div>
      )}

      {!data && (
        <p className="text-sm text-[var(--muted-foreground)] text-center py-8">Keine Health-Daten verfügbar</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "capabilities", label: "Capabilities", icon: <Zap className="size-4" /> },
  { id: "invoke",       label: "Invoke",        icon: <Play className="size-4" /> },
  { id: "health",       label: "Health",        icon: <CheckCircle2 className="size-4" /> },
];

export default function McpPage() {
  const [tab, setTab] = useState<Tab>("capabilities");

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <Cpu className="size-6" style={{ color: "var(--accent)" }} />
          MCP Invoke
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Model Context Protocol — Capabilities, Invoke und Health
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: "fit-content" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={tab === t.id
              ? { background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.3)", color: "#5ac4ff" }
              : { color: "var(--muted-foreground)" }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card p-5">
        {tab === "capabilities" && <CapabilitiesTab />}
        {tab === "invoke"       && <InvokeTab />}
        {tab === "health"       && <HealthTab />}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, RefreshCw, AlertTriangle, AlertCircle, CheckCircle2, Play, Layers, GitBranch, Clock } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Escalation {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  title: string;
  description?: string;
  createdAt?: string;
  agentId?: string;
}

interface Recovery {
  id: string;
  status: string;
  target?: string;
  strategy?: string;
  attempts?: number;
  startedAt?: string;
  resolvedAt?: string;
  steps?: { label: string; status: "done" | "active" | "pending" }[];
}

interface Playbook {
  id: string;
  name: string;
  description?: string;
  trigger?: string;
  steps?: number;
  lastRun?: string;
}

interface MeshStatus {
  status: string;
  nodes?: { id: string; role: string; health: string }[];
  activeSupervisors?: number;
  meshHealth?: string;
}

type Tab = "escalations" | "recoveries" | "playbooks" | "mesh";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function severityStyle(s: string) {
  switch (s) {
    case "critical": return { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", color: "#f87171" };
    case "high":     return { bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.3)",  color: "#eab308" };
    case "medium":   return { bg: "rgba(90,196,255,0.1)",  border: "rgba(90,196,255,0.25)", color: "#5ac4ff" };
    default:         return { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", color: "#94a3b8" };
  }
}

function healthColor(h: string) {
  if (h === "healthy" || h === "ok") return "#22c55e";
  if (h === "degraded") return "#eab308";
  return "#f87171";
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function EscalationsTab() {
  const [data, setData] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/supervisor?section=escalations");
      const d = await res.json().catch(() => []);
      setData(Array.isArray(d) ? d : (d.escalations ?? []));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string) => {
    setResolving(id);
    try {
      await fetch("/api/supervisor?action=resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ escalationId: id }),
      });
      await load();
    } finally { setResolving(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="size-5 animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <CheckCircle2 className="size-10 mx-auto" style={{ color: "#22c55e", opacity: 0.5 }} />
          <p className="text-sm text-[var(--muted-foreground)]">Keine aktiven Eskalationen</p>
        </div>
      ) : data.map(e => {
        const ss = severityStyle(e.severity);
        return (
          <div key={e.id} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}>
                  {e.severity?.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-[var(--foreground)]">{e.title}</span>
                <span className="text-xs rounded-full px-2 py-0.5" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}>
                  {e.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {e.createdAt && <span className="text-xs text-[var(--muted-foreground)]">{fmtDate(e.createdAt)}</span>}
                {e.status !== "resolved" && (
                  <button
                    onClick={() => resolve(e.id)}
                    disabled={resolving === e.id}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                    style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}
                  >
                    {resolving === e.id ? <RefreshCw className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                    Lösen
                  </button>
                )}
              </div>
            </div>
            {e.description && <p className="text-xs text-[var(--muted-foreground)] mt-2">{e.description}</p>}
            {e.agentId && <p className="text-xs text-[var(--muted-foreground)] mt-1">Agent: <code className="text-[var(--foreground)]">{e.agentId}</code></p>}
          </div>
        );
      })}
    </div>
  );
}

function RecoveriesTab() {
  const [data, setData] = useState<Recovery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/supervisor?section=recoveries")
      .then(r => r.json()).catch(() => [])
      .then(d => setData(Array.isArray(d) ? d : (d.recoveries ?? [])))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="size-5 animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] text-center py-12">Keine Recovery-Versuche</p>
      ) : data.map(r => (
        <div key={r.id} className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="size-4" style={{ color: "var(--accent)" }} />
            <span className="text-sm font-medium text-[var(--foreground)]">{r.target ?? r.id}</span>
            <span className="text-xs rounded-full px-2 py-0.5" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}>
              {r.status}
            </span>
            {r.strategy && (
              <span className="text-xs text-[var(--muted-foreground)]">Strategie: {r.strategy}</span>
            )}
            {r.attempts != null && (
              <span className="text-xs text-[var(--muted-foreground)]">Versuche: {r.attempts}</span>
            )}
          </div>

          {/* Timeline */}
          {(r.steps?.length ?? 0) > 0 && (
            <div className="ml-6 space-y-1.5">
              {r.steps!.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="size-2 rounded-full shrink-0"
                    style={{ background: step.status === "done" ? "#22c55e" : step.status === "active" ? "#5ac4ff" : "rgba(255,255,255,0.15)" }}
                  />
                  <span className="text-xs" style={{ color: step.status === "active" ? "#5ac4ff" : "var(--muted-foreground)" }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 text-xs text-[var(--muted-foreground)]">
            {r.startedAt  && <span>Start: {fmtDate(r.startedAt)}</span>}
            {r.resolvedAt && <span>Ende: {fmtDate(r.resolvedAt)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlaybooksTab() {
  const [data, setData] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggered, setTriggered] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/supervisor?section=playbooks")
      .then(r => r.json()).catch(() => [])
      .then(d => setData(Array.isArray(d) ? d : (d.playbooks ?? [])))
      .finally(() => setLoading(false));
  }, []);

  const trigger = async (id: string) => {
    setTriggering(id);
    try {
      await fetch("/api/supervisor?action=trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playbookId: id }),
      });
      setTriggered(id);
      setTimeout(() => setTriggered(null), 3000);
    } finally { setTriggering(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="size-5 animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] text-center py-12 sm:col-span-2">Keine Playbooks verfügbar</p>
      ) : data.map(p => (
        <div key={p.id} className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">{p.name}</p>
              {p.description && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{p.description}</p>}
            </div>
            <button
              onClick={() => trigger(p.id)}
              disabled={triggering === p.id}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shrink-0 transition-opacity disabled:opacity-50"
              style={triggered === p.id
                ? { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }
                : { background: "rgba(90,196,255,0.12)", border: "1px solid rgba(90,196,255,0.25)", color: "#5ac4ff" }}
            >
              {triggering === p.id ? <RefreshCw className="size-3 animate-spin" /> : triggered === p.id ? <CheckCircle2 className="size-3" /> : <Play className="size-3" />}
              {triggering === p.id ? "…" : triggered === p.id ? "Gestartet" : "Trigger"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
            {p.trigger && <span>Trigger: <span className="text-[var(--foreground)]">{p.trigger}</span></span>}
            {p.steps != null && <span>{p.steps} Schritte</span>}
            {p.lastRun && <span>Letzter Lauf: {fmtDate(p.lastRun)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MeshTab() {
  const [data, setData] = useState<MeshStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [recovered, setRecovered] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/supervisor?section=mesh");
      const d = await res.json().catch(() => ({}));
      setData(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const recover = async () => {
    setRecovering(true);
    try {
      await fetch("/api/supervisor?action=recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      setRecovered(true);
      setTimeout(() => { setRecovered(false); load(); }, 3000);
    } finally { setRecovering(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="size-5 animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <div className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <GitBranch className="size-5" style={{ color: "var(--accent)" }} />
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Mesh Supervisor</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Status: <span style={{ color: data?.meshHealth ? healthColor(data.meshHealth) : "#94a3b8" }}>{data?.status ?? "Unbekannt"}</span>
              {data?.activeSupervisors != null && ` · ${data.activeSupervisors} Supervisors aktiv`}
            </p>
          </div>
        </div>
        <button
          onClick={recover}
          disabled={recovering}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
          style={recovered
            ? { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }
            : { background: "rgba(90,196,255,0.12)", border: "1px solid rgba(90,196,255,0.25)", color: "#5ac4ff" }}
        >
          {recovering ? <RefreshCw className="size-4 animate-spin" /> : recovered ? <CheckCircle2 className="size-4" /> : <Play className="size-4" />}
          {recovering ? "Recovere…" : recovered ? "Gestartet" : "Mesh Recovery"}
        </button>
      </div>

      {/* Nodes */}
      {(data?.nodes?.length ?? 0) > 0 && (
        <div className="glass-card p-5">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Mesh-Knoten</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {data!.nodes!.map(n => (
              <div key={n.id} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div>
                  <p className="text-sm text-[var(--foreground)] font-mono text-xs">{n.id}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{n.role}</p>
                </div>
                <span className="text-xs font-medium" style={{ color: healthColor(n.health) }}>{n.health}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data && (
        <p className="text-sm text-[var(--muted-foreground)] text-center py-8">Keine Mesh-Daten verfügbar</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "escalations", label: "Escalations", icon: <AlertTriangle className="size-4" /> },
  { id: "recoveries",  label: "Recoveries",  icon: <RefreshCw className="size-4" /> },
  { id: "playbooks",   label: "Playbooks",   icon: <Layers className="size-4" /> },
  { id: "mesh",        label: "Mesh",        icon: <GitBranch className="size-4" /> },
];

export default function SupervisorPage() {
  const [tab, setTab] = useState<Tab>("escalations");
  const [globalError, setGlobalError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      await fetch("/api/supervisor?section=escalations");
    } catch {
      setGlobalError("Supervisor-API nicht erreichbar — bitte Backend prüfen");
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <ShieldCheck className="size-6" style={{ color: "var(--accent)" }} />
          Supervisor Recovery Cockpit
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Eskalationen, Recovery-Versuche, Playbooks und Mesh-Status
        </p>
      </div>

      {globalError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{globalError}</p>
          <button onClick={() => { setGlobalError(null); loadAll(); }} className="ml-auto text-xs text-red-300 underline">Wiederholen</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: "fit-content" }}>
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

      {/* Tab Content */}
      <div className="glass-card p-5">
        {tab === "escalations" && <EscalationsTab />}
        {tab === "recoveries"  && <RecoveriesTab />}
        {tab === "playbooks"   && <PlaybooksTab />}
        {tab === "mesh"        && <MeshTab />}
      </div>
    </div>
  );
}

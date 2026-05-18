"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, RefreshCw, Loader2, AlertTriangle, CheckCircle,
  XCircle, Clock, Play, BookOpen, GitBranch, ChevronRight, Eye,
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type Policy = {
  id:          string;
  tools:       string[];
  actions?:    string[];
  allowRoles:  string[];
  escalateRoles?: string[];
  effect:      "allow" | "deny" | "mixed";
  description: string;
};

type Approval = {
  approvalId:  string;
  status:      "PENDING" | "APPROVED" | "DENIED";
  tool:        string;
  action:      string | null;
  reason:      string;
  requestedBy: string;
  tenantId:    string;
  role:        string;
  createdAt:   string;
};

type Registry = {
  current:       string;
  activePolicies: Policy[];
  versions:      { name: string; current: boolean }[];
};

type Tab = "policies" | "simulate" | "approvals";

// ── Helpers ────────────────────────────────────────────────────────────────

const EFFECT_CFG = {
  allow: { label: "Erlaubt",   cls: "text-green-400  bg-green-500/10  border-green-500/30"  },
  deny:  { label: "Abgelehnt", cls: "text-red-400    bg-red-500/10    border-red-500/30"    },
  mixed: { label: "Gemischt",  cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
};

const APPROVAL_CFG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  PENDING:  { label: "Offen",       icon: Clock,        cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
  APPROVED: { label: "Genehmigt",   icon: CheckCircle,  cls: "text-green-400  bg-green-500/10  border-green-500/30"  },
  DENIED:   { label: "Abgelehnt",   icon: XCircle,      cls: "text-red-400    bg-red-500/10    border-red-500/30"    },
};

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${cls}`}>{text}</span>;
}

function RolePill({ role }: { role: string }) {
  return <span className="px-1.5 py-0.5 rounded text-xs bg-white/5 border border-white/10 text-gray-300">{role}</span>;
}

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return "gerade eben";
  if (d < 60) return `vor ${d} Min.`;
  const h = Math.floor(d / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tag(en)`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function GovernanceStudioPage() {
  const [tab, setTab]           = useState<Tab>("policies");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [registry,  setRegistry]  = useState<Registry | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  // Simulate form
  const [simTool,    setSimTool]    = useState("llm_invoke");
  const [simAction,  setSimAction]  = useState("invoke");
  const [simRole,    setSimRole]    = useState("operator");
  const [simText,    setSimText]    = useState("");
  const [simRunning, setSimRunning] = useState(false);
  const [simResult,  setSimResult]  = useState<Record<string, unknown> | null>(null);
  const [simError,   setSimError]   = useState<string | null>(null);

  const load = useCallback(async (section: Tab) => {
    setLoading(true);
    setError(null);
    try {
      if (section === "policies" && !registry) {
        const r = await fetch("/api/governance/registry");
        const d = await r.json();
        setRegistry(d);
      }
      if (section === "approvals") {
        const r = await fetch("/api/governance/approvals");
        const d = await r.json();
        setApprovals(Array.isArray(d?.approvals) ? d.approvals : []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ladefehler");
    } finally {
      setLoading(false);
    }
  }, [registry]);

  useEffect(() => { load(tab); }, [tab]); // eslint-disable-line

  async function runSimulation() {
    setSimRunning(true);
    setSimResult(null);
    setSimError(null);
    try {
      const res = await fetch("/api/governance/simulate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tool: simTool, action: simAction, ctx: { role: simRole }, text: simText }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error ?? "Simulationsfehler");
      setSimResult(d.simulation);
    } catch (e: unknown) {
      setSimError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSimRunning(false);
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "policies",  label: "Richtlinien",  icon: BookOpen   },
    { id: "simulate",  label: "Simulator",    icon: Play       },
    { id: "approvals", label: "Freigaben",    icon: GitBranch  },
  ];

  const inputCls = "w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5ac4ff]/50 transition-colors";
  const labelCls = "block text-xs text-gray-400 mb-1.5 font-medium";

  const pendingCount = approvals.filter(a => a.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[#5ac4ff]" size={28} />
            <div>
              <h1 className="text-2xl font-bold">Governance Studio</h1>
              <p className="text-sm text-gray-400">Richtlinien, Policy-Simulator und Freigabe-Queue</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/trust" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:text-white transition-colors">
              <Eye size={12} /> Trust Center
            </Link>
            <button onClick={() => load(tab)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={15} />
            </button>
          </div>
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
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-colors relative ${
                  tab === t.id ? "bg-[#5ac4ff]/20 text-[#5ac4ff] border border-[#5ac4ff]/30" : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon size={13} />
                {t.label}
                {t.id === "approvals" && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && tab !== "simulate" ? (
          <div className="flex items-center justify-center gap-3 py-16 text-gray-400 text-sm">
            <Loader2 className="animate-spin" size={20} /> Lade...
          </div>
        ) : (
          <>

            {/* ── Policies ──────────────────────────────────────── */}
            {tab === "policies" && registry && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Aktive Konfiguration: <span className="font-mono text-gray-300">{registry.current}</span></span>
                  <span>{registry.activePolicies?.length ?? 0} Richtlinien aktiv</span>
                </div>

                <div className="space-y-3">
                  {(registry.activePolicies ?? []).map(p => {
                    const eff = EFFECT_CFG[p.effect] ?? EFFECT_CFG.mixed;
                    return (
                      <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm text-[#5ac4ff]">{p.id}</span>
                              <Badge text={eff.label} cls={eff.cls} />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{p.description}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                          <div>
                            <span className="text-gray-500 block mb-1">Tools</span>
                            <div className="flex flex-wrap gap-1">
                              {p.tools.map(t => <RolePill key={t} role={t} />)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1">Erlaubte Rollen</span>
                            <div className="flex flex-wrap gap-1">
                              {p.allowRoles.map(r => <RolePill key={r} role={r} />)}
                              {p.escalateRoles?.map(r => (
                                <span key={r} className="px-1.5 py-0.5 rounded text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">{r} ↑</span>
                              ))}
                            </div>
                          </div>
                          {p.actions && (
                            <div>
                              <span className="text-gray-500 block mb-1">Aktionen</span>
                              <div className="flex flex-wrap gap-1">
                                {p.actions.map(a => <RolePill key={a} role={a} />)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Simulator ─────────────────────────────────────── */}
            {tab === "simulate" && (
              <div className="grid grid-cols-2 gap-5">
                {/* Form */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <div className="text-sm font-medium text-gray-300">Policy simulieren</div>

                  <div>
                    <label className={labelCls}>Tool</label>
                    <select value={simTool} onChange={e => setSimTool(e.target.value)} className={inputCls}>
                      {["llm_invoke","provider_call","desktop_action","desktop_screenshot","webhook_trigger","mcp_invoke","desktop_stop"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Aktion</label>
                    <input value={simAction} onChange={e => setSimAction(e.target.value)} placeholder="invoke" className={inputCls} />
                  </div>

                  <div>
                    <label className={labelCls}>Rolle</label>
                    <div className="flex flex-wrap gap-1.5">
                      {["admin","operator","viewer","auditor","user","guest"].map(r => (
                        <button
                          key={r}
                          onClick={() => setSimRole(r)}
                          className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                            simRole === r
                              ? "bg-[#5ac4ff]/15 border-[#5ac4ff]/40 text-[#5ac4ff]"
                              : "border-white/10 text-gray-400 hover:text-white"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Prompt / Text (optional — für PII-Erkennung)</label>
                    <textarea
                      value={simText}
                      onChange={e => setSimText(e.target.value)}
                      rows={3}
                      placeholder="z.B. Max Mustermann, max@example.com..."
                      className={inputCls + " resize-none"}
                    />
                  </div>

                  {simError && (
                    <div className="flex items-center gap-2 text-red-400 text-xs">
                      <AlertTriangle size={12} /> {simError}
                    </div>
                  )}

                  <button
                    onClick={runSimulation}
                    disabled={simRunning}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
                  >
                    {simRunning ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                    Simulieren
                  </button>
                </div>

                {/* Result */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <div className="text-sm font-medium text-gray-300">Ergebnis</div>

                  {!simResult && !simRunning && (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-600 text-sm">
                      <Play size={28} className="mb-3 opacity-30" />
                      Simulation starten um Ergebnis zu sehen
                    </div>
                  )}

                  {simRunning && (
                    <div className="flex items-center justify-center gap-2 py-10 text-[#5ac4ff]/70 text-sm">
                      <Loader2 className="animate-spin" size={16} /> Simuliere...
                    </div>
                  )}

                  {simResult && (() => {
                    const dec = simResult.decision as Record<string, unknown> | undefined;
                    const priv = simResult.privacy as Record<string, unknown> | undefined;
                    const decision = String(dec?.decision ?? "unknown");
                    const decCls = decision === "allow"
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : decision === "deny"
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
                    return (
                      <div className="space-y-3">
                        <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${decCls}`}>
                          Entscheidung: <span className="uppercase">{decision}</span>
                          {dec?.reason && <span className="block text-xs font-normal mt-0.5 opacity-80">{String(dec.reason)}</span>}
                        </div>

                        <div className="space-y-1.5 text-sm">
                          {[
                            { label: "Tool",    value: String(simResult.tool   ?? "—") },
                            { label: "Aktion",  value: String(simResult.action ?? "—") },
                            { label: "Rolle",   value: String(simResult.role   ?? "—") },
                            { label: "Policy",  value: String(dec?.policyId    ?? "—") },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between">
                              <span className="text-gray-500">{label}</span>
                              <span className="font-mono text-white text-xs">{value}</span>
                            </div>
                          ))}
                        </div>

                        {priv && Number(priv.piiCount) > 0 && (
                          <div className="mt-2 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs space-y-1">
                            <div className="text-yellow-400 font-medium">PII erkannt</div>
                            <div className="text-gray-400">{String(priv.piiCount)} Treffer — Typen: {String((priv.piiTypes as string[] | undefined)?.join(", ") ?? "—")}</div>
                            {priv.maskedPreview && (
                              <div className="font-mono text-gray-500 truncate">{String(priv.maskedPreview)}</div>
                            )}
                          </div>
                        )}

                        <div className="text-xs text-gray-600 italic">{String(simResult._note ?? "")}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── Approvals ─────────────────────────────────────── */}
            {tab === "approvals" && (
              <div className="space-y-3">
                {approvals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
                    <CheckCircle size={36} className="opacity-30" />
                    <div className="text-sm">Keine offenen Freigaben</div>
                  </div>
                ) : approvals.map(a => {
                  const cfg = APPROVAL_CFG[a.status] ?? APPROVAL_CFG.PENDING;
                  const Icon = cfg.icon;
                  return (
                    <div key={a.approvalId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${cfg.cls}`}>
                            <Icon size={13} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm text-white">{a.tool}</span>
                              {a.action && <span className="text-xs text-gray-500">→ {a.action}</span>}
                              <Badge text={cfg.label} cls={cfg.cls} />
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{a.reason}</div>
                            <div className="flex gap-3 text-xs text-gray-600 mt-1">
                              <span>Von: {a.requestedBy}</span>
                              <span>Rolle: {a.role}</span>
                              <span>Tenant: {a.tenantId}</span>
                              <span>{relTime(a.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-gray-600 shrink-0 mt-1" />
                      </div>
                      <div className="mt-2 text-xs font-mono text-gray-600">{a.approvalId}</div>
                    </div>
                  );
                })}
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}

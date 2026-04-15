"use client";

import { useState, useCallback, useEffect } from "react";
import {
  AlertTriangle, CheckCircle, ClipboardCopy, Download,
  FileText, Key, RefreshCw, Shield, ShieldCheck, XCircle,
} from "lucide-react";

type AuditItem   = Record<string, unknown>;
type PolicyItem  = Record<string, unknown>;
type ApprovalItem = Record<string, unknown>;

// ── Audit Log Table ────────────────────────────────────────────────────────────
function AuditLogTable({ items }: { items: AuditItem[] }) {
  const [filter, setFilter] = useState("");
  const filtered = filter
    ? items.filter((i) => JSON.stringify(i).toLowerCase().includes(filter.toLowerCase()))
    : items;

  function fmt(iso: string) {
    try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium" }); }
    catch { return iso; }
  }

  function copyCSV() {
    const rows = [["Timestamp", "Action", "User", "Status", "Details"]];
    filtered.forEach((i) => rows.push([
      String(i.timestamp ?? i.createdAt ?? ""),
      String(i.action ?? ""),
      String(i.userId ?? i.user ?? ""),
      String(i.status ?? ""),
      String(i.details ?? i.message ?? "").replace(/,/g, ";"),
    ]));
    navigator.clipboard.writeText(rows.map((r) => r.join(",")).join("\n")).catch(() => {});
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Audit-Events filtern…"
            className="w-full rounded-xl py-2 px-3 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>
        <button onClick={copyCSV} title="Als CSV kopieren"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition"
          style={{ background: "rgba(90,196,255,0.08)", border: "1px solid rgba(90,196,255,0.20)", color: "var(--accent)" }}>
          <ClipboardCopy className="size-3.5" /> CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--border)" }}>
        <table className="ki-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>User</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-sm" style={{ color: "var(--muted-foreground)" }}>
                Keine Audit-Events gefunden.
              </td></tr>
            )}
            {filtered.slice(0, 100).map((item, i) => {
              const status = String(item.status ?? "info").toLowerCase();
              const rowBorder = status === "error" || status === "warning"
                ? `border-l-2 border-${status === "error" ? "red" : "yellow"}-500/50`
                : "";
              return (
                <tr key={i} className={rowBorder}>
                  <td className="font-mono text-[11px] whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                    {fmt(String(item.timestamp ?? item.createdAt ?? ""))}
                  </td>
                  <td>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded-md"
                      style={{ background: "rgba(90,196,255,0.10)", color: "var(--accent)" }}>
                      {String(item.action ?? "—")}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: "var(--foreground)" }}>
                    {String(item.userId ?? item.user ?? "—")}
                  </td>
                  <td>
                    {status === "error"   && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle    className="size-3" />Fehler</span>}
                    {status === "warning" && <span className="flex items-center gap-1 text-xs text-yellow-400"><AlertTriangle className="size-3" />Warnung</span>}
                    {(status === "ok" || status === "info" || status === "success") &&
                      <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="size-3" />OK</span>}
                    {!["error","warning","ok","info","success"].includes(status) &&
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{status}</span>}
                  </td>
                  <td className="text-xs max-w-[260px] truncate" style={{ color: "var(--muted-foreground)" }}>
                    {String(item.details ?? item.message ?? item.description ?? "—")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-right" style={{ color: "var(--muted-foreground)" }}>
        {filtered.length} Einträge
      </p>
    </div>
  );
}

// ── Policy List ───────────────────────────────────────────────────────────────
function PolicyList({ items }: { items: PolicyItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!items.length) return <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>Keine Policies geladen.</p>;

  return (
    <div className="space-y-3">
      {items.map((p, i) => {
        const id     = String(p.id ?? p.policyId ?? `policy-${i}`);
        const status = String(p.status ?? "active").toLowerCase();
        const isOpen = openId === id;
        return (
          <div key={id} className="glass-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{String(p.name ?? id)}</p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>{id}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                status === "active"   ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                status === "draft"    ? "bg-yellow-500/10  text-yellow-400  border-yellow-500/20"  :
                                        "bg-gray-500/10    text-gray-400    border-gray-500/20"
              }`}>{status}</span>
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {p.residency   != null && <span>Residency: {String(p.residency)}</span>}
              {p.privacyLevel != null && <span>Privacy: {String(p.privacyLevel)}</span>}
              {p.budgetCents !== undefined && <span>Budget: {String(p.budgetCents)}¢</span>}
              {p.killSwitch  !== undefined && <span className={p.killSwitch ? "text-red-400" : "text-emerald-400"}>
                Kill-Switch: {p.killSwitch ? "aktiv" : "inaktiv"}
              </span>}
            </div>
            <button onClick={() => setOpenId(isOpen ? null : id)} className="mt-2 text-xs hover:opacity-80 transition"
              style={{ color: "var(--accent)" }}>
              {isOpen ? "Schließen" : "Details / JSON"}
            </button>
            {isOpen && (
              <pre className="mt-2 text-[10px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto rounded-xl p-3"
                style={{ background: "rgba(0,0,0,0.30)", color: "var(--foreground)" }}>
                {JSON.stringify(p, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Approvals Queue ───────────────────────────────────────────────────────────
function ApprovalQueue({ items }: { items: ApprovalItem[] }) {
  if (!items.length) return (
    <div className="text-center py-8" style={{ color: "var(--muted-foreground)" }}>
      <CheckCircle className="mx-auto size-8 mb-2 text-emerald-400 opacity-40" />
      <p className="text-sm">Keine ausstehenden Freigaben.</p>
    </div>
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({});

  async function handleAction(id: string, action: "approve" | "reject") {
    setBusy(id + action);
    try {
      const res = await fetch(`/api/trust/${action}/${id}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setFeedback(f => ({ ...f, [id]: { ok: res.ok, msg: res.ok ? (action === "approve" ? "Freigegeben" : "Abgelehnt") : (data.message ?? "Fehler") } }));
    } catch {
      setFeedback(f => ({ ...f, [id]: { ok: false, msg: "Netzwerkfehler" } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {items.map((a, i) => {
        const id   = String(a.id ?? a._id ?? i);
        const prio = String(a.priority ?? "normal").toLowerCase();
        const fb   = feedback[id];
        return (
          <div key={id} className="glass-card p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{String(a.title ?? a.action ?? `Approval ${i + 1}`)}</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                prio === "critical" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                prio === "high"     ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                                      "bg-blue-500/10 text-blue-400 border-blue-500/20"
              }`}>{prio}</span>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
              {String(a.requester ?? a.requestedBy ?? "—")} · {String(a.reason ?? "")}
            </p>
            {fb ? (
              <p className={`text-xs font-semibold ${fb.ok ? "text-green-400" : "text-red-400"}`}>{fb.msg}</p>
            ) : (
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                  style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}
                  disabled={busy !== null}
                  onClick={() => handleAction(id, "approve")}>
                  {busy === id + "approve" ? "…" : "Freigeben"}
                </button>
                <button className="px-3 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                  style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}
                  disabled={busy !== null}
                  onClick={() => handleAction(id, "reject")}>
                  {busy === id + "reject" ? "…" : "Ablehnen"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Trust Center Shell ────────────────────────────────────────────────────────
const TABS = ["Audit Log", "Policies", "Freigaben", "Security"] as const;
type Tab = typeof TABS[number];

export function TrustCenterShell({
  audit, policies, approvals, security,
}: {
  audit?:     Record<string,unknown> | null;
  policies?:  Record<string,unknown> | null;
  approvals?: Record<string,unknown> | null;
  security?:  Record<string,unknown> | null;
}) {
  const [tab,     setTab]     = useState<Tab>("Audit Log");
  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState({ audit, policies, approvals, security });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, ap] = await Promise.allSettled([
        fetch("/api/audit?limit=100").then((r) => r.json()),
        fetch("/api/governance/registry").then((r) => r.json()),
        fetch("/api/governance/approvals?limit=20").then((r) => r.json()),
      ]);
      setData({
        audit:     a.status  === "fulfilled" ? a.value  : data.audit,
        policies:  p.status  === "fulfilled" ? p.value  : data.policies,
        approvals: ap.status === "fulfilled" ? ap.value : data.approvals,
        security:  data.security,
      });
    } finally { setLoading(false); }
  }, [data]);

  const auditItems    = Array.isArray(data.audit?.items)    ? data.audit.items    as AuditItem[]   : [];
  const policyItems   = Array.isArray(data.policies?.items) ? data.policies.items as PolicyItem[]  : [];
  const approvalItems = Array.isArray(data.approvals?.items)? data.approvals.items as ApprovalItem[]: [];
  const secItems      = Array.isArray(data.security?.items) ? data.security.items as Record<string,unknown>[] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5" style={{ color: "var(--accent)" }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Trust Center</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Audit · Policies · Freigaben · PKI & Compliance
              </p>
            </div>
          </div>
          <button onClick={refresh} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition"
            style={{ background: "rgba(90,196,255,0.10)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mt-4">
          {[
            { label: "Audit Events", value: auditItems.length, icon: FileText },
            { label: "Aktive Policies", value: policyItems.filter((p) => p.status === "active").length, icon: Shield },
            { label: "Offene Freigaben", value: approvalItems.length, icon: AlertTriangle },
            { label: "Security Items", value: secItems.length, icon: Key },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
              <Icon className="size-4" style={{ color: "var(--accent)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{value}</span>
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: tab === t ? "rgba(90,196,255,0.15)" : "rgba(255,255,255,0.04)",
              border:     tab === t ? "1px solid rgba(90,196,255,0.35)" : "1px solid var(--border)",
              color:      tab === t ? "var(--accent)" : "var(--muted-foreground)",
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <section className="rounded-[24px] border border-white/10 bg-black/20 backdrop-blur p-5">
        {tab === "Audit Log"  && <AuditLogTable  items={auditItems} />}
        {tab === "Policies"   && <PolicyList     items={policyItems} />}
        {tab === "Freigaben"  && <ApprovalQueue  items={approvalItems} />}
        {tab === "Security"   && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "API Keys",      status: "ok",      icon: Key },
                { label: "PKI Zertifikate", status: "ok",    icon: Shield },
                { label: "Secrets Vault", status: "ok",      icon: ShieldCheck },
              ].map(({ label, status, icon: Icon }) => (
                <div key={label} className="glass-card p-4 flex items-center gap-3">
                  <Icon className="size-5 shrink-0" style={{ color: "var(--accent)" }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{label}</p>
                    <p className="text-xs mt-0.5 text-emerald-400">{status === "ok" ? "✓ Gesund" : "⚠ Prüfen"}</p>
                  </div>
                </div>
              ))}
            </div>
            {secItems.length > 0 && (
              <div className="space-y-2 mt-4">
                {secItems.map((s, i) => (
                  <div key={i} className="glass-card p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Shield className="size-3.5" style={{ color: "var(--accent)" }} />
                      <span style={{ color: "var(--foreground)" }}>{String(s.title ?? s.type ?? s.message ?? `Security Item ${i + 1}`)}</span>
                      {s.severity != null && <span className="ml-auto pill-cyan">{String(s.severity)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

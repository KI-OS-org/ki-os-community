"use client";

import { useState, useEffect } from "react";
import { Webhook, RefreshCw, Plus, Play, CheckCircle2, AlertCircle, Clock } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebhookEntry {
  id: string;
  url: string;
  event?: string;
  channel?: string;
  active?: boolean;
  secret?: string;
  createdAt?: string;
}

interface Dispatch {
  id: string;
  webhookId?: string;
  event?: string;
  url?: string;
  status: "success" | "failed" | "pending";
  statusCode?: number;
  timestamp?: string;
  error?: string;
}

interface TestResult {
  success: boolean;
  statusCode?: number;
  message?: string;
  responseMs?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function statusBadge(s: string) {
  if (s === "success") return { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.25)",  color: "#22c55e",  label: "Erfolg" };
  if (s === "failed")  return { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.25)", color: "#f87171",  label: "Fehler" };
  return                     { bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.25)",   color: "#eab308",  label: "Ausstehend" };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const [webhooks,   setWebhooks]   = useState<WebhookEntry[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Add form
  const [showAdd, setShowAdd]       = useState(false);
  const [formUrl,     setFormUrl]     = useState("");
  const [formEvent,   setFormEvent]   = useState("");
  const [formChannel, setFormChannel] = useState("");
  const [formSecret,  setFormSecret]  = useState("");

  // Test
  const [testResult,  setTestResult]  = useState<TestResult | null>(null);
  const [testing,     setTesting]     = useState<string | null>(null);
  const [adding,      setAdding]      = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/webhooks/generator");
      const data = await res.json().catch(() => ({}));
      const wList = Array.isArray(data) ? data : (data.webhooks ?? []);
      const dList = data.dispatches ?? data.recentDispatches ?? [];
      setWebhooks(wList);
      setDispatches(dList);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const addWebhook = async () => {
    if (!formUrl.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/webhooks/generator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: formUrl, event: formEvent, channel: formChannel, secret: formSecret }),
      });
      setFormUrl(""); setFormEvent(""); setFormChannel(""); setFormSecret("");
      setShowAdd(false);
      await fetchData();
    } finally { setAdding(false); }
  };

  const testWebhook = async (wh: WebhookEntry) => {
    setTesting(wh.id); setTestResult(null);
    try {
      const res = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: wh.url, event: wh.event, secret: wh.secret }),
      });
      const data = await res.json().catch(() => ({}));
      setTestResult({ success: res.ok, statusCode: data?.statusCode, message: data?.message, responseMs: data?.responseMs });
    } catch (e) {
      setTestResult({ success: false, message: e instanceof Error ? e.message : "Fehler" });
    } finally { setTesting(null); }
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Webhook className="size-6" style={{ color: "var(--accent)" }} />
            Webhook Manager
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Webhooks verwalten, testen und Dispatches verfolgen
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted-foreground)" }}
          >
            <RefreshCw className="size-3.5" /> Refresh
          </button>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ background: "rgba(90,196,255,0.12)", border: "1px solid rgba(90,196,255,0.25)", color: "#5ac4ff" }}
          >
            <Plus className="size-3.5" /> Webhook hinzufügen
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-semibold text-[var(--foreground)]">Neuer Webhook</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">URL *</label>
              <input
                type="url"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Event</label>
              <input
                value={formEvent}
                onChange={e => setFormEvent(e.target.value)}
                placeholder="agent.run.complete"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Channel</label>
              <input
                value={formChannel}
                onChange={e => setFormChannel(e.target.value)}
                placeholder="slack / email / custom"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Secret</label>
              <input
                type="password"
                value={formSecret}
                onChange={e => setFormSecret(e.target.value)}
                placeholder="HMAC-Secret (optional)"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addWebhook}
              disabled={adding || !formUrl.trim()}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.3)", color: "#5ac4ff" }}
            >
              {adding ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {adding ? "Speichere…" : "Speichern"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg px-4 py-2 text-sm text-[var(--muted-foreground)]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Test Result Toast */}
      {testResult && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={testResult.success
            ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }
            : { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
        >
          {testResult.success
            ? <CheckCircle2 className="size-4 shrink-0" style={{ color: "#22c55e" }} />
            : <AlertCircle  className="size-4 shrink-0" style={{ color: "#f87171" }} />}
          <span style={{ color: testResult.success ? "#22c55e" : "#f87171" }}>
            Test {testResult.success ? "erfolgreich" : "fehlgeschlagen"}
            {testResult.statusCode ? ` (HTTP ${testResult.statusCode})` : ""}
            {testResult.responseMs != null ? ` · ${testResult.responseMs}ms` : ""}
            {testResult.message ? ` — ${testResult.message}` : ""}
          </span>
        </div>
      )}

      {/* Webhook List */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
          <Webhook className="size-4" style={{ color: "var(--accent)" }} />
          Webhooks
          <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "rgba(90,196,255,0.12)", color: "#5ac4ff", border: "1px solid rgba(90,196,255,0.2)" }}>
            {webhooks.length}
          </span>
        </h3>

        {webhooks.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
            Noch keine Webhooks — klicke auf "Webhook hinzufügen"
          </p>
        ) : (
          <div className="space-y-2">
            {webhooks.map(w => (
              <div key={w.id} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{w.url}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--muted-foreground)]">
                      {w.event   && <span>Event: <span className="text-[var(--foreground)]">{w.event}</span></span>}
                      {w.channel && <span>Channel: <span className="text-[var(--foreground)]">{w.channel}</span></span>}
                      {w.active != null && (
                        <span style={{ color: w.active ? "#22c55e" : "#94a3b8" }}>{w.active ? "Aktiv" : "Inaktiv"}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => testWebhook(w)}
                    disabled={testing === w.id}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shrink-0 transition-opacity disabled:opacity-50"
                    style={{ background: "rgba(90,196,255,0.1)", border: "1px solid rgba(90,196,255,0.2)", color: "#5ac4ff" }}
                  >
                    {testing === w.id ? <RefreshCw className="size-3 animate-spin" /> : <Play className="size-3" />}
                    Test
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Dispatches */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
          <Clock className="size-4" style={{ color: "var(--accent)" }} />
          Letzte Dispatches
        </h3>

        {dispatches.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-6">Keine Dispatches vorhanden</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted-foreground)] border-b border-white/5">
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Event</th>
                  <th className="pb-2 pr-4 font-medium">URL</th>
                  <th className="pb-2 pr-4 font-medium">Code</th>
                  <th className="pb-2 font-medium">Zeitpunkt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dispatches.slice(0, 20).map(d => {
                  const st = statusBadge(d.status);
                  return (
                    <tr key={d.id} className="text-[var(--foreground)]">
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-[var(--muted-foreground)]">{d.event ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-xs text-[var(--muted-foreground)] max-w-xs truncate">{d.url ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-xs text-[var(--muted-foreground)]">{d.statusCode ?? "—"}</td>
                      <td className="py-2.5 text-xs text-[var(--muted-foreground)]">{fmtDate(d.timestamp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

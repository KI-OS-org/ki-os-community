"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ChevronLeft, Loader2, AlertTriangle, CheckCircle, XCircle,
  Zap, Trash2, RefreshCw, Activity, Shield, PlugZap
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

interface Connector {
  id: string;
  name: string;
  protocol: string;
  version: string;
  active: boolean;
  capabilities: string[];
  health: "healthy" | "degraded" | "offline" | "unknown";
  trustLevel: string;
  metadata: Record<string, unknown>;
  routes: Record<string, string>;
  registeredAt: string;
  updatedAt: string;
}

interface InvokeResult {
  ok: boolean;
  statusCode?: number;
  latencyMs?: number;
  response?: unknown;
  error?: string;
}

// ── Health Badge ───────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

export default function ConnectorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [connector, setConnector] = useState<Connector | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [invoking, setInvoking]   = useState(false);
  const [invokePayload, setInvokePayload] = useState('{\n  "action": "ping"\n}');
  const [invokeResult, setInvokeResult]   = useState<InvokeResult | null>(null);

  const [deleting, setDeleting]   = useState(false);
  const [deleted, setDeleted]     = useState(false);

  const [eventLog, setEventLog]   = useState<{ ts: string; type: string; detail: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/connectors/detail?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Connector nicht gefunden");
      setConnector(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function testInvoke() {
    setInvoking(true);
    setInvokeResult(null);
    const t0 = Date.now();
    try {
      let body: unknown;
      try { body = JSON.parse(invokePayload); } catch { body = { raw: invokePayload }; }

      const res  = await fetch("/api/connectors/test-invoke", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ connectorId: id, payload: body }),
      });
      const data = await res.json();
      const latencyMs = Date.now() - t0;
      const result: InvokeResult = { ok: res.ok, statusCode: res.status, latencyMs, response: data };
      setInvokeResult(result);
      setEventLog(log => [
        { ts: new Date().toISOString(), type: res.ok ? "invoke.ok" : "invoke.error", detail: `${res.status} — ${latencyMs}ms` },
        ...log,
      ].slice(0, 50));
    } catch (e: unknown) {
      const latencyMs = Date.now() - t0;
      const result: InvokeResult = { ok: false, latencyMs, error: e instanceof Error ? e.message : "Fehler" };
      setInvokeResult(result);
      setEventLog(log => [
        { ts: new Date().toISOString(), type: "invoke.error", detail: result.error ?? "Fehler" },
        ...log,
      ].slice(0, 50));
    } finally {
      setInvoking(false);
    }
  }

  async function deactivate() {
    if (!confirm(`Connector "${connector?.name}" wirklich entfernen?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/connectors/unregister?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Fehler beim Entfernen");
      }
      setDeleted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setDeleting(false);
    }
  }

  const inputCls = "w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5ac4ff]/50 transition-colors font-mono";

  // ── Deleted ──────────────────────────────────────────────────────────────

  if (deleted) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white p-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto">
            <Trash2 className="text-red-400" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Connector entfernt</h2>
            <p className="text-sm text-gray-400 mt-1">{id}</p>
          </div>
          <Link href="/integrations" className="inline-flex px-5 py-2.5 rounded-xl border border-white/10 text-sm text-gray-300 hover:text-white transition-colors">
            Zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white p-6 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5ac4ff]" size={28} />
      </div>
    );
  }

  if (error && !connector) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white p-6 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="text-red-400 mx-auto" size={28} />
          <p className="text-sm text-gray-400">{error}</p>
          <Link href="/integrations" className="text-sm text-[#5ac4ff] hover:underline">← Zurück</Link>
        </div>
      </div>
    );
  }

  if (!connector) return null;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back */}
        <Link href="/integrations" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={15} /> Integrations
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <PlugZap className="text-[#5ac4ff]" size={26} />
            <div>
              <h1 className="text-xl font-bold">{connector.name}</h1>
              <p className="text-sm text-gray-400 font-mono">{connector.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HealthBadge health={connector.health} />
            <button onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Protokoll",     value: connector.protocol },
            { label: "Trust Level",   value: connector.trustLevel },
            { label: "Version",       value: connector.version ?? "—" },
            { label: "Status",        value: connector.active ? "Aktiv" : "Inaktiv" },
            { label: "Registriert",   value: new Date(connector.registeredAt).toLocaleString("de-DE") },
            { label: "Aktualisiert",  value: new Date(connector.updatedAt).toLocaleString("de-DE") },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-sm text-white font-medium">{value}</div>
            </div>
          ))}
        </div>

        {/* Capabilities */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield size={14} className="text-[#5ac4ff]" /> Capabilities
          </h3>
          <div className="flex flex-wrap gap-2">
            {connector.capabilities.length > 0
              ? connector.capabilities.map(c => (
                  <span key={c} className="px-2.5 py-1 rounded-full text-xs bg-[#5ac4ff]/10 border border-[#5ac4ff]/20 text-[#5ac4ff]">{c}</span>
                ))
              : <span className="text-xs text-gray-500">Keine Capabilities definiert</span>
            }
          </div>
        </div>

        {/* Routes */}
        {Object.keys(connector.routes ?? {}).length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Routes</h3>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-white/5">
                {Object.entries(connector.routes).map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-1.5 pr-4 text-gray-400 w-28">{k}</td>
                    <td className="py-1.5 text-white font-mono">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Test Invoke */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap size={14} className="text-[#5ac4ff]" /> Test-Invoke
          </h3>
          <textarea
            value={invokePayload}
            onChange={e => setInvokePayload(e.target.value)}
            rows={4}
            className={inputCls + " resize-none text-xs"}
          />
          <button
            onClick={testInvoke}
            disabled={invoking}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
          >
            {invoking ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
            {invoking ? "Wird aufgerufen..." : "Invoke"}
          </button>

          {invokeResult && (
            <div className={`rounded-xl border p-4 space-y-2 ${invokeResult.ok ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              <div className={`flex items-center gap-2 text-sm font-medium ${invokeResult.ok ? "text-green-400" : "text-red-400"}`}>
                {invokeResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {invokeResult.ok ? "Erfolg" : "Fehler"}
                {invokeResult.statusCode && <span className="text-xs text-gray-400">— HTTP {invokeResult.statusCode}</span>}
                {invokeResult.latencyMs != null && <span className="text-xs text-gray-400">{invokeResult.latencyMs}ms</span>}
              </div>
              {invokeResult.error && <div className="text-xs text-red-300 font-mono">{invokeResult.error}</div>}
              {invokeResult.response != null && (
                <pre className="text-xs text-gray-200 font-mono bg-black/30 rounded-lg p-3 overflow-auto max-h-48">
                  {JSON.stringify(invokeResult.response, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Event Log */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity size={14} className="text-[#5ac4ff]" /> Event Log (Session)
          </h3>
          {eventLog.length === 0 ? (
            <p className="text-xs text-gray-500">Noch keine Events in dieser Session.</p>
          ) : (
            <div className="space-y-1.5">
              {eventLog.map((e, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-gray-500 font-mono w-20 shrink-0">{new Date(e.ts).toLocaleTimeString("de-DE")}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${e.type.includes("error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>{e.type}</span>
                  <span className="text-gray-300">{e.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deactivate */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-red-400">Connector entfernen</h3>
          <p className="text-xs text-gray-400">Standard-Connectors (desktop-native, mcp-bridge etc.) können nicht entfernt werden.</p>
          <button
            onClick={deactivate}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            {deleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
            {deleting ? "Wird entfernt..." : "Connector entfernen"}
          </button>
        </div>

      </div>
    </div>
  );
}

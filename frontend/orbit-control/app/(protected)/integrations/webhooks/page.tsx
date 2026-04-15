"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, Zap, Copy, Check, Play, Loader2, AlertTriangle, CheckCircle, XCircle, RefreshCw, Clock, Plus } from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

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
  event?: string;
  url?: string;
  status: "success" | "failed" | "pending";
  statusCode?: number;
  timestamp?: string;
  error?: string;
}

// ── Hub config ─────────────────────────────────────────────────────────────

const HUB_SYSTEMS = [
  { id: "sap",        label: "SAP S/4HANA"          },
  { id: "salesforce", label: "Salesforce CRM"        },
  { id: "shopify",    label: "Shopify"               },
  { id: "teams",      label: "Microsoft Teams"       },
  { id: "slack",      label: "Slack"                 },
  { id: "s3",         label: "AWS S3"                },
  { id: "adobe",      label: "Adobe Experience"      },
  { id: "zapier",     label: "Zapier"                },
  { id: "n8n",        label: "n8n"                   },
  { id: "make",       label: "Make (Integromat)"     },
  { id: "custom",     label: "Custom Hub"            },
];

const SAMPLE_PAYLOADS: Record<string, string> = {
  sap:        JSON.stringify({ eventType: "order.created", orderId: "ORD-001", amount: 4500.00 }, null, 2),
  salesforce: JSON.stringify({ sObjectType: "Lead", recordId: "00Q000001", changeType: "CREATE", fields: { LastName: "Mustermann", Company: "ACME" } }, null, 2),
  shopify:    JSON.stringify({ id: 820982911946154500, email: "jon@doe.ca", financial_status: "paid", line_items: [] }, null, 2),
  teams:      JSON.stringify({ "@type": "MessageCard", "@context": "https://schema.org/extensions", title: "KI-OS Alert", text: "New event triggered" }, null, 2),
  slack:      JSON.stringify({ text: "New KI-OS event", channel: "#general", username: "KI-OS Bot" }, null, 2),
  s3:         JSON.stringify({ Records: [{ eventName: "ObjectCreated:Put", s3: { bucket: { name: "my-bucket" }, object: { key: "report.pdf" } } }] }, null, 2),
  adobe:      JSON.stringify({ event: "campaign.delivery.sent", imsOrgId: "ABC123@AdobeOrg", data: { campaignId: "camp-001" } }, null, 2),
  zapier:     JSON.stringify({ event: "ki-os.trigger", data: { agentId: "agent-001", result: "completed" }, timestamp: new Date().toISOString() }, null, 2),
  n8n:        JSON.stringify({ event: "workflow.triggered", payload: { runId: "run-001", agentId: "agent-001" }, timestamp: new Date().toISOString() }, null, 2),
  make:       JSON.stringify({ event: "scenario.triggered", data: { scenarioId: "sc-001", source: "ki-os" }, timestamp: new Date().toISOString() }, null, 2),
  custom:     JSON.stringify({ event: "custom.event", payload: {}, timestamp: new Date().toISOString() }, null, 2),
};

// ── Component ──────────────────────────────────────────────────────────────

export default function WebhookStudioPage() {
  const [tab, setTab] = useState<"studio" | "list" | "dispatches">("studio");

  // Studio tab state
  const [hub,      setHub]      = useState("sap");
  const [flowId,   setFlowId]   = useState("flow-001");
  const [payload,  setPayload]  = useState(SAMPLE_PAYLOADS.sap);
  const [copied,   setCopied]   = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ ok: boolean; data?: unknown; error?: string; ms?: number } | null>(null);

  // List tab state
  const [webhooks,   setWebhooks]   = useState<WebhookEntry[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [formUrl,    setFormUrl]    = useState("");
  const [formEvent,  setFormEvent]  = useState("");
  const [formChannel,setFormChannel]= useState("");
  const [formSecret, setFormSecret] = useState("");
  const [adding,     setAdding]     = useState(false);
  const [testing,    setTesting]    = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const backendBase = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3000` : "http://localhost:3000";
  const webhookUrl = `${backendBase}/v1/hubs/webhook/${hub}/${flowId}`;

  function copy() {
    navigator.clipboard.writeText(webhookUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleHubChange(h: string) {
    setHub(h);
    setPayload(SAMPLE_PAYLOADS[h] ?? SAMPLE_PAYLOADS.custom);
    setTriggerResult(null);
  }

  async function trigger() {
    setTriggering(true);
    setTriggerResult(null);
    const t0 = Date.now();
    try {
      let body: unknown;
      try { body = JSON.parse(payload); } catch { body = { raw: payload }; }

      const res  = await fetch("/api/webhooks/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: webhookUrl, event: `hub.${hub}.trigger`, payload: body }),
      });
      const data = await res.json().catch(() => ({}));
      setTriggerResult({ ok: res.ok, data, ms: Date.now() - t0 });
    } catch (e: unknown) {
      setTriggerResult({ ok: false, error: e instanceof Error ? e.message : "Fehler", ms: Date.now() - t0 });
    } finally {
      setTriggering(false);
    }
  }

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res  = await fetch("/api/webhooks/generator");
      const data = await res.json().catch(() => ({}));
      const wList = Array.isArray(data) ? data : (data?.webhooks ?? []);
      const dList = data?.dispatches ?? data?.recentDispatches ?? [];
      setWebhooks(wList);
      setDispatches(dList);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "list" || tab === "dispatches") loadList();
  }, [tab, loadList]);

  async function addWebhook() {
    if (!formUrl.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/webhooks/generator", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: formUrl, event: formEvent, channel: formChannel, secret: formSecret }),
      });
      setFormUrl(""); setFormEvent(""); setFormChannel(""); setFormSecret("");
      setShowAdd(false);
      await loadList();
    } finally {
      setAdding(false);
    }
  }

  async function testWebhook(wh: WebhookEntry) {
    setTesting(wh.id);
    setTestResult(null);
    try {
      const res = await fetch("/api/webhooks/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: wh.url, event: wh.event, secret: wh.secret }),
      });
      const data = await res.json().catch(() => ({}));
      setTestResult({ ok: res.ok, msg: data?.message ?? (res.ok ? "Erfolg" : "Fehler") });
    } catch (e: unknown) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Fehler" });
    } finally {
      setTesting(null);
    }
  }

  const inputCls = "w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5ac4ff]/50 transition-colors";
  const labelCls = "block text-xs text-gray-400 mb-1.5 font-medium";

  const fmtDate = (iso?: string) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back */}
        <Link href="/integrations" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={15} /> Integrations
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3">
          <Zap className="text-[#5ac4ff]" size={26} />
          <div>
            <h1 className="text-xl font-bold">Webhook Studio</h1>
            <p className="text-sm text-gray-400">Hub-Trigger, Webhook-Verwaltung und Dispatches</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
          {(["studio", "list", "dispatches"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === t ? "bg-[#5ac4ff]/20 text-[#5ac4ff]" : "text-gray-400 hover:text-white"}`}
            >
              {t === "studio" ? "Hub-Trigger" : t === "list" ? "Webhooks" : "Dispatches"}
            </button>
          ))}
        </div>

        {/* ── Tab: Studio ── */}
        {tab === "studio" && (
          <div className="space-y-5">
            {/* URL Generator */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Webhook URL</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Hub / System</label>
                  <select value={hub} onChange={e => handleHubChange(e.target.value)} className={inputCls}>
                    {HUB_SYSTEMS.map(h => (
                      <option key={h.id} value={h.id}>{h.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Flow ID</label>
                  <input value={flowId} onChange={e => setFlowId(e.target.value)} placeholder="flow-001" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Generierte URL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-[#5ac4ff] font-mono break-all">
                    {webhookUrl}
                  </code>
                  <button onClick={copy} className="shrink-0 p-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors">
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Payload + Trigger */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Test-Payload</h3>
              <textarea
                value={payload}
                onChange={e => setPayload(e.target.value)}
                rows={8}
                className={inputCls + " resize-none font-mono text-xs"}
              />
              <button
                onClick={trigger}
                disabled={triggering || !flowId.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
              >
                {triggering ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                {triggering ? "Sende..." : "Hub triggern"}
              </button>

              {triggerResult && (
                <div className={`rounded-xl border p-4 space-y-2 ${triggerResult.ok ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                  <div className={`flex items-center gap-2 text-sm font-medium ${triggerResult.ok ? "text-green-400" : "text-red-400"}`}>
                    {triggerResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {triggerResult.ok ? "Trigger erfolgreich" : "Trigger fehlgeschlagen"}
                    {triggerResult.ms != null && <span className="text-xs text-gray-400">{triggerResult.ms}ms</span>}
                  </div>
                  {triggerResult.error && <div className="text-xs text-red-300 font-mono">{triggerResult.error}</div>}
                  {triggerResult.data != null && (
                    <pre className="text-xs text-gray-200 font-mono bg-black/30 rounded-lg p-3 overflow-auto max-h-40">
                      {JSON.stringify(triggerResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-[#5ac4ff]/20 bg-[#5ac4ff]/5 text-[#5ac4ff]/80 text-xs">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>Hub-Trigger läuft über <code className="font-mono">POST /v1/hubs/webhook/{"{hub}/{flowId}"}</code> und unterliegt der Governance-Policy (webhook-trigger-critical).</span>
            </div>
          </div>
        )}

        {/* ── Tab: List ── */}
        {tab === "list" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <button onClick={loadList} disabled={listLoading} className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-40">
                <RefreshCw size={14} className={listLoading ? "animate-spin" : ""} />
              </button>
              <button onClick={() => setShowAdd(v => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors">
                <Plus size={14} /> Webhook hinzufügen
              </button>
            </div>

            {showAdd && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white">Neuer Webhook</h3>
                <div>
                  <label className={labelCls}>URL *</label>
                  <input value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://example.com/webhook" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Event</label>
                    <input value={formEvent} onChange={e => setFormEvent(e.target.value)} placeholder="agent.run.complete" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Channel</label>
                    <input value={formChannel} onChange={e => setFormChannel(e.target.value)} placeholder="slack / custom" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Secret (HMAC, optional)</label>
                  <input type="password" value={formSecret} onChange={e => setFormSecret(e.target.value)} placeholder="..." className={inputCls} />
                </div>
                <div className="flex gap-2">
                  <button onClick={addWebhook} disabled={adding || !formUrl.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40">
                    {adding ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                    {adding ? "Speichere..." : "Speichern"}
                  </button>
                  <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 text-sm hover:text-white transition-colors">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs ${testResult.ok ? "border-green-500/20 bg-green-500/5 text-green-400" : "border-red-500/20 bg-red-500/5 text-red-400"}`}>
                {testResult.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
                {testResult.msg}
              </div>
            )}

            {listLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-[#5ac4ff]" size={20} />
              </div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-500">Noch keine Webhooks registriert.</div>
            ) : (
              <div className="space-y-2">
                {webhooks.map(w => (
                  <div key={w.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate font-mono">{w.url}</div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        {w.event   && <span>{w.event}</span>}
                        {w.channel && <span>{w.channel}</span>}
                        {w.active != null && <span className={w.active ? "text-green-400" : "text-gray-500"}>{w.active ? "Aktiv" : "Inaktiv"}</span>}
                      </div>
                    </div>
                    <button onClick={() => testWebhook(w)} disabled={testing === w.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#5ac4ff]/20 text-[#5ac4ff] text-xs hover:bg-[#5ac4ff]/10 transition-colors disabled:opacity-40">
                      {testing === w.id ? <Loader2 className="animate-spin" size={12} /> : <Play size={12} />}
                      Test
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Dispatches ── */}
        {tab === "dispatches" && (
          <div className="space-y-4">
            <button onClick={loadList} disabled={listLoading} className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-40">
              <RefreshCw size={14} className={listLoading ? "animate-spin" : ""} />
            </button>

            {listLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-[#5ac4ff]" size={20} />
              </div>
            ) : dispatches.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-500 flex flex-col items-center gap-3">
                <Clock size={24} className="text-gray-600" />
                Noch keine Dispatches vorhanden.
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">Event</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">URL</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">Code</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">Zeit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {dispatches.slice(0, 30).map(d => {
                      const isOk = d.status === "success";
                      return (
                        <tr key={d.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${
                              isOk ? "bg-green-500/10 border-green-500/20 text-green-400"
                              : d.status === "pending" ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                            }`}>
                              {isOk ? "Erfolg" : d.status === "pending" ? "Ausstehend" : "Fehler"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-400">{d.event ?? "—"}</td>
                          <td className="px-4 py-2.5 text-gray-400 max-w-[200px] truncate font-mono">{d.url ?? "—"}</td>
                          <td className="px-4 py-2.5 text-gray-400">{d.statusCode ?? "—"}</td>
                          <td className="px-4 py-2.5 text-gray-500">{fmtDate(d.timestamp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

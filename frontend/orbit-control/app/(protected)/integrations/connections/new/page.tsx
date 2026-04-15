"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Check, Loader2, AlertTriangle,
  PlugZap, Webhook, Shield, CheckCircle, X
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type Protocol = "mcp" | "native" | "http-proxy";
type TrustLevel = "high" | "standard" | "low";
type AuthType = "none" | "bearer" | "apikey" | "basic" | "hmac";

interface ConnectorDraft {
  id: string;
  name: string;
  protocol: Protocol;
  endpoint: string;
  capabilities: string[];
  trustLevel: TrustLevel;
  metadata: {
    category: string;
    authType: AuthType;
    description: string;
  };
}

// ── Connector Profiles ────────────────────────────────────────────────────

const PROFILES = [
  {
    id: "sap",
    label: "SAP S/4HANA",
    category: "erp",
    capabilities: ["erp.read", "erp.write", "erp.orders"],
    authType: "bearer" as AuthType,
    endpointHint: "https://your-sap-host/api/v1/webhook",
  },
  {
    id: "salesforce",
    label: "Salesforce",
    category: "crm",
    capabilities: ["crm.contacts", "crm.leads", "crm.opportunities"],
    authType: "bearer" as AuthType,
    endpointHint: "https://your-org.salesforce.com/services/webhook",
  },
  {
    id: "shopify",
    label: "Shopify",
    category: "ecommerce",
    capabilities: ["shop.orders", "shop.products", "shop.customers"],
    authType: "hmac" as AuthType,
    endpointHint: "https://your-store.myshopify.com/admin/api/webhooks",
  },
  {
    id: "teams",
    label: "Microsoft Teams",
    category: "communication",
    capabilities: ["msg.send", "msg.receive", "channel.post"],
    authType: "bearer" as AuthType,
    endpointHint: "https://outlook.office.com/webhook/...",
  },
  {
    id: "slack",
    label: "Slack",
    category: "communication",
    capabilities: ["msg.send", "msg.receive", "channel.post"],
    authType: "bearer" as AuthType,
    endpointHint: "https://hooks.slack.com/services/T.../B.../...",
  },
  {
    id: "s3",
    label: "AWS S3",
    category: "storage",
    capabilities: ["file.list", "file.get", "file.put"],
    authType: "apikey" as AuthType,
    endpointHint: "https://s3.amazonaws.com/your-bucket/webhook",
  },
  {
    id: "adobe",
    label: "Adobe Experience",
    category: "marketing",
    capabilities: ["campaign.trigger", "analytics.read"],
    authType: "apikey" as AuthType,
    endpointHint: "https://mc.adobe.io/your-org/webhook",
  },
  {
    id: "zapier",
    label: "Zapier",
    category: "automation",
    capabilities: ["automation.trigger", "automation.receive", "workflow.execute"],
    authType: "none" as AuthType,
    endpointHint: "https://hooks.zapier.com/hooks/catch/{userId}/{hookId}/",
  },
  {
    id: "n8n",
    label: "n8n",
    category: "automation",
    capabilities: ["automation.trigger", "automation.receive", "workflow.execute", "workflow.manage"],
    authType: "bearer" as AuthType,
    endpointHint: "https://your-n8n-host/webhook/{webhookId}",
  },
  {
    id: "make",
    label: "Make (Integromat)",
    category: "automation",
    capabilities: ["automation.trigger", "automation.receive", "scenario.run"],
    authType: "none" as AuthType,
    endpointHint: "https://hook.eu1.make.com/{webhookId}",
  },
  {
    id: "custom",
    label: "Custom / Eigene URL",
    category: "custom",
    capabilities: [],
    authType: "none" as AuthType,
    endpointHint: "https://...",
  },
];

const CAPABILITY_OPTIONS = [
  "erp.read", "erp.write", "erp.orders",
  "crm.contacts", "crm.leads", "crm.opportunities",
  "shop.orders", "shop.products", "shop.customers",
  "msg.send", "msg.receive", "channel.post",
  "file.list", "file.get", "file.put",
  "campaign.trigger", "analytics.read",
  "webhook.receive", "data.sync",
];

// ── Component ──────────────────────────────────────────────────────────────

export default function ConnectorWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=Profile, 1=Config, 2=Confirm
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  const [selectedProfile, setSelectedProfile] = useState<typeof PROFILES[0] | null>(null);
  const [draft, setDraft] = useState<ConnectorDraft>({
    id: "",
    name: "",
    protocol: "mcp",
    endpoint: "",
    capabilities: [],
    trustLevel: "standard",
    metadata: { category: "", authType: "none", description: "" },
  });

  const inputCls = "w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5ac4ff]/50 transition-colors";
  const labelCls = "block text-xs text-gray-400 mb-1.5 font-medium";

  function applyProfile(profile: typeof PROFILES[0]) {
    setSelectedProfile(profile);
    setDraft(d => ({
      ...d,
      id: `${profile.id}-connector`,
      name: profile.label,
      protocol: "mcp",
      endpoint: profile.endpointHint,
      capabilities: [...profile.capabilities],
      metadata: {
        ...d.metadata,
        category: profile.category,
        authType: profile.authType,
      },
    }));
  }

  function toggleCapability(cap: string) {
    setDraft(d => ({
      ...d,
      capabilities: d.capabilities.includes(cap)
        ? d.capabilities.filter(c => c !== cap)
        : [...d.capabilities, cap],
    }));
  }

  async function register() {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        id: draft.id || `connector-${Date.now()}`,
        name: draft.name,
        protocol: draft.protocol,
        capabilities: draft.capabilities,
        trustLevel: draft.trustLevel,
        metadata: {
          ...draft.metadata,
          webhookEndpoint: draft.endpoint,
        },
        routes: { webhook: draft.endpoint },
      };
      const res = await fetch("/api/connectors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Registrierung fehlgeschlagen");
      setRegisteredId(data.id ?? payload.id);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  // ── Success ────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white p-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
            <CheckCircle className="text-green-400" size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Connector registriert</h2>
            <p className="text-sm text-gray-400 mt-1">{registeredId}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Link href="/integrations" className="px-5 py-2.5 rounded-xl border border-white/10 text-sm text-gray-300 hover:text-white transition-colors">
              Zur Übersicht
            </Link>
            {registeredId && (
              <Link href={`/integrations/${registeredId}`} className="px-5 py-2.5 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors">
                Connector öffnen
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────

  const STEPS = ["Profil wählen", "Konfigurieren", "Bestätigen"];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Back */}
        <Link href="/integrations" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={15} /> Integrations
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3">
          <PlugZap className="text-[#5ac4ff]" size={26} />
          <div>
            <h1 className="text-xl font-bold">Neuer Connector</h1>
            <p className="text-sm text-gray-400">Webhook-Connector registrieren</p>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                i < step ? "bg-green-500/20 border-green-500/40 text-green-400"
                : i === step ? "bg-[#5ac4ff]/20 border-[#5ac4ff]/40 text-[#5ac4ff]"
                : "bg-white/5 border-white/10 text-gray-500"
              }`}>
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              <span className={`text-xs ${i === step ? "text-white" : "text-gray-500"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-white/10 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 0 — Profile */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Wähle ein Profil oder starte mit einer eigenen URL.</p>
            <div className="grid grid-cols-2 gap-3">
              {PROFILES.map(p => (
                <button
                  key={p.id}
                  onClick={() => applyProfile(p)}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
                    selectedProfile?.id === p.id
                      ? "bg-[#5ac4ff]/10 border-[#5ac4ff]/40"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <Webhook size={16} className={selectedProfile?.id === p.id ? "text-[#5ac4ff]" : "text-gray-500"} />
                  <div>
                    <div className={`text-sm font-medium ${selectedProfile?.id === p.id ? "text-[#5ac4ff]" : "text-gray-200"}`}>{p.label}</div>
                    <div className="text-xs text-gray-500">{p.category}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 — Config */}
        {step === 1 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Connector ID *</label>
                <input value={draft.id} onChange={e => setDraft(d => ({ ...d, id: e.target.value }))}
                  placeholder="my-connector-id" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Name *</label>
                <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="Mein Connector" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Webhook-Endpoint URL *</label>
              <input value={draft.endpoint} onChange={e => setDraft(d => ({ ...d, endpoint: e.target.value }))}
                placeholder="https://..." className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Protokoll</label>
                <select value={draft.protocol} onChange={e => setDraft(d => ({ ...d, protocol: e.target.value as Protocol }))}
                  className={inputCls}>
                  <option value="mcp">MCP</option>
                  <option value="native">Native</option>
                  <option value="http-proxy">HTTP Proxy</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Trust Level</label>
                <select value={draft.trustLevel} onChange={e => setDraft(d => ({ ...d, trustLevel: e.target.value as TrustLevel }))}
                  className={inputCls}>
                  <option value="high">High</option>
                  <option value="standard">Standard</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Auth-Typ</label>
                <select value={draft.metadata.authType}
                  onChange={e => setDraft(d => ({ ...d, metadata: { ...d.metadata, authType: e.target.value as AuthType } }))}
                  className={inputCls}>
                  <option value="none">Kein Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="apikey">API Key</option>
                  <option value="basic">Basic Auth</option>
                  <option value="hmac">HMAC Signature</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Beschreibung</label>
                <input value={draft.metadata.description}
                  onChange={e => setDraft(d => ({ ...d, metadata: { ...d.metadata, description: e.target.value } }))}
                  placeholder="Optionale Beschreibung" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Capabilities</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CAPABILITY_OPTIONS.map(cap => (
                  <button
                    key={cap}
                    onClick={() => toggleCapability(cap)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      draft.capabilities.includes(cap)
                        ? "bg-[#5ac4ff]/10 border-[#5ac4ff]/30 text-[#5ac4ff]"
                        : "border-white/10 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Confirm */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield size={14} className="text-[#5ac4ff]" /> Zusammenfassung
              </h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-white/5">
                  {[
                    ["ID", draft.id || "—"],
                    ["Name", draft.name || "—"],
                    ["Protokoll", draft.protocol],
                    ["Trust Level", draft.trustLevel],
                    ["Auth-Typ", draft.metadata.authType],
                    ["Endpoint", draft.endpoint || "—"],
                    ["Capabilities", draft.capabilities.join(", ") || "keine"],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="py-2 pr-4 text-gray-400 w-32">{k}</td>
                      <td className="py-2 text-white font-mono break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
                <AlertTriangle size={12} /> {error}
              </div>
            )}

            <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-[#5ac4ff]/20 bg-[#5ac4ff]/5 text-[#5ac4ff]/80 text-xs">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>Der Connector wird im Policy-Engine mit Trust Level <strong>{draft.trustLevel}</strong> registriert. Webhook-Calls unterliegen der Governance-Policy.</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Zurück
          </button>

          {step < 2 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && !selectedProfile}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
            >
              Weiter <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={register}
              disabled={loading || !draft.id || !draft.name || !draft.endpoint}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              {loading ? "Registriere..." : "Connector registrieren"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

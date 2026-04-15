"use client";

import { useState } from "react";
import { Activity, Clock, Play, RefreshCw, Terminal, Upload, Webhook, Zap } from "lucide-react";

interface TriggerType {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TRIGGER_TYPES: TriggerType[] = [
  { id: "manual", label: "Manual", description: "Trigger on demand via API or UI", icon: <Play className="h-4 w-4" /> },
  { id: "schedule", label: "Schedule", description: "Cron-based time trigger", icon: <Clock className="h-4 w-4" /> },
  { id: "webhook", label: "Webhook", description: "HTTP POST inbound event", icon: <Webhook className="h-4 w-4" /> },
  { id: "polling", label: "Polling", description: "Poll an endpoint on interval", icon: <RefreshCw className="h-4 w-4" /> },
  { id: "threshold", label: "Threshold", description: "Trigger when metric exceeds limit", icon: <Activity className="h-4 w-4" /> },
  { id: "file upload", label: "File Upload", description: "Fire on new file arrival", icon: <Upload className="h-4 w-4" /> },
];

const SAMPLE_EVENTS: Record<string, object> = {
  manual: { trigger: "manual", timestamp: "2026-03-23T12:00:00Z", payload: { action: "invoke" } },
  schedule: { trigger: "schedule", cron: "0 8 * * 1-5", nextRun: "2026-03-24T08:00:00Z" },
  webhook: { trigger: "webhook", event: "order.created", data: { id: "ord_123", total: 249.99, currency: "EUR" } },
  polling: { trigger: "polling", interval: "5m", endpoint: "https://api.example.com/status", lastCheck: "2026-03-23T11:55:00Z" },
  threshold: { trigger: "threshold", metric: "errorRate", value: 0.08, threshold: 0.05, direction: "above" },
  "file upload": { trigger: "fileUpload", bucket: "ki-os-uploads", key: "reports/2026-03-23.csv", size: 14520 },
};

interface Props {
  webhooks?: unknown[];
}

export function WebhookTriggerStudioShell({ webhooks }: Props) {
  const [selectedTrigger, setSelectedTrigger] = useState<string>("webhook");
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://orbit.ki-os.ai";
  const generatedUrl = `${baseUrl}/api/webhooks/inbound/${selectedTrigger}?token=whsec_${btoa(selectedTrigger).replace(/=/g, "")}`;

  function handleCopy() {
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const eventPreview = SAMPLE_EVENTS[selectedTrigger] ?? {};

  return (
    <div className="space-y-5">
      <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5">
        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
          <Webhook className="h-5 w-5 text-[var(--accent)]" />
          Webhook Trigger Studio
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Configure trigger sources and generate inbound webhook endpoints.
        </p>
      </div>

      <div className="flex gap-5">
        {/* Left: Trigger catalog */}
        <div className="w-56 shrink-0 space-y-2">
          <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide px-1 mb-3">
            Trigger Catalog
          </p>
          {TRIGGER_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTrigger(t.id)}
              className={`w-full text-left rounded-xl border p-3 transition-all ${
                selectedTrigger === t.id
                  ? "border-[var(--accent)] bg-[rgba(90,196,255,0.08)]"
                  : "border-white/10 bg-black/20 hover:border-white/20"
              }`}
            >
              <div className={`flex items-center gap-2 ${selectedTrigger === t.id ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}>
                {t.icon}
                <span className="text-sm font-medium text-white">{t.label}</span>
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-1 leading-snug">{t.description}</p>
            </button>
          ))}

          {/* Active webhooks count */}
          {webhooks && webhooks.length > 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-[var(--muted-foreground)]">Active Webhooks</p>
              <p className="text-lg font-bold text-[var(--accent)]">{webhooks.length}</p>
            </div>
          )}
        </div>

        {/* Center: URL generator */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[var(--accent)]" />
              Generated Endpoint URL
            </h3>

            <div className="rounded-xl border border-[rgba(90,196,255,0.2)] bg-black/40 p-4">
              <div className="flex items-start gap-2">
                <code className="flex-1 text-xs text-[var(--accent)] break-all leading-relaxed">
                  {generatedUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-[var(--muted-foreground)] mb-1">Method</p>
                <p className="font-semibold text-white">POST</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-[var(--muted-foreground)] mb-1">Auth</p>
                <p className="font-semibold text-white">HMAC-SHA256</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-[var(--muted-foreground)] mb-1">Content-Type</p>
                <p className="font-semibold text-white">application/json</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-[var(--muted-foreground)] mb-1">Trigger</p>
                <p className="font-semibold text-[var(--accent)] capitalize">{selectedTrigger}</p>
              </div>
            </div>

            <button className="flex items-center gap-2 rounded-lg bg-[rgba(90,196,255,0.12)] border border-[rgba(90,196,255,0.2)] px-4 py-2 text-sm text-[var(--accent)] hover:bg-[rgba(90,196,255,0.2)] transition-colors">
              <Zap className="h-4 w-4" />
              Send Test Event
            </button>
          </div>
        </div>

        {/* Right: Event preview */}
        <div className="w-72 shrink-0">
          <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--accent)]" />
              Event Preview
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Sample payload for <span className="text-white capitalize">{selectedTrigger}</span> trigger
            </p>
            <pre className="text-[10px] text-[var(--muted-foreground)] bg-black/40 rounded-xl p-3 overflow-auto max-h-72 leading-relaxed border border-white/5">
              {JSON.stringify(eventPreview, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

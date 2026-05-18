"use client";

import { useState } from "react";
import { Check, Key, RefreshCw, Shield } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  authType: string;
  endpoint?: string;
}

interface Props {
  profiles?: Profile[];
}

const DEFAULT_PROFILES: Profile[] = [
  { id: "cred-1", name: "SAP S/4HANA Prod", authType: "bearer", endpoint: "https://sap.company.com" },
  { id: "cred-2", name: "Salesforce Sandbox", authType: "oauthPrepared", endpoint: "https://sandbox.salesforce.com" },
  { id: "cred-3", name: "Shopify Store", authType: "apiKey", endpoint: "https://mystore.myshopify.com" },
  { id: "cred-4", name: "Webhook Inbound", authType: "webhook" },
];

const AUTH_TYPE_LABELS: Record<string, string> = {
  apiKey: "API Key",
  bearer: "Bearer",
  basic: "Basic Auth",
  oauthPrepared: "OAuth",
  webhook: "Webhook",
};

function maskKey(authType: string): string {
  if (authType === "apiKey") return "sk-••••••••••••••••";
  if (authType === "bearer") return "ey••••••••••••••••";
  if (authType === "basic") return "user:••••••••";
  if (authType === "oauthPrepared") return "oauth_••••••••";
  return "whsec_••••••••";
}

function authBadgeClass(authType: string): string {
  if (authType === "bearer") return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  if (authType === "apiKey") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (authType === "oauthPrepared") return "border-purple-500/30 bg-purple-500/10 text-purple-400";
  if (authType === "webhook") return "border-[var(--accent)]/30 bg-[rgba(90,196,255,0.1)] text-[var(--accent)]";
  return "border-white/10 bg-white/5 text-[var(--muted-foreground)]";
}

export function CredentialProfileList({ profiles }: Props) {
  const list = profiles && profiles.length > 0 ? profiles : DEFAULT_PROFILES;
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testedIds, setTestedIds] = useState<Set<string>>(new Set());

  async function handleTest(id: string) {
    setTestingId(id);
    await new Promise((r) => setTimeout(r, 900));
    setTestedIds((prev) => new Set([...prev, id]));
    setTestingId(null);
  }

  return (
    <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Key className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold text-white">Credential Profiles</h2>
        <span className="ml-auto text-xs text-[var(--muted-foreground)]">{list.length} profiles</span>
      </div>

      <div className="space-y-2">
        {list.map((profile) => (
          <div
            key={profile.id}
            className="glass-card flex items-center gap-3 p-3"
          >
            <Shield className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{profile.name}</p>
              {profile.endpoint && (
                <p className="text-[10px] text-[var(--muted-foreground)] truncate">{profile.endpoint}</p>
              )}
              <p className="text-[10px] text-[var(--muted-foreground)] font-mono mt-0.5">
                {maskKey(profile.authType)}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${authBadgeClass(profile.authType)}`}
            >
              {AUTH_TYPE_LABELS[profile.authType] ?? profile.authType}
            </span>

            <button
              onClick={() => handleTest(profile.id)}
              disabled={testingId === profile.id}
              className="shrink-0 flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors disabled:opacity-50"
            >
              {testingId === profile.id ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : testedIds.has(profile.id) ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : null}
              {testedIds.has(profile.id) && testingId !== profile.id ? "OK" : "Test"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

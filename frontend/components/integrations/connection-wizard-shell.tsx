"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Database,
  Globe,
  Key,
  Shield,
  Zap,
} from "lucide-react";

export type AuthType = "apiKey" | "basic" | "bearer" | "oauthPrepared" | "webhook";

interface WizardConfig {
  integrationType: string;
  name: string;
  authType: AuthType;
  apiKey?: string;
  username?: string;
  password?: string;
  bearerToken?: string;
  webhookSecret?: string;
  endpoint?: string;
}

interface Props {
  onComplete?: (config: unknown) => void;
}

const INTEGRATION_TYPES = [
  { id: "ERP", label: "ERP", description: "SAP, Oracle, Microsoft Dynamics", icon: <Database className="h-6 w-6" /> },
  { id: "CRM", label: "CRM", description: "Salesforce, HubSpot, Pipedrive", icon: <Globe className="h-6 w-6" /> },
  { id: "Messaging", label: "Messaging", description: "Teams, Slack, Email", icon: <Zap className="h-6 w-6" /> },
  { id: "E-Commerce", label: "E-Commerce", description: "Shopify, WooCommerce", icon: <Globe className="h-6 w-6" /> },
  { id: "Files", label: "Files", description: "S3, SharePoint, GDrive", icon: <Database className="h-6 w-6" /> },
  { id: "Generic API", label: "Generic API", description: "Any REST or GraphQL API", icon: <Globe className="h-6 w-6" /> },
];

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: "apiKey", label: "API Key" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "oauthPrepared", label: "OAuth (pre-configured)" },
  { value: "webhook", label: "Webhook Secret" },
];

const STEPS = ["Choose Type", "Configure", "Test & Confirm"];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
              i < current
                ? "bg-[var(--accent)] border-[var(--accent)] text-[#050816]"
                : i === current
                ? "border-[var(--accent)] text-[var(--accent)] bg-transparent"
                : "border-white/20 text-[var(--muted-foreground)] bg-transparent"
            }`}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span
            className={`text-xs ${
              i === current ? "text-white font-medium" : "text-[var(--muted-foreground)]"
            }`}
          >
            {STEPS[i]}
          </span>
          {i < total - 1 && (
            <div className="h-px w-8 bg-white/10 mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}

export function ConnectionWizardShell({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<WizardConfig>({
    integrationType: "",
    name: "",
    authType: "apiKey",
  });
  const [testing, setTesting] = useState(false);
  const [testPassed, setTestPassed] = useState<boolean | null>(null);

  function handleTypeSelect(typeId: string) {
    setConfig((c) => ({ ...c, integrationType: typeId }));
  }

  function handleNext() {
    if (step < 2) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function handleTest() {
    setTesting(true);
    setTestPassed(null);
    await new Promise((r) => setTimeout(r, 1200));
    setTestPassed(true);
    setTesting(false);
  }

  function handleComplete() {
    onComplete?.(config);
  }

  return (
    <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-2">New Integration</h2>
      <p className="text-sm text-[var(--muted-foreground)] mb-5">
        Connect an external system to KI-OS in three steps.
      </p>

      <StepIndicator current={step} total={3} />

      {/* Step 1: Choose type */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-white mb-3">Choose integration type</p>
          <div className="grid grid-cols-2 gap-3">
            {INTEGRATION_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleTypeSelect(type.id)}
                className={`glass-card text-left p-4 flex items-start gap-3 transition-all ${
                  config.integrationType === type.id
                    ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                    : ""
                }`}
              >
                <div className="text-[var(--accent)] mt-0.5">{type.icon}</div>
                <div>
                  <p className="font-semibold text-sm text-white">{type.label}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{type.description}</p>
                </div>
                {config.integrationType === type.id && (
                  <Check className="ml-auto h-4 w-4 text-[var(--accent)] shrink-0" />
                )}
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleNext}
              disabled={!config.integrationType}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#050816] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure credentials */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-white mb-3">Configure credentials</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">Connection Name</label>
              <input
                value={config.name}
                onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
                placeholder={`My ${config.integrationType} Connection`}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">Endpoint URL</label>
              <input
                value={config.endpoint ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, endpoint: e.target.value }))}
                placeholder="https://api.example.com"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">Auth Type</label>
              <div className="relative">
                <select
                  value={config.authType}
                  onChange={(e) => setConfig((c) => ({ ...c, authType: e.target.value as AuthType }))}
                  className="w-full appearance-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none pr-8"
                >
                  {AUTH_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
              </div>
            </div>

            {config.authType === "apiKey" && (
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                  <Key className="inline h-3 w-3 mr-1" />API Key
                </label>
                <input
                  type="password"
                  value={config.apiKey ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            )}

            {config.authType === "bearer" && (
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                  <Shield className="inline h-3 w-3 mr-1" />Bearer Token
                </label>
                <input
                  type="password"
                  value={config.bearerToken ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, bearerToken: e.target.value }))}
                  placeholder="Bearer ey..."
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            )}

            {config.authType === "basic" && (
              <>
                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">Username</label>
                  <input
                    value={config.username ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, username: e.target.value }))}
                    placeholder="username"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">Password</label>
                  <input
                    type="password"
                    value={config.password ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </>
            )}

            {config.authType === "webhook" && (
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Webhook Secret</label>
                <input
                  type="password"
                  value={config.webhookSecret ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, webhookSecret: e.target.value }))}
                  placeholder="whsec_..."
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex justify-between mt-4">
            <button
              onClick={handleBack}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[var(--muted-foreground)] hover:border-white/30 hover:text-white transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!config.name}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#050816] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Test & Confirm */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-white mb-3">Test & Confirm</p>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Name</span>
              <span className="text-white font-medium">{config.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Type</span>
              <span className="pill-cyan">{config.integrationType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Auth</span>
              <span className="text-white">{AUTH_TYPES.find((a) => a.value === config.authType)?.label}</span>
            </div>
            {config.endpoint && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Endpoint</span>
                <span className="text-white text-xs truncate max-w-[200px]">{config.endpoint}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleTest}
            disabled={testing}
            className="w-full rounded-lg border border-[var(--accent)]/30 bg-[rgba(90,196,255,0.08)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] hover:bg-[rgba(90,196,255,0.15)] transition-colors disabled:opacity-50"
          >
            {testing ? "Testing connection..." : "Test Connection"}
          </button>

          {testPassed === true && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
              <Check className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">Connection successful</span>
            </div>
          )}
          {testPassed === false && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <span className="text-sm text-red-400">Connection failed. Check credentials.</span>
            </div>
          )}

          <div className="flex justify-between mt-4">
            <button
              onClick={handleBack}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[var(--muted-foreground)] hover:border-white/30 hover:text-white transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleComplete}
              disabled={!testPassed}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#050816] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Confirm & Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

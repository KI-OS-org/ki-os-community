"use client";

import { useState } from "react";
import {
  Activity,
  Database,
  ExternalLink,
  Globe,
  Play,
  RefreshCw,
  Webhook,
  Zap,
} from "lucide-react";

export type IntegrationCategory =
  | "All"
  | "ERP"
  | "CRM"
  | "E-Commerce"
  | "Messaging"
  | "Files"
  | "Generic API"
  | "Webhook";

const CATEGORIES: IntegrationCategory[] = [
  "All",
  "ERP",
  "CRM",
  "E-Commerce",
  "Messaging",
  "Files",
  "Generic API",
  "Webhook",
];

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  ERP: <Database className="h-4 w-4" />,
  CRM: <Activity className="h-4 w-4" />,
  "E-Commerce": <Globe className="h-4 w-4" />,
  Messaging: <Zap className="h-4 w-4" />,
  Files: <ExternalLink className="h-4 w-4" />,
  "Generic API": <Globe className="h-4 w-4" />,
  Webhook: <Webhook className="h-4 w-4" />,
};

interface Connector {
  id: string;
  name: string;
  category: string;
  protocol?: string;
  description?: string;
}

interface HealthEntry {
  id: string;
  status: "healthy" | "warning" | "error" | "unknown";
}

interface Props {
  connectors: unknown;
  health: unknown;
}

function normalizeConnectors(raw: unknown): Connector[] {
  const fallback: Connector[] = [
    { id: "sap-s4", name: "SAP S/4HANA", category: "ERP", protocol: "REST", description: "Enterprise ERP integration" },
    { id: "salesforce", name: "Salesforce", category: "CRM", protocol: "REST", description: "CRM & sales automation" },
    { id: "shopify", name: "Shopify", category: "E-Commerce", protocol: "GraphQL", description: "E-commerce platform" },
    { id: "ms-teams", name: "Microsoft Teams", category: "Messaging", protocol: "Webhook", description: "Team messaging & notifications" },
    { id: "s3-files", name: "AWS S3", category: "Files", protocol: "S3 API", description: "Object storage integration" },
    { id: "generic-rest", name: "Generic REST", category: "Generic API", protocol: "REST", description: "Custom API connector" },
    { id: "webhook-inbound", name: "Webhook Inbound", category: "Webhook", protocol: "HTTP", description: "Inbound event trigger" },
    { id: "hubspot", name: "HubSpot", category: "CRM", protocol: "REST", description: "Marketing & CRM" },
    { id: "slack", name: "Slack", category: "Messaging", protocol: "Webhook", description: "Workplace messaging" },
  ];
  if (!raw || !Array.isArray(raw)) return fallback;
  return raw as Connector[];
}

function normalizeHealth(raw: unknown): Record<string, string> {
  const fallback: Record<string, string> = {
    "sap-s4": "healthy",
    salesforce: "healthy",
    shopify: "warning",
    "ms-teams": "healthy",
    "s3-files": "healthy",
    "generic-rest": "unknown",
    "webhook-inbound": "healthy",
    hubspot: "healthy",
    slack: "warning",
  };
  if (!raw) return fallback;
  if (Array.isArray(raw)) {
    return Object.fromEntries(
      (raw as HealthEntry[]).map((h) => [h.id, h.status])
    );
  }
  if (typeof raw === "object") return raw as Record<string, string>;
  return fallback;
}

function healthDotClass(status: string): string {
  if (status === "healthy") return "status-dot green";
  if (status === "warning") return "status-dot yellow";
  if (status === "error") return "status-dot red";
  return "status-dot blue";
}

function healthLabel(status: string): string {
  if (status === "healthy") return "Healthy";
  if (status === "warning") return "Warning";
  if (status === "error") return "Error";
  return "Unknown";
}

function ConnectorCard({
  connector,
  status,
}: {
  connector: Connector;
  status: string;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleTestInvoke() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/connectors/test-invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: connector.id }),
      });
      if (res.ok) {
        setTestResult("ok");
      } else {
        setTestResult("error");
      }
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white text-sm">{connector.name}</span>
        <div className="flex items-center gap-1.5">
          <span className={healthDotClass(status)} />
          <span className="text-xs text-[var(--muted-foreground)]">
            {healthLabel(status)}
          </span>
        </div>
      </div>

      {/* Description */}
      {connector.description && (
        <p className="text-xs text-[var(--muted-foreground)] leading-snug">
          {connector.description}
        </p>
      )}

      {/* Middle: category + protocol */}
      <div className="flex items-center gap-2">
        <span className="pill-cyan flex items-center gap-1 text-[10px]">
          {CATEGORY_ICON[connector.category] ?? null}
          {connector.category}
        </span>
        {connector.protocol && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
            {connector.protocol}
          </span>
        )}
      </div>

      {/* Bottom: test invoke */}
      <div className="mt-auto flex items-center gap-2">
        <button
          onClick={handleTestInvoke}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-lg bg-[rgba(90,196,255,0.12)] border border-[rgba(90,196,255,0.2)] px-3 py-1.5 text-xs text-[var(--accent)] hover:bg-[rgba(90,196,255,0.2)] transition-colors disabled:opacity-50"
        >
          {testing ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Test Invoke
        </button>
        {testResult === "ok" && (
          <span className="text-xs text-emerald-400">OK</span>
        )}
        {testResult === "error" && (
          <span className="text-xs text-red-400">Failed</span>
        )}
      </div>
    </div>
  );
}

export function IntegrationsHubShell({ connectors: rawConnectors, health: rawHealth }: Props) {
  const connectors = normalizeConnectors(rawConnectors);
  const healthMap = normalizeHealth(rawHealth);

  const [activeCategory, setActiveCategory] = useState<IntegrationCategory>("All");

  const filtered =
    activeCategory === "All"
      ? connectors
      : connectors.filter((c) => c.category === activeCategory);

  const mcpManifest = {
    version: "1.0",
    total: connectors.length,
    categories: [...new Set(connectors.map((c) => c.category))],
    endpoints: connectors.map((c) => ({ id: c.id, protocol: c.protocol })),
  };

  const healthyCount = Object.values(healthMap).filter((s) => s === "healthy").length;
  const warningCount = Object.values(healthMap).filter((s) => s === "warning").length;
  const errorCount = Object.values(healthMap).filter((s) => s === "error").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Integrations Hub</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            App catalog, connection registry and health status for all connectors.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="status-dot green" />
            <span className="text-[var(--muted-foreground)]">{healthyCount} Healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="status-dot yellow" />
            <span className="text-[var(--muted-foreground)]">{warningCount} Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="status-dot red" />
            <span className="text-[var(--muted-foreground)]">{errorCount} Error</span>
          </div>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  activeCategory === cat
                    ? "bg-[var(--accent)] text-[#050816] border-[var(--accent)]"
                    : "border-white/10 bg-white/5 text-[var(--muted-foreground)] hover:border-[var(--accent)]/40 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Connector grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
            }}
          >
            {filtered.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                status={healthMap[connector.id] ?? "unknown"}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-10 text-center text-[var(--muted-foreground)]">
              No connectors in this category.
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="w-72 shrink-0 space-y-4">
          {/* Counts */}
          <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Overview</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">Total Connectors</span>
                <span className="font-semibold text-white">{connectors.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">Categories</span>
                <span className="font-semibold text-white">
                  {new Set(connectors.map((c) => c.category)).size}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">Showing</span>
                <span className="font-semibold text-white">{filtered.length}</span>
              </div>
            </div>
          </div>

          {/* MCP Manifest Preview */}
          <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="h-4 w-4 text-[var(--accent)]" />
              MCP Manifest
            </h2>
            <pre className="text-[10px] text-[var(--muted-foreground)] bg-black/30 rounded-lg p-3 overflow-auto max-h-48 leading-relaxed">
              {JSON.stringify(mcpManifest, null, 2)}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  );
}

export type CapabilityStatus = "LIVE" | "PARTIAL" | "DEMO";

export interface CapabilityItem {
  area: string;
  status: CapabilityStatus;
  evidence: string[];
  note: string;
}

export const capabilityMatrix: CapabilityItem[] = [
  { area: "control-plane", status: "LIVE", evidence: ["/health", "/ui/control-plane/visible"], note: "Operator-Sicht gegen Backend." },
  { area: "governance-studio", status: "LIVE", evidence: ["/governance/registry", "/governance/simulate"], note: "Governance Registry und Simulation." },
  { area: "economic", status: "LIVE", evidence: ["/economic", "/economic/decisions"], note: "Economic Dashboard." },
  { area: "federation", status: "LIVE", evidence: ["/federation", "/federation/consents"], note: "Federation-Daten." },
  { area: "retail", status: "LIVE", evidence: ["/retail", "/retail-brain"], note: "Retail Experience." },
  { area: "workspace", status: "LIVE", evidence: ["/chat", "/ui/workspace"], note: "Workspace Run-Start und Read-Paths." },
  { area: "mission-control", status: "LIVE", evidence: ["/ui/control-plane/visible", "/ui/providers/live"], note: "Mission Control Status." },
  { area: "explain-trust", status: "LIVE", evidence: ["/api/explain", "/api/trust"], note: "Explain/Trust via API." },
  { area: "flow-studio", status: "LIVE", evidence: ["/api/flows", "/api/flows/templates", "/api/flows/test-run"], note: "Flow Studio via API." },
  { area: "integrations-hub", status: "LIVE", evidence: ["/api/integrations/catalog", "/api/integrations/connections", "/api/integrations/health"], note: "Integrations Hub via API." },
  { area: "files-memory", status: "LIVE", evidence: ["/api/files", "/api/memory/retrieve"], note: "Files & Memory via API." },
  { area: "packs", status: "LIVE", evidence: ["/api/packs/registry", "/api/packs/install"], note: "Pack-Verwaltung via API." },
  { area: "solutions", status: "LIVE", evidence: ["/api/solutions/domains", "/api/solutions/packs"], note: "Solutions via API." },
  { area: "templates", status: "LIVE", evidence: ["/api/templates/list", "/api/templates/start"], note: "Templates via API." },
  { area: "tenant-admin", status: "LIVE", evidence: ["/api/tenants/overview", "/api/tenants/detail"], note: "Tenant Admin via API." },
  { area: "webhooks-trigger", status: "LIVE", evidence: ["/api/webhooks/generator", "/api/triggers/catalog"], note: "Webhook-/Trigger-Studio via API." },
  { area: "connector-fabric", status: "LIVE", evidence: ["/api/connectors/registry", "/api/mcp/capabilities"], note: "Connector Fabric/MCP via API." },
  { area: "whiteboard", status: "LIVE", evidence: ["/api/whiteboard/board", "/api/whiteboard/shared"], note: "Whiteboard via API." },
  { area: "demo-packaging", status: "DEMO", evidence: ["/demo", "/api/demo/package"], note: "Expliziter Demo-/Investor-Bereich." },
];

/**
 * KI-OS Orbit Control — UI Runtime Seed
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Erzeugt einen konsistenten lokalen Runtime-Startzustand für L1/L2.
 * Dieser Seed enthält jetzt zusätzlich echte L2-Sammlungen für Run-Traces,
 * Memory-Items und File-Einträge als Grundlage für LIVE-light Datenpfade.
 *
 * Status:
 * LIVE-LIGHT FOUNDATION
 */
export function createUiRuntimeSeed() {
  const updatedAt = new Date().toISOString();
  return {
    integrations: {
      catalog: [
        { id: "sap", title: "SAP", status: "available" },
        { id: "shopify", title: "Shopify", status: "available" },
        { id: "jira", title: "Jira", status: "available" }
      ],
      connections: [
        { id: "sap-prod", providerId: "sap", title: "SAP Production", status: "connected" },
        { id: "shopify-main", providerId: "shopify", title: "Shopify Main", status: "connected" }
      ],
      health: [
        { id: "sap", healthy: true, latencyMs: 120 },
        { id: "shopify", healthy: true, latencyMs: 85 },
        { id: "jira", healthy: true, latencyMs: 90 }
      ]
    },
    packs: {
      registry: [
        { id: "ops-core", title: "Operations Core", installed: false, version: "1.0.0" },
        { id: "retail-insights", title: "Retail Insights", installed: true, version: "1.2.0" }
      ],
      history: [
        { id: "hist-seed-1", action: "install", packId: "retail-insights", status: "done", timestamp: updatedAt }
      ]
    },
    templates: {
      list: [
        { id: "governance-check", title: "Governance Check", category: "governance" },
        { id: "retail-briefing", title: "Retail Briefing", category: "retail" }
      ],
      starts: []
    },
    tenants: {
      overview: [
        { id: "demo-tenant", title: "Demo Tenant", status: "active" },
        { id: "ops-tenant", title: "Ops Tenant", status: "active" }
      ],
      details: {
        "demo-tenant": { id: "demo-tenant", title: "Demo Tenant", region: "eu-central-1", status: "active" },
        "ops-tenant": { id: "ops-tenant", title: "Ops Tenant", region: "eu-central-1", status: "active" }
      },
      workspaces: {
        "demo-tenant": [{ id: "ws-retail", title: "Retail Workspace" }],
        "ops-tenant": [{ id: "ws-ops", title: "Operations Workspace" }]
      }
    },
    whiteboard: {
      boards: [{ id: "board-main", title: "Main Board", status: "ready" }],
      shared: [{ id: "board-shared-1", boardId: "board-main", title: "Shared Main Board" }]
    },
    flows: {
      templates: [
        { id: "flow-governance", title: "Flow Governance", nodes: 4 },
        { id: "flow-retail", title: "Flow Retail", nodes: 5 }
      ],
      testRuns: []
    },
    solutions: {
      domains: [{ id: "retail", title: "Retail" }, { id: "operations", title: "Operations" }],
      packs: [{ id: "ops-core", solutionId: "operations" }, { id: "retail-insights", solutionId: "retail" }]
    },
    connectors: {
      registry: [{ id: "conn-jira", title: "Jira Connector", status: "ready" }],
      details: { "conn-jira": { id: "conn-jira", title: "Jira Connector", method: "rest", status: "ready" } },
      invocations: []
    },
    mcp: {
      manifest: { name: "KI-OS MCP", version: "1.0.0" },
      capabilities: ["tools", "memory", "routing"]
    },
    triggers: {
      catalog: [{ id: "cron-daily", type: "cron" }, { id: "webhook-order", type: "webhook" }],
      previews: [],
      replays: [],
      generator: [{ id: "sample-order-created", method: "POST" }]
    },
    runs: {
      traces: [
        {
          runId: "run-seed-001",
          tenant: "demo-tenant",
          workspaceId: "ws-retail",
          createdAt: updatedAt,
          model: "default-model",
          route: "retail-domain",
          routingReason: "retail + cost-optimized",
          policyChecks: [
            { policy: "budget-guard", result: "pass" },
            { policy: "privacy-guard", result: "pass" }
          ],
          toolCalls: [{ tool: "retail.evaluate", status: "ok" }],
          confidence: 0.86,
          status: "completed",
          summary: "Retail campaign should be adjusted"
        }
      ]
    },
    memory: {
      items: [
        {
          memoryId: "mem-seed-001",
          tenant: "demo-tenant",
          scope: "workspace",
          workspaceId: "ws-retail",
          sourceType: "run-summary",
          sourceName: "Retail Promotion Analysis",
          tags: ["retail", "promotion", "governance"],
          summary: "Retail campaign should be adjusted",
          reason: "Relevant due to prior retail evaluation",
          linkedRunId: "run-seed-001",
          createdAt: updatedAt
        }
      ]
    },
    files: {
      entries: [
        {
          fileId: "file-seed-001",
          tenant: "demo-tenant",
          name: "promo_q2.pdf",
          type: "pdf",
          category: "campaign",
          linkedRunId: "run-seed-001",
          linkedMemoryIds: ["mem-seed-001"],
          createdAt: updatedAt
        }
      ]
    },
    meta: {
      seedVersion: "1.0.0",
      updatedAt
    }
  };
}

export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "KI-OS Orbit Control",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  defaultTenant: process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? "demo-tenant",
  defaultRole: process.env.NEXT_PUBLIC_DEFAULT_ROLE ?? "user",
  features: {
    explainMode: process.env.NEXT_PUBLIC_ENABLE_EXPLAIN_MODE === "true",
    trustLens: process.env.NEXT_PUBLIC_ENABLE_TRUST_LENS === "true",
    flowStudio: process.env.NEXT_PUBLIC_ENABLE_FLOW_STUDIO === "true",
    integrationsHub: process.env.NEXT_PUBLIC_ENABLE_INTEGRATIONS_HUB === "true",
    retail: process.env.NEXT_PUBLIC_ENABLE_RETAIL === "true",
    federation: process.env.NEXT_PUBLIC_ENABLE_FEDERATION === "true",
    economic: process.env.NEXT_PUBLIC_ENABLE_ECONOMIC === "true",
    controlPlane: process.env.NEXT_PUBLIC_ENABLE_CONTROL_PLANE === "true",
  },
} as const;

export const orbitRuntimeConfig = {
  mode: process.env.NODE_ENV === "production" ? "enterprise" : "local-demo",
  auth: {
    mockEnabled: process.env.AUTH_ENABLE_MOCK !== "false",
    backendUrl: process.env.NEXTAUTH_BACKEND_URL ?? null,
    mockFallback: process.env.AUTH_MOCK_FALLBACK !== "false",
  },
  defaultRole: process.env.AUTH_DEFAULT_ROLE ?? appConfig.defaultRole,
  defaultTenant: process.env.AUTH_DEFAULT_TENANT ?? appConfig.defaultTenant,
  tenants: ["demo-tenant", "ops-tenant", "audit-tenant", "retail-tenant"],
  roles: ["admin", "operator", "auditor", "user"],
} as const;

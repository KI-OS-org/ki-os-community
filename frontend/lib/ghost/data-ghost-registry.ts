/**
 * Ghost Control — data-ghost Attribute Registry
 * 
 * Zentrale Übersicht aller data-ghost Attribute für Ghost Control.
 * 
 * @module lib/ghost/data-ghost-registry
 */

/**
 * Navigation Sidebar
 */
export const NAVIGATION = {
  HOME: 'nav-home',
  WORKSPACE: 'nav-workspace',
  AGENTS: 'nav-agents',
  JOBS: 'nav-jobs',
  FLOWS: 'nav-flows',
  MEMORY: 'nav-memory',
  INTEGRATIONS: 'nav-integrations',
  PROVIDERS: 'nav-providers',
  ROUTING: 'nav-routing',
  GOVERNANCE: 'nav-governance',
  TRUST: 'nav-trust',
  CONTROL: 'nav-control',
  REPAIR: 'nav-repair',
  SUPERVISOR: 'nav-supervisor',
  EFFICIENCY: 'nav-efficiency',
  ECONOMIC: 'nav-economic',
  FEDERATION: 'nav-federation',
  TENANTS: 'nav-tenants',
  STATE: 'nav-state',
  SOLUTIONS: 'nav-solutions',
  CAMPAIGNS: 'nav-campaigns',
  NOTIFICATIONS: 'nav-notifications',
  MEDIA: 'nav-media',
  AUDIO: 'nav-audio',
  DESKTOP: 'nav-desktop',
  MCP: 'nav-mcp',
  CONNECTOR_GALAXY: 'nav-connector-galaxy',
  TESTS: 'nav-tests',
} as const;

/**
 * Agents Page
 */
export const AGENTS = {
  NEW_AGENT_BTN: 'new-agent-btn',
  AGENT_NAME: 'agent-name',
  AGENT_CATEGORY: 'agent-category',
  AGENT_PROMPT: 'agent-prompt',
  AGENT_SAVE: 'agent-save',
  AGENT_EDIT: 'agent-edit',
  AGENT_DELETE: 'agent-delete',
  AGENT_TOGGLE: 'agent-toggle',
} as const;

/**
 * Jobs Page
 */
export const JOBS = {
  NEW_JOB_BTN: 'new-job-btn',
  JOB_NAME: 'job-name',
  JOB_SCHEDULE: 'job-schedule',
  JOB_AGENT: 'job-agent',
  JOB_SAVE: 'job-save',
  JOB_RUN: 'job-run',
} as const;

/**
 * Flows / DAG Studio
 */
export const FLOWS = {
  NEW_FLOW_BTN: 'new-flow-btn',
  FLOW_NAME: 'flow-name',
  FLOW_SAVE: 'flow-save',
  FLOW_EXECUTE: 'flow-execute',
  FLOW_EXPORT: 'flow-export',
  FLOW_IMPORT: 'flow-import',
  NODE_ADD: 'node-add',
  NODE_DELETE: 'node-delete',
  EDGE_ADD: 'edge-add',
} as const;

/**
 * Memory Page
 */
export const MEMORY = {
  MEMORY_SEARCH: 'memory-search',
  MEMORY_SAVE: 'memory-save',
  MEMORY_DELETE: 'memory-delete',
  GRAPH_VIEW: 'graph-view',
} as const;

/**
 * Governance Page
 */
export const GOVERNANCE = {
  POLICY_ADD: 'policy-add',
  POLICY_EDIT: 'policy-edit',
  POLICY_DELETE: 'policy-delete',
  POLICY_SIMULATE: 'policy-simulate',
} as const;

/**
 * Privacy Page
 */
export const PRIVACY = {
  PRIVACY_MASK: 'privacy-mask',
  PRIVACY_DEMASK: 'privacy-demas',
  PRIVACY_POLICY: 'privacy-policy',
} as const;

/**
 * Trust Center
 */
export const TRUST = {
  APPROVE_BTN: 'approve-btn',
  REJECT_BTN: 'reject-btn',
  AUDIT_LOG: 'audit-log',
  POLICY_LIST: 'policy-list',
} as const;

/**
 * Control Plane
 */
export const CONTROL = {
  HEALTH_CHECK: 'health-check',
  INCIDENTS: 'incidents',
  TRACES: 'traces',
  METRICS: 'metrics',
} as const;

/**
 * Self Repair
 */
export const REPAIR = {
  REPAIR_TRIGGER: 'repair-trigger',
  REPAIR_ANALYZE: 'repair-analyze',
  REPAIR_FIX: 'repair-fix',
  REPAIR_APPLY: 'repair-apply',
} as const;

/**
 * Campaigns
 */
export const CAMPAIGNS = {
  NEW_CAMPAIGN: 'new-campaign',
  CAMPAIGN_NAME: 'campaign-name',
  CAMPAIGN_SAVE: 'campaign-save',
  CAMPAIGN_EXECUTE: 'campaign-execute',
} as const;

/**
 * Solutions / Retail
 */
export const SOLUTIONS = {
  RETAIL_KPI: 'retail-kpi',
  RETAIL_OPS: 'retail-ops',
  RETAIL_PRICING: 'retail-pricing',
} as const;

/**
 * Integrations
 */
export const INTEGRATIONS = {
  NEW_INTEGRATION: 'new-integration',
  INTEGRATION_TEST: 'integration-test',
  WEBHOOK_ADD: 'webhook-add',
} as const;

/**
 * Providers
 */
export const PROVIDERS = {
  PROVIDER_CONFIG: 'provider-config',
  PROVIDER_TEST: 'provider-test',
} as const;

/**
 * Complete Registry
 */
export const GHOST_REGISTRY = {
  ...NAVIGATION,
  ...AGENTS,
  ...JOBS,
  ...FLOWS,
  ...MEMORY,
  ...GOVERNANCE,
  ...PRIVACY,
  ...TRUST,
  ...CONTROL,
  ...REPAIR,
  ...CAMPAIGNS,
  ...SOLUTIONS,
  ...INTEGRATIONS,
  ...PROVIDERS,
} as const;

export type GhostSelector = typeof GHOST_REGISTRY[keyof typeof GHOST_REGISTRY];

export default GHOST_REGISTRY;

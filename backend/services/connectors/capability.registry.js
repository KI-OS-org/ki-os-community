/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Observability = require('../core/observability.service');
const { validateConnectorContract } = require('./connector.adapter');
const licenseManager = require('../license/license.manager');

// Connector tier mapping by ID
// tier: 'community'  — always available (Generic HTTP, File Fabric, MCP, Ghost Control Basic)
// tier: 'business'   — requires KIOS_BUSINESS_KEY or higher (E-Commerce, Social Media, Developer, Marketing)
// tier: 'enterprise' — requires KIOS_ENTERPRISE_KEY (ERP, CRM, Collab, Cloud Storage, Finance)
const ENTERPRISE_CONNECTOR_IDS = new Set([
  'slack', 'teams', 'sap', 'salesforce', 's3', 'adobe'
]);

const BUSINESS_CONNECTOR_IDS = new Set([
  'shopify', 'woocommerce', 'magento',         // E-Commerce
  'instagram', 'linkedin', 'twitter',           // Social Media
  'github', 'gitlab', 'jira', 'datadog',        // Developer/Tech
  'mailchimp', 'hubspot-marketing', 'google-ads', 'meta-ads' // Marketing
]);

const REGISTRY_VERSION = 'v2';
const state = { connectors: new Map() };
const defaults = new Set();

function registryPath() {
  return process.env.CONNECTOR_REGISTRY_PATH || path.join(process.cwd(), 'runtime', '.ki-os-connectors.json');
}

function ensureRegistryDir() {
  fs.mkdirSync(path.dirname(registryPath()), { recursive: true });
}

function persistRegistry() {
  ensureRegistryDir();
  const items = Array.from(state.connectors.values())
    .filter((item) => !defaults.has(item.id))
    .map((item) => ({ ...item, handler: undefined }));
  fs.writeFileSync(registryPath(), JSON.stringify({ version: REGISTRY_VERSION, items }, null, 2), 'utf8');
}

function loadPersistedRegistry() {
  try {
    const raw = fs.readFileSync(registryPath(), 'utf8');
    const payload = JSON.parse(raw);
    if (Array.isArray(payload.items)) {
      for (const item of payload.items) {
        const normalized = validateConnectorContract(item);
        state.connectors.set(normalized.id, normalized);
      }
    }
  } catch {}
}

function getTemplates() {
  return [
    { id: 'http-proxy', protocol: 'mcp', capabilities: ['invoke.http'], trustLevel: 'standard', metadata: { category: 'integration', template: true } },
    { id: 'file-fabric', protocol: 'native', capabilities: ['file.list', 'file.get', 'file.put', 'file.delete'], trustLevel: 'high', metadata: { category: 'files', template: true } },
    { id: 'research-worker', protocol: 'native', capabilities: ['web.search', 'research.merge'], trustLevel: 'standard', metadata: { category: 'research', template: true } }
  ];
}

function bootstrapDefaults() {
  if (state.connectors.size) return;
  [
    {
      id: 'desktop-native',
      name: 'Desktop Control',
      protocol: 'native',
      capabilities: ['desktop.status', 'desktop.observe', 'desktop.screenshot', 'desktop.action', 'desktop.stop'],
      health: process.env.DESKTOP_CONTROL_ENABLED === 'true' ? 'healthy' : 'degraded',
      trustLevel: 'restricted',
      metadata: { category: 'desktop', owner: 'ki-os', mcpCompatible: true },
      routes: { status: '/desktop/status', action: '/desktop/action', observe: '/desktop/observe', screenshot: '/desktop/screenshot', stop: '/desktop/stop' }
    },
    {
      id: 'automation-webhooks',
      name: 'Automation Webhooks',
      protocol: 'native',
      capabilities: ['webhook.trigger', 'webhook.callback'],
      health: 'healthy',
      trustLevel: 'restricted',
      metadata: { category: 'automation', owner: 'ki-os', mcpCompatible: true },
      routes: { trigger: '/v1/hubs/webhook/:hub/:flowId', callback: '/v1/hubs/callback/:hub/:flowId' }
    },
    {
      id: 'memory-core',
      name: 'Memory Core',
      protocol: 'native',
      capabilities: ['memory.search', 'memory.save'],
      health: 'healthy',
      trustLevel: 'high',
      metadata: { category: 'memory', owner: 'ki-os', mcpCompatible: true },
      routes: { read: '/memory', write: '/memory' }
    },
    {
      id: 'websearch-native',
      name: 'Websearch',
      protocol: 'native',
      capabilities: ['web.search'],
      health: 'healthy',
      trustLevel: 'standard',
      metadata: { category: 'research', owner: 'ki-os', mcpCompatible: true },
      routes: { search: '/chat', planning: '/chat' }
    },
    {
      id: 'mcp-bridge',
      name: 'MCP Bridge',
      protocol: 'mcp',
      capabilities: ['mcp.capabilities', 'mcp.health', 'mcp.invoke'],
      health: 'healthy',
      trustLevel: 'standard',
      metadata: { category: 'connectors', owner: 'ki-os', transport: 'http', preferred: true },
      routes: { root: '/mcp', capabilities: '/mcp/capabilities', health: '/mcp/health', invoke: '/mcp/invoke' }
    },
    {
      id: 'file-fabric',
      name: 'File Fabric',
      protocol: 'native',
      capabilities: ['file.list', 'file.get', 'file.put', 'file.delete'],
      health: 'healthy',
      trustLevel: 'high',
      metadata: { category: 'files', owner: 'ki-os', fileFabric: true, mcpCompatible: true },
      routes: { list: '/files', upload: '/files/upload', detail: '/files/:id', content: '/files/:id/content' }
    }
  ].forEach((item) => {
    const normalized = validateConnectorContract(item);
    state.connectors.set(normalized.id, normalized);
    defaults.add(normalized.id);
  });
  loadPersistedRegistry();
}

function getConnectorTier(connector) {
  // Explicit tier on metadata takes precedence
  const metaTier = connector.metadata && connector.metadata.tier;
  if (metaTier && ['community', 'business', 'enterprise'].includes(metaTier)) return metaTier;
  if (ENTERPRISE_CONNECTOR_IDS.has(connector.id)) return 'enterprise';
  if (BUSINESS_CONNECTOR_IDS.has(connector.id)) return 'business';
  return 'community';
}

function isEnterpriseConnector(connector) {
  return getConnectorTier(connector) === 'enterprise';
}

function isBusinessConnector(connector) {
  return getConnectorTier(connector) === 'business';
}

function toPublic(connector) {
  const tier = getConnectorTier(connector);
  const locked =
    (tier === 'enterprise' && !licenseManager.isEnterprise()) ||
    (tier === 'business' && !licenseManager.isBusiness());

  return {
    id: connector.id,
    name: connector.name,
    protocol: connector.protocol,
    version: connector.version,
    active: connector.active,
    capabilities: connector.capabilities,
    health: connector.health,
    trustLevel: connector.trustLevel,
    metadata: connector.metadata,
    routes: connector.routes,
    registeredAt: connector.registeredAt,
    updatedAt: connector.updatedAt,
    tier,
    locked
  };
}

function getEditionInfo() {
  return licenseManager.getLicenseInfo();
}

function registerConnector(definition, options = {}) {
  if (!options.__skipBootstrap) bootstrapDefaults();
  const normalized = validateConnectorContract(definition);
  state.connectors.set(normalized.id, normalized);
  if (!defaults.has(normalized.id)) persistRegistry();
  if (!options.silent) {
    Observability.emit('connector.registered', {
      connectorId: normalized.id,
      protocol: normalized.protocol,
      capabilities: normalized.capabilities,
      trustLevel: normalized.trustLevel
    });
  }
  return toPublic(normalized);
}

function unregisterConnector(id) {
  bootstrapDefaults();
  const key = String(id || '');
  if (defaults.has(key)) {
    const error = new Error('connector_default_locked');
    error.statusCode = 409;
    throw error;
  }
  const existing = state.connectors.get(key);
  if (!existing) {
    const error = new Error('connector_not_found');
    error.statusCode = 404;
    throw error;
  }
  state.connectors.delete(key);
  persistRegistry();
  Observability.emit('connector.unregistered', { connectorId: key });
  return { success: true, connectorId: key };
}

function listConnectors() {
  bootstrapDefaults();
  return Array.from(state.connectors.values()).map(toPublic).sort((a, b) => a.id.localeCompare(b.id));
}

function listCapabilities() {
  bootstrapDefaults();
  const index = [];
  for (const connector of state.connectors.values()) {
    for (const capability of connector.capabilities) {
      index.push({
        capability,
        connectorId: connector.id,
        protocol: connector.protocol,
        trustLevel: connector.trustLevel,
        active: connector.active,
        health: connector.health
      });
    }
  }
  return index.sort((a, b) => a.capability.localeCompare(b.capability));
}

function getConnector(id) {
  bootstrapDefaults();
  const connector = state.connectors.get(String(id || ''));
  return connector ? toPublic(connector) : null;
}

function resolveCapability(capability) {
  bootstrapDefaults();
  return Array.from(state.connectors.values())
    .filter((connector) => connector.active && connector.capabilities.includes(String(capability || '')))
    .map(toPublic)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function updateConnectorHealth(id, health, meta = {}) {
  bootstrapDefaults();
  const connector = state.connectors.get(String(id || ''));
  if (!connector) {
    const error = new Error('connector_not_found');
    error.statusCode = 404;
    throw error;
  }
  const normalized = validateConnectorContract({ ...connector, ...meta, health });
  state.connectors.set(normalized.id, normalized);
  if (!defaults.has(normalized.id)) persistRegistry();
  Observability.emit('connector.health.updated', { connectorId: normalized.id, health: normalized.health, protocol: normalized.protocol });
  return toPublic(normalized);
}

function getCapabilityRegistryPayload() {
  const items = listConnectors();
  return {
    success: true,
    version: REGISTRY_VERSION,
    preferredStandard: 'mcp',
    templates: getTemplates(),
    capabilities: listCapabilities(),
    items,
    summary: {
      total: items.length,
      active: items.filter((item) => item.active).length,
      protocols: items.reduce((acc, item) => {
        acc[item.protocol] = (acc[item.protocol] || 0) + 1;
        return acc;
      }, {}),
      healthy: items.filter((item) => item.health === 'healthy').length,
      degraded: items.filter((item) => item.health === 'degraded').length,
      restricted: items.filter((item) => item.trustLevel === 'restricted').length
    }
  };
}

function getFabricPayload() {
  const registry = getCapabilityRegistryPayload();
  return {
    success: true,
    version: REGISTRY_VERSION,
    registry,
    templates: registry.templates,
    capabilityIndex: registry.capabilities,
    persistence: { path: registryPath(), persistedCustomConnectors: registry.items.filter((item) => !defaults.has(item.id)).length }
  };
}

function resetRegistry() {
  state.connectors = new Map();
  defaults.clear();
  try { fs.unlinkSync(registryPath()); } catch {}
  bootstrapDefaults();
}

bootstrapDefaults();

module.exports = {
  REGISTRY_VERSION,
  registerConnector,
  unregisterConnector,
  listConnectors,
  listCapabilities,
  resolveCapability,
  getConnector,
  updateConnectorHealth,
  getCapabilityRegistryPayload,
  getFabricPayload,
  getTemplates,
  resetRegistry,
  getEditionInfo
};

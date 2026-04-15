/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Observability = require('../core/observability.service');
const tenantService = require('../tenant/tenant.service');

function getStorePath() {
  return process.env.PACK_REGISTRY_PATH || path.join(process.cwd(), '.ki-os-packs.json');
}

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function defaultStore() {
  return {
    version: 'r20-v1',
    packs: [
      {
        packId: 'retail-reference-pack',
        name: 'Retail Reference Pack',
        vertical: 'retail',
        version: '1.0.0',
        status: 'active',
        description: 'Reference pack with workflow, policy, connector and UI bundles for retail/e-commerce scenarios.',
        schema: {
          version: '1.0',
          requiredBundles: ['workflowBundles', 'policyBundles', 'connectorBundles', 'uiBundles']
        },
        workflowBundles: [
          { bundleId: 'wf-retail-ops', name: 'Retail Ops Workflows', workflows: ['retail.ops.daily-brief', 'retail.incident.recovery', 'retail.campaign.review'] }
        ],
        policyBundles: [
          { bundleId: 'pol-retail-guard', name: 'Retail Guardrails', policies: ['privacy-guard', 'provider-call-governed', 'retail-budget-guard'] }
        ],
        connectorBundles: [
          { bundleId: 'conn-retail', name: 'Retail Connectors', connectors: ['memory-core', 'websearch-native', 'mcp-bridge'] }
        ],
        uiBundles: [
          { bundleId: 'ui-retail', name: 'Retail UI Views', views: ['workspace.commerce', 'executive.kpi', 'seller.marketplace'] }
        ],
        deployment: {
          defaultWorkspaceTemplate: { name: 'Retail Control Room', visibility: 'private' },
          recommendedTaskClasses: ['commerce', 'operations', 'research']
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    installations: []
  };
}

let state = load();

function load() {
  try {
    if (fs.existsSync(getStorePath())) {
      const parsed = JSON.parse(fs.readFileSync(getStorePath(), 'utf8'));
      return {
        version: parsed.version || 'r20-v1',
        packs: Array.isArray(parsed.packs) ? parsed.packs : defaultStore().packs,
        installations: Array.isArray(parsed.installations) ? parsed.installations : []
      };
    }
  } catch {}
  const initial = defaultStore();
  try { fs.writeFileSync(getStorePath(), JSON.stringify(initial, null, 2), 'utf8'); } catch {}
  return initial;
}

function persist() {
  try { fs.writeFileSync(getStorePath(), JSON.stringify(state, null, 2), 'utf8'); } catch {}
}

function resetPackStore() {
  state = defaultStore();
  persist();
  return state;
}

function listPacks() {
  return state.packs.map(summarizePack);
}

function summarizePack(pack) {
  return {
    packId: pack.packId,
    name: pack.name,
    vertical: pack.vertical,
    version: pack.version,
    status: pack.status,
    workflowBundles: Array.isArray(pack.workflowBundles) ? pack.workflowBundles.length : 0,
    policyBundles: Array.isArray(pack.policyBundles) ? pack.policyBundles.length : 0,
    connectorBundles: Array.isArray(pack.connectorBundles) ? pack.connectorBundles.length : 0,
    uiBundles: Array.isArray(pack.uiBundles) ? pack.uiBundles.length : 0,
    installedTenants: state.installations.filter((item) => item.packId === pack.packId).length,
    updatedAt: pack.updatedAt || pack.createdAt
  };
}

function getPack(packId) {
  return state.packs.find((item) => item.packId === packId) || null;
}

function normalizeArray(items, key) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (typeof item === 'string') return { [key]: item, name: item };
    return item;
  });
}

function upsertPack(input = {}) {
  const packId = String(input.packId || input.id || '').trim();
  if (!packId) throw new Error('packId_required');
  let pack = getPack(packId);
  if (!pack) {
    pack = { packId, createdAt: new Date().toISOString() };
    state.packs.push(pack);
  }
  pack.name = input.name || pack.name || packId;
  pack.vertical = input.vertical || pack.vertical || 'generic';
  pack.version = input.version || pack.version || '1.0.0';
  pack.status = input.status || pack.status || 'draft';
  pack.description = input.description || pack.description || '';
  pack.schema = Object.assign({ version: '1.0', requiredBundles: ['workflowBundles', 'policyBundles', 'connectorBundles', 'uiBundles'] }, pack.schema || {}, input.schema || {});
  pack.workflowBundles = normalizeArray(input.workflowBundles || pack.workflowBundles, 'bundleId');
  pack.policyBundles = normalizeArray(input.policyBundles || pack.policyBundles, 'bundleId');
  pack.connectorBundles = normalizeArray(input.connectorBundles || pack.connectorBundles, 'bundleId');
  pack.uiBundles = normalizeArray(input.uiBundles || pack.uiBundles, 'bundleId');
  pack.deployment = Object.assign({}, pack.deployment || {}, input.deployment || {});
  pack.updatedAt = new Date().toISOString();
  persist();
  return pack;
}

function selectBundles(pack, selection = {}) {
  const bundleSelections = {
    workflowBundles: new Set((selection.workflowBundleIds || []).map(String)),
    policyBundles: new Set((selection.policyBundleIds || []).map(String)),
    connectorBundles: new Set((selection.connectorBundleIds || []).map(String)),
    uiBundles: new Set((selection.uiBundleIds || []).map(String))
  };
  const out = {};
  for (const key of Object.keys(bundleSelections)) {
    const source = Array.isArray(pack[key]) ? pack[key] : [];
    const requested = bundleSelections[key];
    out[key] = requested.size ? source.filter((item) => requested.has(String(item.bundleId))) : source;
  }
  return out;
}

function flattenValues(items, field) {
  return [...new Set((items || []).flatMap((item) => Array.isArray(item[field]) ? item[field].map(String) : []))];
}

function validatePackManifest(pack) {
  const errors = [];
  const warnings = [];
  if (!pack || typeof pack !== 'object') return { valid: false, errors: ['pack_missing'], warnings: [] };
  if (!pack.packId || typeof pack.packId !== 'string' || String(pack.packId).trim() === '') errors.push('packId_required');
  if (!pack.name || typeof pack.name !== 'string') errors.push('name_required');
  if (!pack.version || typeof pack.version !== 'string') {
    errors.push('version_required');
  } else if (!/^\d+\.\d+(\.\d+)?/.test(pack.version)) {
    errors.push('version_invalid_semver');
  }
  if (pack.workflowBundles !== undefined) {
    if (!Array.isArray(pack.workflowBundles)) {
      errors.push('workflowBundles_must_be_array');
    } else {
      for (let i = 0; i < pack.workflowBundles.length; i++) {
        const item = pack.workflowBundles[i];
        if (typeof item === 'string') {
          warnings.push(`workflowBundles[${i}]_is_plain_string`);
        } else if (!item || typeof item !== 'object' || !item.bundleId) {
          errors.push(`workflowBundles[${i}]_missing_bundleId`);
        }
      }
    }
  }
  if (pack.policyBundles !== undefined && !Array.isArray(pack.policyBundles)) errors.push('policyBundles_must_be_array');
  if (pack.connectorBundles !== undefined && !Array.isArray(pack.connectorBundles)) errors.push('connectorBundles_must_be_array');
  if (pack.uiBundles !== undefined && !Array.isArray(pack.uiBundles)) errors.push('uiBundles_must_be_array');
  return { valid: errors.length === 0, errors, warnings };
}

function installPack(input = {}, ctx = {}) {
  const tenantId = String(input.tenantId || ctx?.pki?.tenantId || 'default');
  tenantService.assertTenantAccess(ctx, tenantId);
  const pack = getPack(String(input.packId || ''));
  if (!pack) {
    const error = new Error('pack_not_found');
    error.statusCode = 404;
    throw error;
  }
  const validation = validatePackManifest(pack);
  if (!validation.valid) {
    return { success: false, error: 'invalid_pack_manifest', errors: validation.errors };
  }
  const tenant = tenantService.getTenant(tenantId) || tenantService.upsertTenant({ tenantId, name: tenantId });
  const selected = selectBundles(pack, input);
  const policyIds = flattenValues(selected.policyBundles, 'policies');
  const connectorIds = flattenValues(selected.connectorBundles, 'connectors');
  const uiViews = flattenValues(selected.uiBundles, 'views');
  tenantService.upsertTenant({ tenantId, policies: [...new Set([...(tenant.policies || []), ...policyIds])], connectors: [...new Set([...(tenant.connectors || []), ...connectorIds])] });

  let workspace = null;
  if (input.workspace !== false) {
    const template = Object.assign({ name: `${pack.name} Workspace`, visibility: 'private' }, pack.deployment?.defaultWorkspaceTemplate || {}, input.workspace || {});
    workspace = tenantService.createWorkspace(tenantId, { workspaceId: String(template.workspaceId || `${pack.packId}-workspace`), name: template.name, visibility: template.visibility, members: input.members || [] });
  }

  const record = {
    installationId: `inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    packId: pack.packId,
    packName: pack.name,
    packVersion: pack.version,
    tenantId,
    policyIds,
    connectorIds,
    uiViews,
    workflowBundleIds: selected.workflowBundles.map((item) => item.bundleId),
    policyBundleIds: selected.policyBundles.map((item) => item.bundleId),
    connectorBundleIds: selected.connectorBundles.map((item) => item.bundleId),
    uiBundleIds: selected.uiBundles.map((item) => item.bundleId),
    workspaceId: workspace?.workspaceId || null,
    createdAt: new Date().toISOString(),
    installedBy: ctx?.pki?.userId || 'system'
  };
  state.installations.push(record);
  persist();
  Observability.emit('packs.installed', { packId: pack.packId, tenantId, installationId: record.installationId, policyCount: policyIds.length, connectorCount: connectorIds.length });
  return { success: true, item: record, workspace, selectedBundles: selected };
}

function listInstallations(filter = {}) {
  const tenantId = filter.tenantId ? String(filter.tenantId) : null;
  const packId = filter.packId ? String(filter.packId) : null;
  return state.installations.filter((item) => (!tenantId || item.tenantId === tenantId) && (!packId || item.packId === packId));
}

function getPackRegistryPayload() {
  return {
    success: true,
    version: '6.3.0-r20-vertical-pack-framework',
    registryVersion: state.version,
    totalPacks: state.packs.length,
    totalInstallations: state.installations.length,
    packs: listPacks()
  };
}

module.exports = {
  listPacks,
  getPack,
  upsertPack,
  validatePackManifest,
  installPack,
  listInstallations,
  getPackRegistryPayload,
  resetPackStore
};

/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const Observability = require('../core/observability.service');
const packService = require('../packs/pack.service');
const tenantService = require('../tenant/tenant.service');

const RETAIL_PACK_ID = 'ki-os-retail-ecommerce-v1';

function ensureRetailPack() {
  const existing = packService.getPack(RETAIL_PACK_ID);
  if (existing) return existing;
  return packService.upsertPack({
    packId: RETAIL_PACK_ID,
    name: 'KI-OS Retail / E-Commerce v1',
    vertical: 'retail-ecommerce',
    version: '1.0.0',
    status: 'active',
    description: 'Retail Ops cockpit, marketplace workflows, promo/pricing flows and executive KPI views.',
    workflowBundles: [
      { bundleId: 'wf-retail-ops', name: 'Retail Ops', workflows: ['retail.ops.store-brief', 'retail.ops.inventory-exception'] },
      { bundleId: 'wf-marketplace', name: 'Marketplace', workflows: ['marketplace.seller-health', 'marketplace.listing-fix'] },
      { bundleId: 'wf-promo-pricing', name: 'Promo & Pricing', workflows: ['promo.margin-check', 'pricing.competitor-adjust'] }
    ],
    policyBundles: [
      { bundleId: 'pol-retail-exec', name: 'Retail Governance', policies: ['provider-call-governed', 'privacy-guard', 'kill-switch-high-risk'] }
    ],
    connectorBundles: [
      { bundleId: 'conn-retail-data', name: 'Retail Data', connectors: ['memory-core', 'websearch-native', 'mcp-bridge'] }
    ],
    uiBundles: [
      { bundleId: 'ui-retail-views', name: 'Retail Views', views: ['retail.ops', 'retail.kpi', 'retail.marketplace', 'retail.executive'] }
    ],
    deployment: {
      defaultWorkspaceTemplate: { name: 'Retail & Commerce Workbench', visibility: 'private' },
      recommendedTaskClasses: ['commerce', 'operations', 'research']
    }
  });
}

function getRetailUseCases() {
  return [
    { useCaseId: 'store-ops-brief', title: 'Retail Ops Brief', category: 'operations', status: 'demo-ready' },
    { useCaseId: 'inventory-exception', title: 'Inventory Exception Handling', category: 'operations', status: 'demo-ready' },
    { useCaseId: 'seller-health', title: 'Seller / Marketplace Health', category: 'marketplace', status: 'pilot-ready' },
    { useCaseId: 'promo-margin-check', title: 'Promo / Pricing Margin Check', category: 'pricing', status: 'demo-ready' },
    { useCaseId: 'executive-kpi-view', title: 'Executive KPI Decision View', category: 'executive', status: 'pilot-ready' }
  ];
}

function getRetailOpsPayload() {
  return {
    success: true,
    view: 'retail.ops',
    incidents: [
      { id: 'stockout-risk', severity: 'high', title: 'Out-of-stock risk on top seller', storeCluster: 'south', owner: 'ops' },
      { id: 'campaign-drift', severity: 'medium', title: 'Campaign performance drift detected', storeCluster: 'west', owner: 'marketing' }
    ],
    actions: ['reroute stock', 'pause campaign', 'escalate supplier', 'create ops brief']
  };
}

function getKpiPayload() {
  return {
    success: true,
    view: 'retail.kpi',
    kpis: {
      revenue: { value: 1245000, trend: 'up', unit: 'EUR' },
      marginRate: { value: 0.286, trend: 'flat', unit: 'ratio' },
      outOfStockRate: { value: 0.034, trend: 'down', unit: 'ratio' },
      conversionRate: { value: 0.041, trend: 'up', unit: 'ratio' },
      adCostRatio: { value: 0.118, trend: 'down', unit: 'ratio' }
    },
    scorecard: ['revenue', 'marginRate', 'outOfStockRate', 'conversionRate', 'adCostRatio']
  };
}

function getMarketplacePayload() {
  return {
    success: true,
    view: 'retail.marketplace',
    workflows: [
      { workflowId: 'seller-health', status: 'active', owner: 'marketplace' },
      { workflowId: 'listing-fix', status: 'active', owner: 'content' },
      { workflowId: 'buybox-variance', status: 'pilot', owner: 'pricing' }
    ]
  };
}

function getPromoPayload(input = {}) {
  const basePrice = Number(input.basePrice || 99);
  const promoPrice = Number(input.promoPrice || 89);
  const cost = Number(input.cost || 61);
  const marginBefore = Number(((basePrice - cost) / basePrice).toFixed(4));
  const marginAfter = Number(((promoPrice - cost) / promoPrice).toFixed(4));
  return {
    success: true,
    view: 'retail.promo',
    basePrice,
    promoPrice,
    cost,
    marginBefore,
    marginAfter,
    decision: marginAfter >= 0.2 ? 'approved' : 'review',
    actions: marginAfter >= 0.2 ? ['launch campaign', 'monitor uplift'] : ['review discount', 'request buyer approval']
  };
}

function getExecutivePayload() {
  const kpis = getKpiPayload().kpis;
  return {
    success: true,
    view: 'retail.executive',
    decisions: [
      'Protect margin on low-stock SKUs',
      'Increase marketplace focus for top converting category',
      'Reallocate campaign budget to higher-conversion cluster'
    ],
    summary: {
      revenue: kpis.revenue.value,
      marginRate: kpis.marginRate.value,
      riskLevel: 'moderate',
      recommendedMode: 'optimize-growth'
    }
  };
}

function getRetailRootPayload(ctx = {}) {
  const pack = ensureRetailPack();
  return {
    success: true,
    version: '6.3.1-r21-retail-ecommerce-v1',
    tenantId: ctx?.pki?.tenantId || 'default',
    pack: packService.getPack(pack.packId),
    useCases: getRetailUseCases(),
    views: ['retail.ops', 'retail.kpi', 'retail.marketplace', 'retail.promo', 'retail.executive']
  };
}

function installRetailDemo(input = {}, ctx = {}) {
  const pack = ensureRetailPack();
  const tenantId = String(input.tenantId || ctx?.pki?.tenantId || 'default');
  tenantService.upsertTenant({ tenantId, name: input.tenantName || tenantId, billingPlan: 'retail-pilot' });
  const result = packService.installPack({ packId: pack.packId, tenantId, workspace: input.workspace || { name: 'Retail Pilot Workspace' } }, ctx);
  Observability.emit('retail.demo.installed', { tenantId, packId: pack.packId, installationId: result.item.installationId });
  return { success: true, packId: pack.packId, installation: result.item, workspace: result.workspace, useCases: getRetailUseCases() };
}

module.exports = {
  RETAIL_PACK_ID,
  ensureRetailPack,
  getRetailUseCases,
  getRetailRootPayload,
  getRetailOpsPayload,
  getKpiPayload,
  getMarketplacePayload,
  getPromoPayload,
  getExecutivePayload,
  installRetailDemo
};

/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const { assertRole } = require('../ui/ui.auth');
const service = require('./tenant.service');

async function handleTenantRequest(path, method, payload = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  if (path === '/tenants/core' && method === 'GET') {
    return { statusCode: 200, body: service.getProductCorePayload() };
  }
  if (path === '/tenants' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: service.listTenants() } };
  }
  if (path === '/tenants' && method === 'POST') {
    return { statusCode: 200, body: { success: true, item: service.upsertTenant(payload) } };
  }
  if (path === '/tenants/isolation' && method === 'GET') {
    const requestedTenantId = String(payload.tenantId || ctx?.pki?.tenantId || 'default');
    return { statusCode: 200, body: { success: true, ...service.buildIsolationPayload(ctx, requestedTenantId) } };
  }
  if (path === '/tenants/workspaces' && method === 'POST') {
    service.assertTenantAccess(ctx, payload.tenantId);
    return { statusCode: 200, body: { success: true, item: service.createWorkspace(payload.tenantId, payload) } };
  }
  if (path === '/tenants/projects' && method === 'POST') {
    service.assertTenantAccess(ctx, payload.tenantId);
    return { statusCode: 200, body: { success: true, item: service.createProject(payload.tenantId, payload) } };
  }
  if (path === '/tenants/orgs' && method === 'POST') {
    service.assertTenantAccess(ctx, payload.tenantId);
    return { statusCode: 200, body: { success: true, item: service.createOrg(payload.tenantId, payload) } };
  }
  if (path === '/tenants/billing/hooks' && method === 'POST') {
    service.assertTenantAccess(ctx, payload.tenantId);
    return { statusCode: 200, body: { success: true, item: service.addBillingHook(payload.tenantId, payload) } };
  }
  if (path === '/ui/tenants' && method === 'GET') {
    return { statusCode: 200, body: { ...service.getProductCorePayload(), items: service.listTenants(), traceId: ctx.traceId, ui: true } };
  }
  if (/^\/tenants\/[^/]+\/policies\/effective$/.test(path) && method === 'GET') {
    const tenantId = decodeURIComponent(path.split('/')[2]);
    service.assertTenantAccess(ctx, tenantId);
    const item = service.getEffectivePolicyView(tenantId);
    if (!item) return { statusCode: 404, body: { success: false, error: 'tenant_not_found', tenantId } };
    return { statusCode: 200, body: { success: true, item } };
  }
  if (/^\/tenants\/[^/]+\/policies\/override$/.test(path) && method === 'POST') {
    const tenantId = decodeURIComponent(path.split('/')[2]);
    service.assertTenantAccess(ctx, tenantId);
    return { statusCode: 200, body: { success: true, item: service.setTenantPolicyOverride(tenantId, payload.overrides || payload) } };
  }
  if (path.startsWith('/tenants/') && method === 'GET') {
    const tenantId = decodeURIComponent(path.split('/').pop());
    service.assertTenantAccess(ctx, tenantId);
    const tenant = service.getTenant(tenantId);
    if (!tenant) return { statusCode: 404, body: { success: false, error: 'tenant_not_found', tenantId } };
    return { statusCode: 200, body: { success: true, item: tenant } };
  }
  return { statusCode: 404, body: { success: false, error: 'tenant_route_not_found' } };
}

module.exports = { handleTenantRequest };

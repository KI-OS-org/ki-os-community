/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const runtimeStore = require('../ui/runtime.store');
const rateLimit = require('../core/rate-limit.service');

const circuitBreaker = require('../resilience/circuit-breaker.service');
const dlq = require('../resilience/dlq.service');
const tenantService = require('../tenant/tenant.service');
const economic = require('../economic/economic.service');
const dagRuntime = require('../dag/dag.runtime.service');

function buildBackendsPayload() {
  return {
    success: true,
    items: {
      runtime: runtimeStore.getBackendInfo(),
      circuitBreaker: circuitBreaker.getSnapshot().backend,
      dlq: dlq.getSnapshot().backend,
      tenants: tenantService.getProductCorePayload().backend,
      economic: economic.getEconomicPayload().backend,
      dagRegistry: dagRuntime.getDagRegistryInfo()
    }
  };
}

function buildFabricPayload() {
  const runtime = runtimeStore.exportState();
  const limiter = rateLimit.getRateLimitSnapshot();
  return {
    success: true,
    version: 'v1',
    lambdaReady: Boolean(process.env.KI_OS_SHARED_STATE_ENABLED || process.env.RUNTIME_STORE_PATH || process.env.RATE_LIMIT_PERSIST_PATH),
    runtime: {
      backend: runtime.backend,
      metrics: runtimeStore.getMetrics(),
      runs: runtime.store.runs.length
    },
    rateLimit: {
      backend: limiter.backend,
      totalBuckets: limiter.totalBuckets
    }
  };
}

async function handleStateFabricRequest(path, method, payload = {}, ctx = {}) {
  if (path === '/state/fabric' && method === 'GET') {
    return { statusCode: 200, body: buildFabricPayload() };
  }
  if (path === '/state/runtime' && method === 'GET') {
    return { statusCode: 200, body: { success: true, ...runtimeStore.exportState(), metrics: runtimeStore.getMetrics() } };
  }
  if (path === '/state/runtime/import' && method === 'POST') {
    return { statusCode: 200, body: { success: true, imported: runtimeStore.importState(payload) } };
  }
  if (path === '/state/rate-limit' && method === 'GET') {
    return { statusCode: 200, body: { success: true, ...rateLimit.getRateLimitSnapshot() } };
  }
  if (path === '/state/rate-limit/import' && method === 'POST') {
    return { statusCode: 200, body: { success: true, imported: rateLimit.importRateLimitSnapshot(payload) } };
  }
  if (path === '/state/backends' && method === 'GET') {
    return { statusCode: 200, body: buildBackendsPayload() };
  }
  if (path === '/state/backends/health' && method === 'GET') {
    const payload = buildBackendsPayload();
    return { statusCode: 200, body: { ...payload, healthy: true } };
  }
  if (path === '/state/export' && method === 'GET') {
    return {
      statusCode: 200,
      body: {
        success: true,
        version: 'v1',
        exportedAt: new Date().toISOString(),
        runtime: runtimeStore.exportState(),
        rateLimit: rateLimit.getRateLimitSnapshot(),
        requestedBy: ctx?.pki?.userId || 'guest'
      }
    };
  }
  if (path === '/state/import' && method === 'POST') {
    const importedRuntime = runtimeStore.importState(payload.runtime || {});
    const importedRateLimit = rateLimit.importRateLimitSnapshot(payload.rateLimit || {});
    return {
      statusCode: 200,
      body: {
        success: true,
        version: 'v1',
        runtime: importedRuntime,
        rateLimit: importedRateLimit
      }
    };
  }
  if (path === '/ui/state/fabric' && method === 'GET') {
    return { statusCode: 200, body: { ...buildFabricPayload(), traceId: ctx.traceId, ui: true } };
  }
  return { statusCode: 404, body: { success: false, error: 'state_fabric_not_found' } };
}

module.exports = { handleStateFabricRequest, buildFabricPayload, buildBackendsPayload };

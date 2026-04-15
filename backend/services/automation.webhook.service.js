/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: automation.webhook.service.js
 * Diese Datei bildet den Webhook-Dispatcher für KI-OS und steuert Outbound- und Callback-Verarbeitung für Hub-Integrationen.
 */

'use strict';

const crypto = require('node:crypto');
let axios = global.__KIOS_AXIOS__ || null;
if (!axios) {
  try {
    axios = require('axios');
  } catch {
    axios = async () => { throw new Error('axios_missing'); };
  }
}
const { getWebhookConfig, findWebhookConfigByHubFlow } = require('./automation.config.service');
const logger = require('./core/logger.service');

const ZAPIER_URL =
  process.env.AUTOMATION_ZAPIER_WEBHOOK_URL ||
  process.env.ZAPIER_WEBHOOK_URL ||
  '';

const N8N_URL =
  process.env.AUTOMATION_N8N_WEBHOOK_URL ||
  process.env.N8N_WEBHOOK_URL ||
  '';

const SHARED_SECRET = process.env.AUTOMATION_WEBHOOK_SECRET || '';

function buildRequestId() {
  return `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function resolveSecret(config = {}) {
  const raw = config.secretRef || config.secret || '';
  if (typeof raw === 'string' && raw.startsWith('env:')) {
    return process.env[raw.slice(4)] || '';
  }
  return raw || '';
}

function buildEnvelope({ event, channel, source, user, osVersion, data, hub, flowId, requestId, testMode }) {
  return {
    event,
    channel: channel || 'default',
    source: source || 'ki-os',
    hub: hub || undefined,
    flowId: flowId || undefined,
    requestId: requestId || buildRequestId(),
    testMode: !!testMode,
    os: {
      name: 'KI-OS',
      version: osVersion || 'unknown'
    },
    user: {
      id: user && user.userId ? user.userId : 'guest',
      tenantId: user && user.tenantId ? user.tenantId : 'default',
      role: user && user.role ? user.role : undefined,
      plan: user && user.subscription ? user.subscription.plan : undefined
    },
    data,
    ts: new Date().toISOString()
  };
}

async function postWebhookRaw({ name, url, method = 'POST', payload, headers = {}, timeoutMs = 8000 }) {
  if (!url) {
    logger.warn('automation.webhook.skipped', { name, reason: 'url_missing' });
    return { skipped: true, reason: 'url_missing' };
  }

  const finalHeaders = Object.assign(
    { 'content-type': 'application/json' },
    headers || {}
  );

  if (SHARED_SECRET && !finalHeaders['x-automation-secret'] && !finalHeaders.Authorization) {
    finalHeaders['x-automation-secret'] = SHARED_SECRET;
  }

  try {
    const res = await axios({
      url,
      method: method || 'POST',
      data: payload,
      headers: finalHeaders,
      timeout: timeoutMs
    });

    return {
      skipped: false,
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      data: res.data
    };
  } catch (e) {
    logger.error('automation.webhook.error', { name, error: e.message, code: e.code || null });
    return { skipped: false, error: e.message, code: e.code || null };
  }
}

async function dispatchHubWebhook(config, payload, options = {}) {
  if (!config) {
    throw new Error('dispatchHubWebhook: config is required');
  }

  if (config.active === false || config.enabled === false) {
    return { success: false, skipped: true, reason: 'config_inactive', id: config.id || null };
  }

  const requestId = options.requestId || buildRequestId();
  const secret = resolveSecret(config);
  const headers = Object.assign({}, config.headers || {}, options.headers || {});
  if (secret && !headers.Authorization && !headers['x-automation-secret']) {
    headers.Authorization = `Bearer ${secret}`;
  }
  headers['X-KIOS-Hub'] = config.hub || options.hub || 'http';
  headers['X-KIOS-Flow'] = config.flowId || options.flowId || config.id;
  headers['X-KIOS-Request-Id'] = requestId;

  const response = await postWebhookRaw({
    name: config.description || `automation:${config.id || config.flowId || 'webhook'}`,
    url: config.url || config.targetUrl || '',
    method: config.method || 'POST',
    payload,
    headers,
    timeoutMs: Number(config.timeoutMs || options.timeoutMs || 8000)
  });

  return {
    success: !response.error,
    id: config.id || null,
    hub: config.hub || options.hub || 'http',
    flowId: config.flowId || options.flowId || config.id,
    requestId,
    result: response
  };
}

async function triggerAutomationEvent(params) {
  const {
    event,
    data,
    channel = 'default',
    provider = 'both',
    user = {},
    osVersion
  } = params || {};

  if (!event) {
    throw new Error('triggerAutomationEvent: "event" is required');
  }

  const envelope = buildEnvelope({
    event,
    channel,
    source: 'ki-os',
    user,
    osVersion,
    data
  });

  const results = {};

  if (provider === 'zapier' || provider === 'both') {
    results.zapier = await postWebhookRaw({
      name: 'Zapier',
      url: ZAPIER_URL,
      method: 'POST',
      payload: envelope
    });
  }
  if (provider === 'n8n' || provider === 'both') {
    results.n8n = await postWebhookRaw({
      name: 'n8n',
      url: N8N_URL,
      method: 'POST',
      payload: envelope
    });
  }

  return {
    success: true,
    event,
    channel,
    provider,
    results
  };
}

async function triggerConfiguredAutomation(id, params = {}) {
  if (!id) {
    throw new Error('triggerConfiguredAutomation: "id" is required');
  }

  const cfg = await getWebhookConfig(id);
  if (!cfg) {
    throw new Error(`triggerConfiguredAutomation: keine Konfiguration für ID "${id}" gefunden`);
  }

  const defaultData = cfg.defaultData || {};
  const runtimeData = params.data || {};
  const payload = Object.assign({}, defaultData, runtimeData);
  const envelope = buildEnvelope({
    event: params.event || cfg.event || `flow.${cfg.flowId || id}`,
    channel: params.channel || cfg.channel || 'automation',
    source: params.source || 'ki-os',
    user: params.user || {},
    osVersion: params.osVersion,
    data: payload,
    hub: cfg.hub,
    flowId: cfg.flowId,
    requestId: params.requestId,
    testMode: params.testMode
  });

  return dispatchHubWebhook(cfg, envelope, {
    requestId: envelope.requestId,
    headers: params.headers,
    timeoutMs: params.timeoutMs
  });
}

async function triggerHubWebhook(hub, flowId, params = {}) {
  if (!hub || !flowId) {
    throw new Error('triggerHubWebhook: "hub" and "flowId" are required');
  }
  const cfg = await findWebhookConfigByHubFlow(hub, flowId);
  if (!cfg) {
    throw new Error(`triggerHubWebhook: keine Konfiguration für ${hub}/${flowId} gefunden`);
  }
  return triggerConfiguredAutomation(cfg.id, Object.assign({}, params, { requestId: params.requestId || buildRequestId() }));
}

function validateInboundWebhook(config, headers = {}) {
  const incomingSecret =
    headers['x-automation-secret'] ||
    headers['X-Automation-Secret'] ||
    headers.authorization ||
    headers.Authorization ||
    '';

  const expectedSecret = resolveSecret(config) || SHARED_SECRET;
  if (!expectedSecret) return { ok: true };

  const bearer = String(incomingSecret).startsWith('Bearer ') ? String(incomingSecret).slice(7) : String(incomingSecret);
  if (bearer !== expectedSecret) {
    return { ok: false, error: 'Unauthorized: invalid automation secret' };
  }
  return { ok: true };
}

async function handleHubCallback(hub, flowId, body, ctx = {}) {
  const cfg = await findWebhookConfigByHubFlow(hub, flowId);
  if (!cfg) {
    return { success: false, error: 'Unknown hub flow', hub, flowId };
  }

  const auth = validateInboundWebhook(cfg, ctx.headers || {});
  if (!auth.ok) return { success: false, error: auth.error, hub, flowId };

  return {
    success: true,
    mode: 'callback',
    hub,
    flowId,
    receivedAt: new Date().toISOString(),
    requestId: body.requestId || body.request_id || null,
    status: body.status || 'received',
    executionId: body.executionId || body.execution_id || null,
    result: body.result || body.data || body.payload || body
  };
}

async function handleAutomationWebhook(body, ctx = {}) {
  const headers = ctx.headers || {};
  const auth = validateInboundWebhook({}, headers);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { pki } = ctx || {};
  const event = body.event || body.type || 'generic.event';
  const source = body.source || body._source || 'external';
  const data = body.data || body.payload || body;

  return {
    success: true,
    mode: 'inbound',
    receivedAt: new Date().toISOString(),
    event,
    source,
    user: {
      id: pki && pki.userId ? pki.userId : 'guest',
      tenantId: pki && pki.tenantId ? pki.tenantId : 'default'
    },
    data
  };
}

module.exports = {
  buildEnvelope,
  triggerAutomationEvent,
  triggerConfiguredAutomation,
  triggerHubWebhook,
  dispatchHubWebhook,
  handleAutomationWebhook,
  handleHubCallback,
  validateInboundWebhook,
  resolveSecret
};

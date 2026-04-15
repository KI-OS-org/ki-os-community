/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: admin.controller.js
 * Diese Datei bündelt Admin-Endpunkte und Steuerlogik für Konfiguration, Tests und Verwaltungsfunktionen im KI-OS Backend.
 */

'use strict';
const os = require('os');
const { updatePolicyConfig, getConfig } = require('./router.policy');
const Telemetry = require('./core/system-view.service');
const { saveWebhookConfig, listWebhookConfigs } = require('./automation.config.service');
const { triggerConfiguredAutomation } = require('./automation.webhook.service');

async function handleAdminRequest(path, method, body) {
  if (path.includes('status') && method === 'GET') {
    const config = await getConfig();
    const telemetry = Telemetry.getStats();

    return {
      status: 'online',
      os_level: '5.0-Governance',
      router_config: config,
      telemetry,
      system: {
        uptime: process.uptime(),
        load: os.loadavg()
      }
    };
  }

  if (path.includes('automation/webhooks') && method === 'GET') {
    return await listWebhookConfigs();
  }

  if (path.includes('automation/webhook/test') && method === 'POST') {
    if (!body || !body.id) return { success: false, error: 'Missing webhook id for test run' };
    return await triggerConfiguredAutomation(body.id, {
      data: body.data || {},
      testMode: true,
      source: 'admin_test'
    });
  }

  if (path.includes('automation/webhook') && method === 'POST') {
    return await saveWebhookConfig(body || {});
  }

  if (path.includes('config') && method === 'POST') {
    if (body && body.router_weights) {
      await updatePolicyConfig(body.router_weights);
      return { success: true, message: 'Router Weights Updated' };
    }
  }

  return { error: 'Unknown Command' };
}

module.exports = { handleAdminRequest };

/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: n8n.sidecar.service.js
 * n8n API-Client + Sidecar-Manager.
 * @license AGPL-3.0-only
 */
'use strict';
const http = require('http');
const https = require('https');
const url = require('url');
const { env } = process;

const N8N_API_URL = env.N8N_API_URL;
const N8N_API_KEY = env.N8N_API_KEY;
const N8N_ENABLED = env.N8N_ENABLED === 'true';

const callbackRegistry = new Map();

const _apiRequest = (method, path, body) => {
  if (!N8N_API_URL) {
    return Promise.reject({ success: false, reason: 'n8n_not_configured' });
  }

  const parsedUrl = url.parse(N8N_API_URL);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: `${parsedUrl.pathname}${path}`,
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${N8N_API_KEY}`
    },
    timeout: 5000
  };

  return new Promise((resolve, reject) => {
    const req = (parsedUrl.protocol === 'https:' ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject({ success: false, reason: 'http_error', statusCode: res.statusCode, data });
        }
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (error) {
          reject({ success: false, reason: 'invalid_response' });
        }
      });
    });

    req.on('error', (error) => {
      reject({ success: false, reason: error.message });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
};

const _apiGet = (path) => _apiRequest('GET', path);
const _apiPost = (path, body) => _apiRequest('POST', path, body);

const isEnabled = () => Boolean(N8N_API_URL);

const onInbound = (event, handler) => registerCallback(event, handler);

const getStatus = async () => {
  if (!isEnabled()) {
    return { enabled: false, connected: false, version: null, workflowCount: null, lastCheckedAt: null };
  }

  try {
    const status = await _apiGet('/status');
    return {
      enabled: true,
      connected: true,
      version: status.version,
      workflowCount: status.workflowCount,
      lastCheckedAt: new Date()
    };
  } catch (error) {
    return { connected: false, version: null, workflowCount: null, lastCheckedAt: new Date() };
  }
};

const listWorkflows = async () => {
  if (!N8N_ENABLED) {
    return [];
  }

  try {
    const workflows = await _apiGet('/workflows');
    return workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      updatedAt: workflow.updatedAt
    }));
  } catch (error) {
    return [];
  }
};

const triggerWorkflow = async (workflowId, payload) => {
  if (!N8N_ENABLED) {
    return { success: false, reason: 'n8n_not_enabled' };
  }

  try {
    const response = await _apiPost(`/executions/workflow/${workflowId}`, payload);
    return { success: true, executionId: response.id };
  } catch (error) {
    return { success: false, reason: error.reason };
  }
};

const getExecution = async (executionId) => {
  if (!N8N_ENABLED) {
    return { success: false, reason: 'n8n_not_enabled' };
  }

  try {
    const execution = await _apiGet(`/executions/${executionId}`);
    return { id: execution.id, status: execution.status, data: execution.data };
  } catch (error) {
    return { success: false, reason: error.reason };
  }
};

const registerCallback = (event, handler) => {
  if (callbackRegistry.has(event)) {
    const handlers = callbackRegistry.get(event);
    if (!handlers.includes(handler)) {
      handlers.push(handler);
    }
  } else {
    callbackRegistry.set(event, [handler]);
  }
};

const emitInbound = (event, payload) => {
  if (callbackRegistry.has(event)) {
    callbackRegistry.get(event).forEach((handler) => handler(payload));
  }
};

const getCallbackRegistry = () => Array.from(callbackRegistry.keys());

module.exports = {
  isEnabled,
  onInbound,
  getStatus,
  listWorkflows,
  triggerWorkflow,
  getExecution,
  registerCallback,
  emitInbound,
  getCallbackRegistry
};
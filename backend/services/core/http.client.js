/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
'use strict';
let axios = null;
try { axios = require('axios'); } catch {}

async function fallbackRequest(method, url, data, config = {}) {
  const headers = { ...(config.headers || {}) };
  const opts = { method: String(method || 'GET').toUpperCase(), headers };
  const timeoutMs = Number(config.timeout || config.timeoutMs || 0);
  if (data !== undefined && opts.method !== 'GET' && opts.method !== 'HEAD') {
    if (Buffer.isBuffer(data)) {
      opts.body = data;
    } else if (typeof data === 'string') {
      opts.body = data;
      if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'text/plain; charset=utf-8';
    } else {
      opts.body = JSON.stringify(data);
      if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json';
    }
  }
  const ctrl = timeoutMs > 0 ? new AbortController() : null;
  let timer = null;
  if (ctrl) { opts.signal = ctrl.signal; timer = setTimeout(() => ctrl.abort(), timeoutMs); }
  try {
    const res = await fetch(url, opts);
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    let body;
    if (contentType.includes('application/json')) body = await res.json();
    else if (config.responseType === 'arraybuffer') body = Buffer.from(await res.arrayBuffer());
    else body = await res.text();
    const response = { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), data: body };
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.response = response;
      throw err;
    }
    return response;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function request(config = {}) {
  if (axios && typeof axios.request === 'function') return axios.request(config);
  return fallbackRequest(config.method || 'GET', config.url, config.data, config);
}
async function post(url, data, config = {}) {
  if (axios && typeof axios.post === 'function') return axios.post(url, data, config);
  return fallbackRequest('POST', url, data, config);
}
async function get(url, config = {}) {
  if (axios && typeof axios.get === 'function') return axios.get(url, config);
  return fallbackRequest('GET', url, undefined, config);
}
module.exports = { request, post, get };

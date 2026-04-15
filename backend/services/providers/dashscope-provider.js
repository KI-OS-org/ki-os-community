/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 *
 * Datei: backend/services/providers/dashscope-provider.js
 *
 * DashScopeProvider — Alibaba Cloud DashScope (Qwen) API Provider
 *
 * Wird verwendet von: backend/services/agent/qwen.builder.agent.js
 *
 * API: https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation
 * Auth: Authorization: Bearer <DASHSCOPE_API_KEY>
 * Modelle: qwen-coder-plus, qwen-coder-plus-latest, qwen-long, qwen-turbo, qwen-max
 */

'use strict';

const https = require('https');
const http  = require('http');

class DashScopeProvider {
  /**
   * @param {Object} config
   * @param {string}  config.apiKey    — DASHSCOPE_API_KEY
   * @param {string}  [config.apiBase] — Base URL (ohne trailing slash)
   * @param {boolean} [config.enabled] — false disables all calls
   * @param {number}  [config.timeout] — Request timeout in ms (default 60000)
   */
  constructor(config = {}) {
    this.apiKey  = config.apiKey  || '';
    this.apiBase = (config.apiBase || 'https://dashscope-intl.aliyuncs.com/api/v1').replace(/\/$/, '');
    this.enabled = typeof config.enabled === 'boolean' ? config.enabled : !!this.apiKey;
    this.timeout = config.timeout || 60000;
  }

  /**
   * Call Qwen chat completion.
   *
   * @param {Object}   opts
   * @param {string}   opts.model       — e.g. 'qwen-coder-plus'
   * @param {Array}    opts.messages    — OpenAI-compatible message array
   * @param {number}   [opts.temperature=0.2]
   * @param {number}   [opts.maxTokens=4096]
   *
   * @returns {Promise<{success: boolean, content: string, usage?: Object, model?: string}>}
   */
  async chat({ model, messages, temperature = 0.2, maxTokens = 4096 }) {
    if (!this.enabled) {
      return { success: false, content: '', error: 'DashScopeProvider not enabled (no API key)' };
    }

    const endpoint = `${this.apiBase}/services/aigc/text-generation/generation`;

    const payload = JSON.stringify({
      model,
      input: {
        messages,
      },
      parameters: {
        temperature,
        max_tokens:   maxTokens,
        result_format: 'message',
      },
    });

    try {
      const raw = await this._request(endpoint, payload);
      const data = JSON.parse(raw);

      // DashScope error response
      if (data.code && data.code !== 'Success') {
        return {
          success: false,
          content: '',
          error: `DashScope API error: ${data.code} — ${data.message || ''}`,
          raw: data,
        };
      }

      const content = data?.output?.choices?.[0]?.message?.content ?? '';

      return {
        success: true,
        content,
        model,
        usage: data.usage ?? null,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        error: err.message,
      };
    }
  }

  // ─── Internal HTTP ────────────────────────────────────────────────────────

  _request(urlStr, body) {
    return new Promise((resolve, reject) => {
      const url    = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const lib    = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname + url.search,
        method:   'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: this.timeout,
      };

      const req = lib.request(options, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      });

      req.on('timeout', () => {
        req.destroy(new Error(`DashScopeProvider: request timeout after ${this.timeout}ms`));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

module.exports = DashScopeProvider;

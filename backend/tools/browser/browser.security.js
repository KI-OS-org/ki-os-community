/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: browser.security.js
 * Security checks, rate limiting and audit logging for browser tools.
 * @license AGPL-3.0-only
 */

'use strict';

const logger = require('../../services/core/logger.service');

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RATE_LIMIT = 10;
const DEFAULT_RATE_WINDOW_MS = 60 * 1000;
const DEFAULT_ALLOWLIST = ['localhost', '127.0.0.1', '::1', '*.ki-os.org', 'ki-os.org'];

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAllowlist(value) {
  const entries = parseCsv(value);
  return entries.length > 0 ? entries : DEFAULT_ALLOWLIST;
}

function normalizeHost(hostname) {
  return String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
}

function matchesDomain(hostname, pattern) {
  const host = normalizeHost(hostname);
  const allowed = normalizeHost(pattern);

  if (!allowed) return false;
  if (allowed === '*') return true;
  if (allowed.startsWith('*.')) {
    const suffix = allowed.slice(2);
    return host.endsWith(`.${suffix}`);
  }
  return host === allowed;
}

class BrowserSecurity {
  constructor(options = {}) {
    this.allowlist = options.allowlist || parseAllowlist(process.env.BROWSER_DOMAIN_ALLOWLIST);
    this.timeoutMs = Number(options.timeoutMs || process.env.BROWSER_ACTION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    this.rateLimit = Number(options.rateLimit || process.env.BROWSER_RATE_LIMIT_PER_MINUTE || DEFAULT_RATE_LIMIT);
    this.rateWindowMs = Number(options.rateWindowMs || DEFAULT_RATE_WINDOW_MS);
    this.clock = options.clock || (() => Date.now());
    this.auditLogger = options.auditLogger || logger;
    this.requests = [];
  }

  assertUrlAllowed(url) {
    let parsed;
    try {
      parsed = new URL(String(url));
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Blocked protocol: ${parsed.protocol}`);
    }

    if (!this.allowlist.some((domain) => matchesDomain(parsed.hostname, domain))) {
      throw new Error(`Domain not allowed: ${parsed.hostname}`);
    }

    return parsed;
  }

  assertRateLimit() {
    const now = this.clock();
    const windowStart = now - this.rateWindowMs;
    this.requests = this.requests.filter((timestamp) => timestamp > windowStart);

    if (this.requests.length >= this.rateLimit) {
      throw new Error(`Browser rate limit exceeded: max ${this.rateLimit} requests/minute`);
    }

    this.requests.push(now);
  }

  checkAction({ url } = {}) {
    this.assertRateLimit();
    if (url) this.assertUrlAllowed(url);
  }

  audit(action, details = {}) {
    const entry = {
      action,
      timestamp: new Date(this.clock()).toISOString(),
      user: details.user || 'system',
      url: details.url || null,
      selector: details.selector || null
    };

    this.auditLogger.info('browser.action', entry);
    return entry;
  }

  async withTimeout(operation, timeoutMs = this.timeoutMs) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(operation),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`Browser action timed out after ${timeoutMs}ms`)), timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

module.exports = {
  BrowserSecurity,
  DEFAULT_ALLOWLIST,
  DEFAULT_RATE_LIMIT,
  DEFAULT_TIMEOUT_MS,
  matchesDomain,
  parseAllowlist
};

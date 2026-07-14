/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

/**
 * Extracts client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  if (process.env.TRUST_PROXY === 'true' && req.headers['x-forwarded-for']) {
    const forwarded = req.headers['x-forwarded-for'].split(',')[0];
    return forwarded.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Creates IP-based rate limiting middleware
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests allowed in window
 * @param {string} [options.message] - Error message for 429 responses
 * @returns {Function} Express middleware function
 */
function createIpRateLimiter({ windowMs, max, message }) {
  const store = new Map();

  return function ipRateLimiter(req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or initialize IP entry
    let entry = store.get(ip);
    if (!entry) {
      entry = { count: 0, windowStart: now };
      store.set(ip, entry);
    }

    // Reset window if expired
    if (entry.windowStart < windowStart) {
      entry.count = 0;
      entry.windowStart = now;
    }

    // Check rate limit
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil((entry.windowStart + windowMs) / 1000));

      res.status(429).json({
        error: message || 'Too many requests',
        retryAfter
      });
      return;
    }

    // Increment count and set headers
    entry.count++;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - entry.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil((entry.windowStart + windowMs) / 1000));

    // Clean up store if too large
    if (store.size > 10000) {
      const expiredKeys = [];
      for (const [key, value] of store.entries()) {
        if (value.windowStart < windowStart) {
          expiredKeys.push(key);
        }
      }
      expiredKeys.forEach(key => store.delete(key));
    }

    next();
  };
}

module.exports = { createIpRateLimiter };

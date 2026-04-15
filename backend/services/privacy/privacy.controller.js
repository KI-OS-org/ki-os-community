/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const { detectPII, maskPII, demaskPII } = require('./privacy.guard');

async function handlePrivacyRequest(pathname, method, body = {}, ctx = {}) {
  if (pathname === '/privacy' && method === 'GET') {
    return { statusCode: 200, body: { success: true, endpoints: ['/privacy/analyze', '/privacy/mask', '/privacy/demask'] } };
  }
  if (pathname === '/privacy/analyze' && method === 'POST') {
    const text = String(body.text || '');
    return { statusCode: 200, body: { success: true, traceId: ctx.traceId || null, ...detectPII(text) } };
  }
  if (pathname === '/privacy/mask' && method === 'POST') {
    const res = maskPII(String(body.text || ''), { preserveType: true });
    return { statusCode: 200, body: { success: true, traceId: ctx.traceId || null, masked: res.masked, changed: res.changed, findings: res.findings, tokens: res.tokens } };
  }
  if (pathname === '/privacy/demask' && method === 'POST') {
    const res = demaskPII(String(body.text || ''), body.tokens || []);
    return { statusCode: 200, body: { success: true, traceId: ctx.traceId || null, restored: res.restored } };
  }
  return { statusCode: 404, body: { success: false, error: 'Unknown privacy route', path: pathname, method } };
}

module.exports = { handlePrivacyRequest };

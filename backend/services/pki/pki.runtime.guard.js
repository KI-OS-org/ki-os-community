/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
function assertProductionPki() {
  const env = String(process.env.NODE_ENV || 'development').toLowerCase();
  const pkiEnabled = String(process.env.PKI_ENABLED || 'false').toLowerCase() === 'true';
  if (env === 'production' && !pkiEnabled) {
    const error = new Error('production_pki_required');
    error.statusCode = 503;
    error.details = { env, pkiEnabled };
    throw error;
  }
  return { ok: true, env, pkiEnabled };
}
module.exports = { assertProductionPki };
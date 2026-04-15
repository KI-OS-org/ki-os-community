'use strict';

/**
 * KI-OS Edition Guard
 * (c) 2026 Ingo Schaffer — https://ki-os.org
 */

const { isEnterprise, hasFeature, getInfo, getEdition } = require('./elefant.service');
const crypto = require('crypto');
const fs     = require('fs');

const _HK = 'KIOS_E7_HASH';

function _sh() {
  try {
    const src = fs.readFileSync(__filename, 'utf8');
    return crypto.createHash('sha256').update(src.split('const _HK')[0]).digest('hex');
  } catch { return null; }
}

if (!process.env[_HK]) process.env[_HK] = _sh();

function resolveEdition() { return getEdition(); }

function guardEnterprise(req, res, next) {
  if (isEnterprise()) return next();
  res.status(403).json({
    error:   'ENTERPRISE_REQUIRED',
    message: 'Diese Funktion erfordert eine KI-OS Enterprise Edition.',
    info:    'https://ki-os.org/enterprise',
  });
}

function guardFeature(feature) {
  return (req, res, next) => {
    if (hasFeature(feature)) return next();
    res.status(403).json({
      error:   'FEATURE_NOT_LICENSED',
      feature,
      message: `Feature '${feature}' ist in Ihrer Edition nicht enthalten.`,
    });
  };
}

module.exports = { resolveEdition, isEnterprise, hasFeature, getInfo, guardEnterprise, guardFeature };

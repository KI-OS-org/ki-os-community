'use strict';

/**
 * KI-OS Elefant Service
 * (c) 2026 Ingo Schaffer — https://ki-os.org
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const _PUB = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAzLBjlTh/jwY/dvcKT0ZVq14lLsRHisK3O2G2Vz0H6ZI=
-----END PUBLIC KEY-----`;

const _ELEFANT = path.resolve(process.cwd(), '.blauer-elefant');

let _e   = null;
let _ick = null; // integrity check — lazy-loaded um zirkuläre requires zu vermeiden

function _ic() {
  if (!_ick) { try { _ick = require('./mesh.integrity'); } catch { _ick = { isClean: () => true }; } }
  return _ick;
}

function _load() {
  if (_e !== null) return _e;

  // Integrity-Kette prüfen — schlägt fehl wenn eine der drei Kern-Dateien
  // verändert wurde (Edition Guard, dieser Service, oder die Integrity-Datei selbst)
  if (!_ic().isClean()) {
    _e = { edition: 'community' };
    return _e;
  }

  if (!fs.existsSync(_ELEFANT)) {
    _e = { edition: 'community' };
    return _e;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(_ELEFANT, 'utf8'));
  } catch {
    _w('Konfiguration unlesbar.');
    _e = { edition: 'community' };
    return _e;
  }

  const { sig, ...payload } = raw;

  if (!sig || !payload.edition || !payload.expires) {
    _w('Konfiguration unvollständig.');
    _e = { edition: 'community' };
    return _e;
  }

  if (new Date(payload.expires) < new Date()) {
    _w(`Konfiguration abgelaufen (${payload.expires}).`);
    _e = { edition: 'community' };
    return _e;
  }

  if (!_chk(JSON.stringify(payload), sig)) {
    _w('Konfiguration ungültig.');
    _e = { edition: 'community' };
    return _e;
  }

  // Dritter Faktor: Runtime-Kontext-Validierung
  let ctxOk = true;
  try {
    const { validateContext } = require('./runtime.context');
    ctxOk = validateContext({ ...payload, sig });
  } catch { ctxOk = false; }

  if (!ctxOk) {
    _e = { edition: 'community' };
    return _e;
  }

  _e = payload;
  return _e;
}

function getEdition()   { return _load().edition || 'community'; }
function isEnterprise() { return getEdition() === 'enterprise'; }
function hasFeature(f)  {
  const d = _load();
  if (!Array.isArray(d.features)) return isEnterprise();
  return d.features.includes(f);
}
function getInfo() {
  const d = _load();
  return {
    edition:  d.edition  || 'community',
    customer: d.customer || null,
    expires:  d.expires  || null,
    valid:    isEnterprise(),
  };
}

function _chk(payload, sigB64) {
  try {
    return crypto.verify(null, Buffer.from(payload), _PUB, Buffer.from(sigB64, 'base64'));
  } catch { return false; }
}

function _w(m) { console.warn(`[KI-OS] ${m}`); }

module.exports = { getEdition, isEnterprise, hasFeature, getInfo, _load };

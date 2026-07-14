/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
const { getEdition, isEnterprise, hasFeature, getInfo } = require('./edition.internal');
function resolveEdition() { return getEdition(); }
function guardEnterprise(req, res, next) {
  res.status(403).json({ error: 'ENTERPRISE_REQUIRED', message: 'Diese Funktion erfordert eine KI-OS Enterprise Edition.', info: 'https://ki-os.org/enterprise' });
}
function guardFeature(feature) {
  return (req, res, next) => res.status(403).json({ error: 'FEATURE_NOT_LICENSED', feature, message: `"${feature}" ist in Ihrer Edition nicht enthalten.` });
}
module.exports = { resolveEdition, isEnterprise, hasFeature, getInfo, guardEnterprise, guardFeature };

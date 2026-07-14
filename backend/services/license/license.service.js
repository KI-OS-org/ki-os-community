/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function getLicenseStatus() { return { tier: 'community', valid: false, limits: {}, keyConfigured: false, onlineValidation: 'not-checked', validUntil: null }; }
async function refreshLicenseOnline() { return { tier: 'community', valid: false }; }
module.exports = { getLicenseStatus, refreshLicenseOnline };

/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function getEdition()   { return 'community'; }
function isEnterprise() { return false; }
function hasFeature()   { return false; }
function getInfo()      { return { edition: 'community', customer: null, expires: null, valid: false }; }
function _load()        { return { edition: 'community' }; }
module.exports = { getEdition, isEnterprise, hasFeature, getInfo, _load };

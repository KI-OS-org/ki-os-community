/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: index.js
 * Browser tool exports.
 * @license AGPL-3.0-only
 */

'use strict';

module.exports = {
  ...require('./browser.tool'),
  ...require('./browser.playwright'),
  ...require('./browser.firecrawl'),
  ...require('./browser.security')
};

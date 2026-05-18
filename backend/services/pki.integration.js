/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
'use strict';
/* COMMUNITY_STUB */
class PKIIntegration {
  async extractAuth() { return { authenticated: true, userId: 'local', role: 'admin' }; }
}
module.exports = { PKIIntegration };

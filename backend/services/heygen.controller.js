/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function handleHeygenSpeak() {
  return { success: false, error: 'enterprise_only', message: 'HeyGen ist nur in der Enterprise Edition verfügbar.' };
}
module.exports = { handleHeygenSpeak };

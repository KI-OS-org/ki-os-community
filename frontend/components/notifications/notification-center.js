/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export function summarizeNotifications(items) {
  return {
    total: items.length,
    unread: items.filter(i => i.unread).length,
    critical: items.filter(i => i.level === 'critical').length,
  };
}

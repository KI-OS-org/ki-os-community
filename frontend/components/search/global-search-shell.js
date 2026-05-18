/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export function buildSearchSections(results) {
  const buckets = new Map();
  for (const item of results) {
    const list = buckets.get(item.type) || [];
    list.push(item);
    buckets.set(item.type, list);
  }
  return Array.from(buckets.entries()).map(([type, items]) => ({ type, items }));
}

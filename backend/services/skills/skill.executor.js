/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Skill Executor — führt Skill aus mit Timeout + strukturiertem Result
'use strict';

async function execute(skill, args = {}, timeoutMs = 10000) {
  const start = Date.now();
  try {
    const result = await Promise.race([
      skill.execute(args),
      new Promise((_, r) => setTimeout(() => r(new Error('Skill timeout')), timeoutMs)),
    ]);
    return { success: true, skill: skill.name, result, durationMs: Date.now() - start };
  } catch (err) {
    return { success: false, skill: skill.name, error: err.message, durationMs: Date.now() - start };
  }
}

module.exports = { execute };

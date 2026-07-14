/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
const contradictionDetector = require('../memory/contradiction.detector');

const injectPushback = async (userId, userMessage, systemPrompt) => {
  try {
    const result = await contradictionDetector.detectContradiction(userId, userMessage);
    if (result.detected) {
      const safeContent = result.oldContent.substring(0, 200).replace(/"/g, '\\"');
      const pushbackBlock = `
      ⚠️ KIMBA MEMORY PUSHBACK ⚠️
      Der Nutzer widerspricht sich selbst.
      Vorherige Aussage: "${safeContent}"
      Datum: ${result.oldDate}
      Grund: ${result.reason}
      Hinweis: Frage den Nutzer höflich nach, warum sich seine Meinung geändert hat.
    `;
      return systemPrompt + pushbackBlock;
    }
  } catch (_e) { /* pushback ist optional — nie den Chat blockieren */ }
  return systemPrompt;
};

module.exports = { injectPushback };
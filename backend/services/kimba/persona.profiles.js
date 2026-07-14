/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
const PROFILES = {
  executive: {
    displayName: 'Executive',
    params: { directness: 85, detailLevel: 'brief', humor: 10, riskSharpness: 90, costFocus: 50 },
    systemPromptSuffix: 'Sei direkt, prägnant und risikobewusst. Konzentriere dich auf Entscheidungen.'
  },
  developer: {
    displayName: 'Developer',
    params: { directness: 70, detailLevel: 'deep', humor: 20, riskSharpness: 50, costFocus: 30 },
    systemPromptSuffix: 'Gehe technisch tief ins Detail. Erkläre Implementierungen präzise.'
  },
  investor: {
    displayName: 'Investor',
    params: { directness: 80, detailLevel: 'brief', humor: 5, riskSharpness: 95, costFocus: 100 },
    systemPromptSuffix: 'Fokussiere auf ROI und Risiken. Bleibe knapp und geschäftlich.'
  },
  marketing: {
    displayName: 'Marketing',
    params: { directness: 75, detailLevel: 'normal', humor: 30, riskSharpness: 40, costFocus: 60 },
    systemPromptSuffix: 'Sei kreativ und ansprechend. Balanciere Fakten mit Engagement.'
  }
};

const DEFAULT_ROLE = 'executive';

function getProfile(role) {
  return PROFILES[role] || PROFILES[DEFAULT_ROLE];
}

function listProfiles() {
  return Object.keys(PROFILES).map(role => ({ role, displayName: PROFILES[role].displayName }));
}

function applyToSystemPrompt(base, role, customParams) {
  const profile = getProfile(role);
  const effectiveParams = customParams ? { ...profile.params, ...customParams } : profile.params;
  return `${base}\n\nPersona: ${profile.displayName}\n${profile.systemPromptSuffix}`;
}

module.exports = {
  PROFILES,
  DEFAULT_ROLE,
  getProfile,
  listProfiles,
  applyToSystemPrompt
};
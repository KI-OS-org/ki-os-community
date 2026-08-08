/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Gemini 3.1 Flash TTS Emotion-Tags — Inline-Tags für Mood + KiosMode
'use strict';

const MOOD_PROFILES = {
  neutral:    { tag: '',                  speed: 1.0  },
  laecheln:   { tag: '[warmly]',          speed: 1.0  },
  laugh:      { tag: '[laughs]',          speed: 1.1  },
  fragend:    { tag: '[playfully]',       speed: 0.94 },
  belehrend:  { tag: '[with confidence]', speed: 0.96 },
  flow:       { tag: '[cheerfully]',      speed: 1.06 },
  veraergert: { tag: '[firmly]',          speed: 1.02 },
};

const KIOS_MODE_PROFILES = {
  koordination: { tag: '[warmly]',       speed: 1.0  },
  strategie:    { tag: '[thoughtfully]', speed: 0.95 },
  execution:    { tag: '[cheerfully]',   speed: 1.05 },
  review:       { tag: '[calmly]',       speed: 0.90 },
  analyse:      { tag: '[calmly]',       speed: 0.92 },
  highend:      { tag: '[softly]',       speed: 0.88 },
};

function getEmotionProfile(kiosMode) {
  return KIOS_MODE_PROFILES[kiosMode] || KIOS_MODE_PROFILES.koordination;
}

function getMoodProfile(mood) {
  return MOOD_PROFILES[mood] || MOOD_PROFILES.neutral;
}

module.exports = { getEmotionProfile, getMoodProfile, MOOD_PROFILES, KIOS_MODE_PROFILES };

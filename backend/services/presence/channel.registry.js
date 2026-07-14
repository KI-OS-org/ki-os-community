/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const { CHANNELS, INTERRUPT_LEVELS } = require('../../schemas/presence.schema');

// ─── Channel-Definitionen ─────────────────────────────────────────────────────

const CHANNEL_DEFS = Object.freeze({
  [CHANNELS.MENUBAR]: {
    id: CHANNELS.MENUBAR,
    name: 'Mac Menüleiste',
    maxChars: 60,
    interruptLevels: [INTERRUPT_LEVELS.SILENT, INTERRUPT_LEVELS.BRIEF],
    supportsMarkdown: false,
    supportsColor: true,
    requiresApproval: false,
  },
  [CHANNELS.COCKPIT]: {
    id: CHANNELS.COCKPIT,
    name: 'Web Cockpit',
    maxChars: Infinity,
    interruptLevels: [INTERRUPT_LEVELS.PUSH],
    supportsMarkdown: true,
    supportsColor: true,
    requiresApproval: false,
  },
  [CHANNELS.DISCORD]: {
    id: CHANNELS.DISCORD,
    name: 'Discord',
    maxChars: 280,
    interruptLevels: [INTERRUPT_LEVELS.BRIEF, INTERRUPT_LEVELS.PUSH],
    supportsMarkdown: true,
    supportsColor: false,
    requiresApproval: false,
  },
  [CHANNELS.WHATSAPP]: {
    id: CHANNELS.WHATSAPP,
    name: 'WhatsApp',
    maxChars: 500,
    interruptLevels: [INTERRUPT_LEVELS.PUSH],
    supportsMarkdown: false,
    supportsColor: false,
    requiresApproval: false,
  },
  [CHANNELS.WATCH]: {
    id: CHANNELS.WATCH,
    name: 'Apple Watch',
    maxChars: 80,
    interruptLevels: [INTERRUPT_LEVELS.APPROVE],
    supportsMarkdown: false,
    supportsColor: false,
    requiresApproval: true,
  },
  [CHANNELS.CARPLAY]: {
    id: CHANNELS.CARPLAY,
    name: 'CarPlay',
    maxChars: 100,
    interruptLevels: [INTERRUPT_LEVELS.WHISPER, INTERRUPT_LEVELS.BRIEF],
    supportsMarkdown: false,
    supportsColor: false,
    requiresApproval: false,
  },
});

// ─── Helper-Funktionen ───────────────────────────────────────────────────────

/**
 * Gibt ein Channel-Objekt zurück oder null, wenn nicht gefunden
 * @param {string} id - Channel-ID
 * @returns {Object|null} Channel-Objekt oder null
 */
function getChannel(id) {
  return CHANNEL_DEFS[id] || null;
}

/**
 * Gibt alle Channel-Objekte zurück
 * @returns {Object[]} Array aller Channel-Objekte
 */
function getAllChannels() {
  return Object.values(CHANNEL_DEFS);
}

/**
 * Gibt alle Channels zurück, die den angegebenen Interrupt-Level unterstützen
 * @param {string} level - Interrupt-Level
 * @returns {Object[]} Array der passenden Channel-Objekte
 */
function getChannelsForInterruptLevel(level) {
  return Object.values(CHANNEL_DEFS).filter(channel =>
    channel.interruptLevels.includes(level)
  );
}

/**
 * Formatiert Text für einen bestimmten Channel
 * @param {string} text - Zu formatierender Text
 * @param {string} channelId - Channel-ID
 * @returns {string} Formatierter Text
 */
function formatForChannel(text, channelId) {
  const channel = getChannel(channelId);
  if (!channel) return text;

  // Kürzen auf maxChars
  let formatted = text.substring(0, channel.maxChars);

  // HTML entfernen, wenn nicht unterstützt
  if (!channel.supportsMarkdown) {
    formatted = formatted.replace(/<[^>]*>/g, '');
  }

  return formatted;
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  getChannel,
  getAllChannels,
  getChannelsForInterruptLevel,
  formatForChannel,
  CHANNEL_DEFS,
};

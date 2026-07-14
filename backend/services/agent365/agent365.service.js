/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const axios = require('axios');
const path = require('path');
const packageJson = require('../../../package.json');

const CHAT_API_TIMEOUT = 30000;
const DEFAULT_USER_ID = 'agent365-user';
const DEFAULT_DISPLAY_NAME = 'Microsoft User';
const DEFAULT_CHANNEL = 'teams';

async function handleMention(payload) {
  try {
    // Extract and clean the message text
    const cleanText = payload.text.replace(/^@kimba\s*/i, '').trim();
    
    const userId = payload.from?.userId || DEFAULT_USER_ID;
    const displayName = payload.from?.displayName || DEFAULT_DISPLAY_NAME;
    const channel = payload.channel || DEFAULT_CHANNEL;
    
    const chatEndpoint = `${process.env.KIOS_INTERNAL_URL || 'http://localhost:3000'}/api/chat`;
    
    const response = await axios.post(chatEndpoint, {
      message: cleanText,
      userId,
      source: `agent365-${channel}`,
      context: {
        tenantId: payload.tenantId,
        conversationId: payload.conversationId,
        displayName
      }
    }, { timeout: CHAT_API_TIMEOUT });
    
    return {
      messageId: payload.messageId,
      type: 'message',
      text: response.data.reply || response.data.text || response.data.message || 'Keine Antwort',
      channel,
      conversationId: payload.conversationId
    };
  } catch (error) {
    console.error('Agent365 service error:', error);
    return {
      messageId: payload.messageId,
      type: 'message',
      text: 'Fehler bei der Verarbeitung der Anfrage',
      channel: payload.channel || DEFAULT_CHANNEL,
      conversationId: payload.conversationId
    };
  }
}

function getManifest() {
  return {
    name: 'KIMBA',
    description: 'KI-OS AI Orchestration Agent',
    version: packageJson.version,
    capabilities: ['chat', 'agentmesh', 'ghost-control', 'voice'],
    channel: ['teams', 'outlook', 'word'],
    invocation: '@KIMBA'
  };
}

function validateWebhook(req) {
  if (process.env.AGENT365_WEBHOOK_SECRET) {
    return req.headers['x-agent365-signature'] === process.env.AGENT365_WEBHOOK_SECRET;
  }
  return true; // dev mode
}

module.exports = {
  handleMention,
  getManifest,
  validateWebhook
};

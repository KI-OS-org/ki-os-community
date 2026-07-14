/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const twilio = require('twilio');

async function sendReply(to, message) {
  if (message.length > 1500) {
    message = message.slice(0, 1497) + '...';
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  try {
    const result = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      body: message
    });

    return { sid: result.sid, status: result.status };
  } catch (error) {
    console.error('WhatsApp reply failed:', error);
    throw error;
  }
}

module.exports = { sendReply };

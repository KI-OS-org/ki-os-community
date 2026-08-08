/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const axios = require('axios');

async function sendReply(to, message) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.META_WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message.slice(0, 4096) }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`
        }
      }
    );
    return { messageId: response.data.messages[0].id };
  } catch (err) {
    console.error(err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendReply };

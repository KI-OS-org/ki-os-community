/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 *
 * KIMBA Mailer Service — sendet Emails via SMTP (iCloud / Dogado / beliebig)
 * Konfiguration via .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
'use strict';

const nodemailer = require('nodemailer');
const path       = require('path');
const logger     = require('../core/logger.service');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('KIMBA Mailer: SMTP_HOST, SMTP_USER, SMTP_PASS fehlen in .env');
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return _transporter;
}

/**
 * Email senden.
 * @param {{ to: string|string[], subject: string, text?: string, html?: string, attachments?: Array }} options
 * @returns {Promise<object>} nodemailer info
 */
async function send({ to, subject, text, html, attachments = [] }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await getTransporter().sendMail({
    from,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    text,
    html,
    attachments,
  });

  logger.info(`[Mailer] Gesendet an ${to} — MessageId: ${info.messageId}`);
  return info;
}

/**
 * Email mit Datei-Anhang senden.
 * @param {{ to: string, subject: string, text: string, filePath: string, fileName?: string }} options
 */
async function sendWithFile({ to, subject, text, filePath, fileName }) {
  return send({
    to,
    subject,
    text,
    attachments: [{
      filename: fileName || path.basename(filePath),
      path: filePath,
    }],
  });
}

/**
 * Verbindung testen.
 * @returns {Promise<boolean>}
 */
async function verify() {
  try {
    await getTransporter().verify();
    logger.info('[Mailer] SMTP-Verbindung OK');
    return true;
  } catch (err) {
    logger.error('[Mailer] SMTP-Verbindung fehlgeschlagen:', err.message);
    return false;
  }
}

module.exports = { send, sendWithFile, verify };

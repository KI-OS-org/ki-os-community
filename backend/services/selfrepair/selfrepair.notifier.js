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
 */
/**
 * KI-OS SelfRepair Notifier
 * Admin-Benachrichtigungen: UI Event Bus (Echtzeit) + Email-Log-Datei.
 *
 * Email wird in .ki-os-email-queue.json geschrieben.
 * Ein separater Mailer-Prozess (oder SMTP-Integration) kann diese Queue abholen.
 *
 * Für sofortige Email: SMTP_HOST + SMTP_USER + SMTP_PASS + ADMIN_EMAIL env vars setzen,
 * dann wird nodemailer verwendet (wenn installiert), sonst File-Queue-Fallback.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const EMAIL_QUEUE_PATH = path.join(__dirname, '../../../.ki-os-email-queue.json');

// ---------------------------------------------------------------------------
// UI Event Bus Notification (Echtzeit im Dashboard)
// ---------------------------------------------------------------------------
function notifyUI(incident) {
  try {
    const { bus } = require('../ui/ui.eventbus');
    const levelLabel = incident.level === 1 ? 'KRITISCH' : incident.level === 2 ? 'Night-Slot' : 'Backlog';
    bus.emit('event', {
      type:      'selfrepair.incident',
      level:     incident.level,
      levelLabel,
      incidentId: incident.id,
      source:    incident.source,
      error:     (incident.error || '').slice(0, 120),
      status:    incident.status,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Event Bus nicht verfügbar — kein Absturz
  }
}

// ---------------------------------------------------------------------------
// Email-Queue
// ---------------------------------------------------------------------------
function loadEmailQueue() {
  try {
    if (!fs.existsSync(EMAIL_QUEUE_PATH)) return { emails: [] };
    return JSON.parse(fs.readFileSync(EMAIL_QUEUE_PATH, 'utf8'));
  } catch {
    return { emails: [] };
  }
}

function queueEmail({ subject, body, priority }) {
  const q = loadEmailQueue();
  q.emails.push({
    id:        require('crypto').randomUUID(),
    to:        process.env.ADMIN_EMAIL || 'admin@ki-os.local',
    subject,
    body,
    priority:  priority || 'normal',
    queued_at: new Date().toISOString(),
    sent:      false,
  });
  if (q.emails.length > 200) q.emails = q.emails.slice(-200);
  fs.writeFileSync(EMAIL_QUEUE_PATH, JSON.stringify(q, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Versucht Email direkt via nodemailer zu senden (optional)
// ---------------------------------------------------------------------------
async function trySendDirect(emailData) {
  if (!process.env.SMTP_HOST || !process.env.ADMIN_EMAIL) return false;
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth:   process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || `KI-OS SelfRepair <noreply@ki-os.local>`,
      to:      process.env.ADMIN_EMAIL,
      subject: emailData.subject,
      text:    emailData.body,
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Haupt-Benachrichtigung
// ---------------------------------------------------------------------------
async function notify(incident, options = {}) {
  const { sendEmail = true } = options;
  const levelLabel = incident.level === 1 ? 'L1 KRITISCH'
    : incident.level === 2 ? 'L2 Night-Slot'
    : 'L3 Backlog';

  // 1. UI Echtzeit
  notifyUI(incident);

  // 2. Email nur bei L1 und L2 (L3 nur bei explizitem Aufruf)
  if (!sendEmail || incident.level > 2) return;

  const subject = `[KI-OS SelfRepair] ${levelLabel}: ${(incident.error || '').slice(0, 60)}`;
  const body = [
    `KI-OS SelfRepair — ${levelLabel}`,
    `${'─'.repeat(60)}`,
    ``,
    `Incident-ID : ${incident.id}`,
    `Zeitpunkt   : ${incident.createdAt}`,
    `Service     : ${incident.source || 'unbekannt'}`,
    `Auftreten   : ${incident.occurrences || 1}x`,
    ``,
    `Fehler:`,
    incident.error || '(kein Fehler-Text)',
    ``,
    incident.stack ? `Stack (erste 500 Zeichen):\n${incident.stack.slice(0, 500)}` : '',
    ``,
    incident.aiAnalysis ? [
      `AI-Analyse:`,
      incident.aiAnalysis.rootCause || '',
      ``,
      `Confidence: ${Math.round((incident.aiAnalysis.confidence || 0) * 100)}%`,
      ``,
      incident.aiAnalysis.suggestedFix ? `Vorgeschlagener Fix:\n${incident.aiAnalysis.suggestedFix.slice(0, 800)}` : 'Kein Fix vorgeschlagen.',
    ].join('\n') : 'AI-Analyse läuft noch...',
    ``,
    `${'─'.repeat(60)}`,
    `KI-OS Control Panel: http://localhost:3001/repair/${incident.id}`,
  ].join('\n');

  const emailData = { subject, body, priority: incident.level === 1 ? 'high' : 'normal' };

  // Versuche direkt zu senden, sonst in Queue
  const sent = await trySendDirect(emailData);
  if (!sent) queueEmail(emailData);
}

// ---------------------------------------------------------------------------
// Tagesübersicht (L2/L3 Summary, für Night-Slot)
// ---------------------------------------------------------------------------
async function notifyDailySummary(incidents) {
  const l2 = incidents.filter(i => i.level === 2);
  const l3 = incidents.filter(i => i.level === 3);
  if (l2.length === 0 && l3.length === 0) return;

  const lines = [
    `KI-OS SelfRepair — Tagesübersicht`,
    `${new Date().toLocaleDateString('de-DE')}`,
    `${'─'.repeat(60)}`,
    ``,
    l2.length > 0 ? [
      `L2 Night-Slot (${l2.length} Incidents):`,
      ...l2.map(i => `  • [${i.status}] ${(i.error || '').slice(0, 70)}`),
      ``,
    ].join('\n') : '',
    l3.length > 0 ? [
      `L3 Backlog (${l3.length} Incidents):`,
      ...l3.map(i => `  • ${(i.error || '').slice(0, 70)}`),
    ].join('\n') : '',
    ``,
    `Control Panel: http://localhost:3001/repair`,
  ];

  const emailData = {
    subject: `[KI-OS SelfRepair] Tagesübersicht: ${l2.length} Night-Slot, ${l3.length} Backlog`,
    body:    lines.join('\n'),
    priority: 'normal',
  };
  const sent = await trySendDirect(emailData);
  if (!sent) queueEmail(emailData);
  notifyUI({ id: 'summary', level: 2, source: 'selfrepair', error: `Tagesübersicht: ${l2.length} L2, ${l3.length} L3 Incidents`, status: 'summary' });
}

module.exports = { notify, notifyDailySummary, notifyUI, queueEmail };

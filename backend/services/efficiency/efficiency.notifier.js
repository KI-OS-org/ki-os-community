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
 * KI-OS — Efficiency Agent Notifier
 * Informiert Admin via UI-Event + Email wenn ein neuer Report vorliegt
 */
'use strict';

const fs     = require('fs');
const path   = require('path');
const logger = require('../core/logger.service');

/**
 * Sendet Benachrichtigung an das UI (über den globalen Event-Bus)
 */
function notifyUI(report) {
  try {
    const eventBus = global.__KI_OS_EVENT_BUS__;
    if (eventBus && typeof eventBus.emit === 'function') {
      eventBus.emit('efficiency:report:new', {
        id:        report.id,
        summary:   report.executiveSummary,
        highCount: (report.featureSuggestions || []).filter(f => f.priority === 'HIGH').length,
        quickWins: (report.quickWins || []).length,
        generatedAt: report.generatedAt,
      });
    }
  } catch (e) {
    logger.warn('efficiency.notify.ui_failed', { error: e.message });
  }
}

/**
 * Schreibt Email in die Queue-Datei (wird von SelfRepair-Notifier-Pattern übernommen)
 */
function queueEmail(report) {
  const emailQueuePath = path.join(process.cwd(), '.ki-os-email-queue.json');
  try {
    let queue = [];
    if (fs.existsSync(emailQueuePath)) {
      try { queue = JSON.parse(fs.readFileSync(emailQueuePath, 'utf8')); } catch { queue = []; }
    }

    const highFeatures = (report.featureSuggestions || [])
      .filter(f => f.priority === 'HIGH')
      .slice(0, 3)
      .map(f => `• ${f.title} (${f.effort})`)
      .join('\n') || '— keine HIGH-Priority Features';

    const quickWins = (report.quickWins || [])
      .slice(0, 3)
      .map(w => `• ${w.title}`)
      .join('\n') || '— keine Quick Wins';

    const critical = (report.updateRecommendations || [])
      .filter(u => u.urgency === 'critical')
      .map(u => `• ${u.package}: ${u.current} → ${u.latest}`)
      .join('\n') || '— keine kritischen Updates';

    queue.push({
      to:      process.env.ADMIN_EMAIL || '',
      subject: `[KI-OS] Wöchentlicher Efficiency-Report — ${new Date(report.generatedAt).toLocaleDateString('de-DE')}`,
      body: `
KI-OS Wöchentlicher Efficiency & Competitive Intelligence Report
================================================================

${report.executiveSummary || ''}

TOP FEATURE-VORSCHLÄGE (HIGH Priority):
${highFeatures}

QUICK WINS:
${quickWins}

KRITISCHE DEPENDENCY-UPDATES:
${critical}

TREND-EINBLICKE:
${report.trendInsights || '—'}

─────────────────────────────────────────
Vollständiger Report: http://localhost:3001/efficiency/${report.id}
Generiert: ${new Date(report.generatedAt).toLocaleString('de-DE')}
KI-OS Orbit Control
      `.trim(),
      type:       'efficiency_report',
      reportId:   report.id,
      queuedAt:   new Date().toISOString(),
    });

    fs.writeFileSync(emailQueuePath, JSON.stringify(queue, null, 2), 'utf8');
    logger.info('efficiency.notify.email_queued', { to: process.env.ADMIN_EMAIL || '(not set)', reportId: report.id });
  } catch (e) {
    logger.warn('efficiency.notify.email_queue_failed', { error: e.message });
  }
}

/**
 * Versucht direktes Email-Senden via nodemailer (falls konfiguriert)
 */
async function trySendDirect(report) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpHost   = process.env.SMTP_HOST;
  if (!adminEmail || !smtpHost) return false;

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   smtpHost,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const highCount   = (report.featureSuggestions || []).filter(f => f.priority === 'HIGH').length;
    const quickCount  = (report.quickWins || []).length;

    const topFeatures = (report.featureSuggestions || [])
      .filter(f => f.priority === 'HIGH')
      .slice(0, 5)
      .map(f => `<li><strong>${f.title}</strong> — ${f.effort} — ${f.rationale}</li>`)
      .join('');

    const topWins = (report.quickWins || [])
      .slice(0, 3)
      .map(w => `<li><strong>${w.title}</strong>: ${w.description}</li>`)
      .join('');

    const competitors = (report.competitorHighlights || [])
      .slice(0, 3)
      .map(c => `<li><strong>${c.competitor}</strong>: ${c.feature}</li>`)
      .join('');

    await transporter.sendMail({
      from:    process.env.SMTP_FROM || `KI-OS <${process.env.SMTP_USER}>`,
      to:      adminEmail,
      subject: `[KI-OS] Efficiency-Report ${new Date(report.generatedAt).toLocaleDateString('de-DE')}`,
      html: `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1a1a2e">
  <div style="background:linear-gradient(135deg,#0d1117,#161b22);padding:24px;border-radius:12px">
    <h1 style="color:#5ac4ff;margin:0 0 8px">KI-OS Efficiency Report</h1>
    <p style="color:#8b949e;margin:0">${new Date(report.generatedAt).toLocaleString('de-DE')}</p>
  </div>

  <div style="padding:24px 0">
    <p style="font-size:16px;line-height:1.6">${report.executiveSummary || ''}</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0">
      <div style="background:#f0f9ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:bold;color:#0369a1">${highCount}</div>
        <div style="color:#6b7280;font-size:14px">HIGH-Priority Features</div>
      </div>
      <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:bold;color:#16a34a">${quickCount}</div>
        <div style="color:#6b7280;font-size:14px">Quick Wins</div>
      </div>
    </div>

    ${competitors ? `<h2 style="color:#1d4ed8">🔍 Wettbewerber-Highlights</h2><ul>${competitors}</ul>` : ''}
    ${topFeatures ? `<h2 style="color:#dc2626">⚡ Top Feature-Vorschläge</h2><ul>${topFeatures}</ul>` : ''}
    ${topWins ? `<h2 style="color:#16a34a">✅ Quick Wins</h2><ul>${topWins}</ul>` : ''}

    ${report.trendInsights ? `<h2 style="color:#7c3aed">📈 Trend-Einblicke</h2><p>${report.trendInsights}</p>` : ''}
  </div>

  <div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:center">
    <a href="http://localhost:3001/efficiency/${report.id}"
       style="background:#5ac4ff;color:#0d1117;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
      Vollständigen Report ansehen →
    </a>
  </div>
</div>
      `,
    });

    logger.info('efficiency.notify.email_sent', { to: adminEmail, reportId: report.id });
    return true;
  } catch (e) {
    logger.warn('efficiency.notify.email_send_failed', { error: e.message });
    return false;
  }
}

/**
 * Hauptfunktion: Admin benachrichtigen
 */
async function notifyAdmin(report) {
  notifyUI(report);
  const sent = await trySendDirect(report);
  if (!sent) queueEmail(report);
}

module.exports = { notifyAdmin };

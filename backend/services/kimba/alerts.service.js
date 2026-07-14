/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
// @desc Proaktive Discord-Alerts: Budget-Warnung, Outreach-Reminder, Test-Reminder
'use strict';

const path = require('path');
const fs = require('fs');

const EFFICIENCY_LOG_PATH = path.join(process.cwd(), '.kios', 'efficiency-log.json');
const SWARM_MEMORY_PATH = path.join(process.cwd(), '.swarm-memory', 'store.json');
const SALES_DB_PATH = process.env.SALES_DB_PATH || path.join(process.cwd(), 'data', 'sales.db');
const DAILY_BUDGET_LIMIT = parseFloat(process.env.DAILY_BUDGET_LIMIT || '5');

class AlertsService {
  constructor(discordClient, channelId) {
    this.client = discordClient;
    this.channelId = channelId;
  }

  async sendAlert(message) {
    if (!this.client || !this.channelId) return;
    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (channel) await channel.send(message);
    } catch (err) {
      console.error('[KIMBA Alerts] Senden fehlgeschlagen:', err.message);
    }
  }

  // Regel 1 — Budget-Alert: summiert heutige Kosten aus efficiency-log.json
  async checkBudget() {
    try {
      if (!fs.existsSync(EFFICIENCY_LOG_PATH)) return;
      const raw = fs.readFileSync(EFFICIENCY_LOG_PATH, 'utf8');
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return;

      const today = new Date().toISOString().slice(0, 10);
      const todayCost = entries
        .filter(e => e && e.timestamp && String(e.timestamp).startsWith(today))
        .reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);

      if (todayCost > DAILY_BUDGET_LIMIT * 0.8) {
        const pct = Math.round((todayCost / DAILY_BUDGET_LIMIT) * 100);
        await this.sendAlert(
          `⚠️ **Budget-Warnung:** $${todayCost.toFixed(4)} von $${DAILY_BUDGET_LIMIT.toFixed(2)} heute verbraucht (${pct}%)`
        );
      }
    } catch (err) {
      console.error('[KIMBA Alerts] Budget-Check fehlgeschlagen:', err.message);
    }
  }

  // Regel 2 — Outreach-Reminder: pending Drafts älter als 24h
  async checkOutreachDrafts() {
    try {
      const Database = require('better-sqlite3');
      const db = new Database(SALES_DB_PATH, { readonly: true });
      try {
        const cutoff = new Date(Date.now() - 86400000).toISOString();
        const rows = db.prepare(
          `SELECT id, subject, body, createdAt FROM outreach_drafts WHERE status='pending' AND createdAt < ? ORDER BY createdAt ASC LIMIT 10`
        ).all(cutoff);

        if (rows.length > 0) {
          const list = rows
            .map((r, i) => `${i + 1}. **${r.subject || 'kein Betreff'}** (erstellt: ${r.createdAt?.slice(0, 10) || '?'})`)
            .join('\n');
          await this.sendAlert(
            `📋 **Outreach-Erinnerung:** ${rows.length} Draft(s) warten seit >24h auf Approval:\n${list}`
          );
        }
      } finally {
        db.close();
      }
    } catch (err) {
      // Tabelle existiert nicht oder DB nicht gefunden — überspringen
      if (!err.message?.includes('no such table') && !err.message?.includes('ENOENT')) {
        console.error('[KIMBA Alerts] Outreach-Check fehlgeschlagen:', err.message);
      }
    }
  }

  // Regel 3 — Test-Reminder: letzte Swarm-Memory Einträge ohne "test" keyword und >6h alt
  async checkTestReminder() {
    try {
      if (!fs.existsSync(SWARM_MEMORY_PATH)) return;
      const raw = fs.readFileSync(SWARM_MEMORY_PATH, 'utf8');
      const store = JSON.parse(raw);
      const entries = store.entries || (Array.isArray(store) ? store : []);
      if (!entries.length) return;

      // Letzten Eintrag prüfen
      const last = entries[0]; // neuester steht oft oben
      const ts = last.ts || last.createdAt || last.lastUsed;
      if (!ts) return;

      const ageMs = Date.now() - new Date(ts).getTime();
      const hasTest = JSON.stringify(last).toLowerCase().includes('test');

      if (!hasTest && ageMs > 6 * 60 * 60 * 1000) {
        await this.sendAlert(
          `💡 **Test-Reminder:** Letzte Swarm-Mission ohne Test-Output — kurzer Smoke-Test empfohlen.`
        );
      }
    } catch (err) {
      console.error('[KIMBA Alerts] Test-Check fehlgeschlagen:', err.message);
    }
  }

  async checkAndAlert() {
    await this.checkBudget();
    await this.checkOutreachDrafts();
    await this.checkTestReminder();
  }
}

// Läuft alle 4 Stunden
function startAlertsScheduler(client, channelId) {
  if (!channelId) {
    console.warn('[KIMBA Alerts] DISCORD_KIMBA_CHANNEL nicht gesetzt — Scheduler inaktiv');
    return;
  }
  const svc = new AlertsService(client, channelId);
  // Erstes Check nach 30 Sekunden (nach Bot-Login), danach alle 4h
  setTimeout(() => svc.checkAndAlert().catch(() => {}), 30000);
  setInterval(() => svc.checkAndAlert().catch(() => {}), 4 * 60 * 60 * 1000);
  console.log('[KIMBA Alerts] Scheduler gestartet (4h-Intervall)');
}

module.exports = { AlertsService, startAlertsScheduler };

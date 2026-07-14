/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
// @desc Regel-Engine: gespeicherte Trigger-Aktions-Regeln für KIMBA — wenn X passiert → tue Y
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RULES_PATH = path.join(process.cwd(), '.kios', 'rules.json');
const EFFICIENCY_LOG_PATH = path.join(process.cwd(), '.kios', 'efficiency-log.json');
const JOBS_DIR = path.join(process.cwd(), '.kios', 'jobs');
const DAILY_BUDGET_LIMIT = parseFloat(process.env.DAILY_BUDGET_LIMIT || '5');

// ─── Trigger-Funktionen ──────────────────────────────────────────────────────

const TRIGGERS = {
  /**
   * budget_80pct — true wenn heutige API-Kosten > 80% des Tageslimits
   */
  'budget_80pct': () => {
    try {
      if (!fs.existsSync(EFFICIENCY_LOG_PATH)) return false;
      const entries = JSON.parse(fs.readFileSync(EFFICIENCY_LOG_PATH, 'utf8'));
      if (!Array.isArray(entries)) return false;
      const today = new Date().toISOString().slice(0, 10);
      const todayCost = entries
        .filter(e => e && e.timestamp && String(e.timestamp).startsWith(today))
        .reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);
      return todayCost > DAILY_BUDGET_LIMIT * 0.8;
    } catch {
      return false;
    }
  },

  /**
   * no_commit_24h — true wenn kein git-Commit in den letzten 24 Stunden
   */
  'no_commit_24h': () => {
    try {
      const out = execSync('git log --since="24 hours ago" --oneline', {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 5000,
      });
      return out.trim().length === 0;
    } catch {
      return false;
    }
  },

  /**
   * mission_failed — true wenn der neueste Job-Status "failed" ist
   */
  'mission_failed': () => {
    try {
      if (!fs.existsSync(JOBS_DIR)) return false;
      const entries = fs.readdirSync(JOBS_DIR);
      if (!entries.length) return false;

      // Alle state.json lesen, neuesten nach updatedAt finden
      const states = [];
      for (const entry of entries) {
        const statePath = path.join(JOBS_DIR, entry, 'state.json');
        if (fs.existsSync(statePath)) {
          try {
            const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            if (state && state.updatedAt) states.push(state);
          } catch { /* überspringen */ }
        }
      }
      if (!states.length) return false;
      states.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return states[0].status === 'failed';
    } catch {
      return false;
    }
  },
};

// ─── Aktions-Funktionen ──────────────────────────────────────────────────────

const ACTIONS = {
  /**
   * discord_alert — sendet eine Nachricht in den KIMBA Discord-Kanal
   */
  'discord_alert': async (msg, discordClient, channelId) => {
    if (!discordClient || !channelId) {
      console.warn('[KIMBA Rules] discord_alert: kein Client oder Channel konfiguriert');
      return;
    }
    try {
      const channel = await discordClient.channels.fetch(channelId);
      if (channel) await channel.send(`🔔 **KIMBA Regel:** ${msg}`);
    } catch (err) {
      console.error('[KIMBA Rules] discord_alert fehlgeschlagen:', err.message);
    }
  },

  /**
   * log — gibt die Nachricht auf der Konsole aus
   */
  'log': (msg) => {
    console.log('[KIMBA Rule]', msg);
  },
};

// ─── RulesService ────────────────────────────────────────────────────────────

class RulesService {
  loadRules() {
    try {
      if (!fs.existsSync(RULES_PATH)) return [];
      return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
    } catch {
      return [];
    }
  }

  saveRules(rules) {
    fs.mkdirSync(path.dirname(RULES_PATH), { recursive: true });
    fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2));
  }

  /**
   * Neue Regel hinzufügen — gibt die generierte ID zurück
   */
  addRule(trigger, action, message = '') {
    if (!TRIGGERS[trigger]) throw new Error(`Unbekannter Trigger: ${trigger}. Verfügbar: ${Object.keys(TRIGGERS).join(', ')}`);
    if (!ACTIONS[action]) throw new Error(`Unbekannte Aktion: ${action}. Verfügbar: ${Object.keys(ACTIONS).join(', ')}`);
    const rules = this.loadRules();
    const id = Date.now().toString(36);
    rules.push({ id, trigger, action, message, createdAt: Date.now() });
    this.saveRules(rules);
    return id;
  }

  /**
   * Regel nach ID entfernen
   */
  removeRule(id) {
    const rules = this.loadRules().filter(r => r.id !== id);
    this.saveRules(rules);
  }

  /**
   * Alle aktiven Regeln evaluieren — triggert Aktionen wenn Bedingungen erfüllt
   */
  async evaluate(discordClient, channelId) {
    const rules = this.loadRules();
    for (const rule of rules) {
      try {
        const triggerFn = TRIGGERS[rule.trigger];
        if (!triggerFn) {
          console.warn(`[KIMBA Rules] Unbekannter Trigger übersprungen: ${rule.trigger}`);
          continue;
        }
        const triggered = await triggerFn();
        if (triggered) {
          console.log(`[KIMBA Rules] Trigger ausgelöst: ${rule.trigger} → ${rule.action}`);
          const actionFn = ACTIONS[rule.action];
          if (actionFn) {
            await actionFn(rule.message || rule.trigger, discordClient, channelId);
          }
        }
      } catch {
        /* Regel-Evaluation ist nicht-kritisch — Fehler ignorieren */
      }
    }
  }

  /**
   * Verfügbare Trigger und Aktionen auflisten
   */
  getAvailable() {
    return {
      triggers: Object.keys(TRIGGERS),
      actions: Object.keys(ACTIONS),
    };
  }
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

/**
 * Startet den stündlichen Regel-Scheduler
 */
function startRulesScheduler(client, channelId) {
  if (!channelId) {
    console.warn('[KIMBA Rules] DISCORD_KIMBA_CHANNEL nicht gesetzt — Scheduler inaktiv');
    return;
  }
  const svc = new RulesService();
  // Erstes Check nach 60 Sekunden (nach Bot-Login), danach stündlich
  setTimeout(() => svc.evaluate(client, channelId).catch(() => {}), 60000);
  setInterval(() => svc.evaluate(client, channelId).catch(() => {}), 60 * 60 * 1000);
  console.log('[KIMBA Rules] Scheduler gestartet (1h-Intervall)');
}

module.exports = { RulesService, startRulesScheduler, TRIGGERS, ACTIONS };

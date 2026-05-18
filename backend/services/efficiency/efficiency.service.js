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
 * KI-OS — Efficiency Agent Service
 * Hauptorchestrator: Crawl → Analyse → Report → Notify
 * Wöchentlicher automatischer Lauf + manuelle Trigger-Option
 */
'use strict';

const { crawlAll }       = require('./efficiency.crawler');
const { analyzeKiOs }    = require('./efficiency.analyzer');
const { generateReport } = require('./efficiency.reporter');
const { notifyAdmin }    = require('./efficiency.notifier');
const store              = require('./efficiency.store');
const logger             = require('../core/logger.service');

let _schedulerTimer = null;
let _running        = false;
let _status         = { state: 'idle', lastRunAt: null, nextRunAt: null, currentStep: null };

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Berechnet Millisekunden bis zum nächsten Lauf
 * Standard: Montag 08:00 Uhr (konfigurierbar via ENV)
 */
function msUntilNextRun() {
  const targetDay  = parseInt(process.env.EFFICIENCY_AGENT_DAY  || '1'); // 1=Montag
  const targetHour = parseInt(process.env.EFFICIENCY_AGENT_HOUR || '8');
  const targetMin  = parseInt(process.env.EFFICIENCY_AGENT_MIN  || '0');
  const intervalH  = parseInt(process.env.EFFICIENCY_AGENT_INTERVAL_HOURS || '0');

  // Kurzintervall-Modus (für Tests: EFFICIENCY_AGENT_INTERVAL_HOURS=1)
  if (intervalH > 0) return intervalH * 60 * 60 * 1000;

  const now  = new Date();
  const next = new Date(now);
  next.setHours(targetHour, targetMin, 0, 0);

  // Auf den Ziel-Wochentag setzen
  const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
  next.setDate(now.getDate() + daysUntil);

  // Falls heute der Tag ist und die Zeit noch kommt: heute
  if (daysUntil === 7) {
    const today = new Date(now);
    today.setHours(targetHour, targetMin, 0, 0);
    if (today > now) return today - now;
  }

  return next - now;
}

function scheduleNext() {
  const ms    = msUntilNextRun();
  const next  = new Date(Date.now() + ms);
  _status.nextRunAt = next.toISOString();

  const hh = Math.floor(ms / 3600000);
  const mm  = Math.floor((ms % 3600000) / 60000);
  logger.info('efficiency.scheduled', { nextRunAt: next.toISOString(), inHours: hh, inMinutes: mm });

  _schedulerTimer = setTimeout(async () => {
    await runAnalysis({ source: 'scheduler' });
    scheduleNext();
  }, ms);
}

// ── Hauptlauf ─────────────────────────────────────────────────────────────────

/**
 * Vollständiger Analyse-Lauf
 * @param {{ source: 'scheduler'|'manual'|'api' }} options
 */
async function runAnalysis({ source = 'manual' } = {}) {
  if (_running) {
    logger.warn('efficiency.run.skipped', { reason: 'already_running', source });
    return null;
  }

  _running = true;
  _status.state = 'running';
  const startedAt = Date.now();

  logger.info('efficiency.run.start', { source });

  try {
    // Step 1: Web-Crawl
    _status.currentStep = 'crawling';
    logger.info('efficiency.step', { step: '1/4', name: 'crawling', source });
    const crawlerData = await crawlAll();
    logger.info('efficiency.crawl.done', { queriesRun: crawlerData.queriesRun, results: crawlerData.competitor.length + crawlerData.tech.length });

    // Step 2: Intern-Analyse
    _status.currentStep = 'analyzing';
    logger.info('efficiency.step', { step: '2/4', name: 'analyzing', source });
    const analyzerData = await analyzeKiOs();
    logger.info('efficiency.analyze.done', { version: analyzerData.version, outdated: analyzerData.dependencies.totalOutdated });

    // Step 3: LLM-Report
    _status.currentStep = 'reporting';
    logger.info('efficiency.step', { step: '3/4', name: 'reporting', source });
    const reportData = await generateReport(crawlerData, analyzerData);

    // Step 4: Speichern + Benachrichtigen
    _status.currentStep = 'notifying';
    logger.info('efficiency.step', { step: '4/4', name: 'notifying', source });
    const report = store.addReport({
      ...reportData,
      source,
      durationMs: Date.now() - startedAt,
      crawlerStats: { queriesRun: crawlerData.queriesRun },
      analyzerStats: { version: analyzerData.version, outdated: analyzerData.dependencies.totalOutdated },
    });

    await notifyAdmin(report);

    _status.state     = 'idle';
    _status.lastRunAt = report.generatedAt;
    _status.currentStep = null;

    const featureCount = (reportData.featureSuggestions || []).length;
    const highCount    = (reportData.featureSuggestions || []).filter(f => f.priority === 'HIGH').length;
    logger.info('efficiency.run.done', { featureCount, highCount, reportId: report.id, durationMs: report.durationMs });

    return report;
  } catch (e) {
    logger.error('efficiency.run.failed', { error: e.message, source });
    _status.state       = 'error';
    _status.currentStep = null;
    _status.lastError   = e.message;
    return null;
  } finally {
    _running = false;
  }
}

// ── Öffentliche API ───────────────────────────────────────────────────────────

function getStatus() {
  return {
    ..._status,
    running:   _running,
    lastRunAt: store.getLastRunAt(),
    nextRunAt: _status.nextRunAt,
    reportCount: store.getReports({ limit: 100 }).length,
  };
}

/**
 * Startet den Efficiency Agent (Scheduler + sofortiger Erstkontakt-Check)
 */
function startEfficiencyAgent() {
  const schedule = process.env.EFFICIENCY_AGENT_SCHEDULE || 'weekly';
  const disabled = process.env.EFFICIENCY_AGENT_DISABLED === 'true';

  if (disabled) {
    logger.info('efficiency.agent.disabled', { reason: 'EFFICIENCY_AGENT_DISABLED=true' });
    return;
  }

  logger.info('efficiency.agent.start', { schedule });

  // Scheduler starten
  scheduleNext();

  // Wenn noch nie gelaufen und es ein Dev-Start ist: nach 30s ersten Lauf machen
  const lastRun = store.getLastRunAt();
  if (!lastRun && process.env.EFFICIENCY_AGENT_RUN_ON_STARTUP === 'true') {
    logger.info('efficiency.agent.startup_run', { delayMs: 30000 });
    setTimeout(() => runAnalysis({ source: 'startup' }), 30000);
  }
}

module.exports = { startEfficiencyAgent, runAnalysis, getStatus };

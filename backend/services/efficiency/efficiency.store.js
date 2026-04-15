/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * KI-OS — Efficiency Agent Store
 * Persistiert Analyse-Reports in .ki-os-efficiency-reports.json
 * Max. 52 Reports (1 Jahr wöchentlich)
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const logger = require('../core/logger.service');

const STORE_PATH  = path.join(process.cwd(), '.ki-os-efficiency-reports.json');
const MAX_REPORTS = 52;

function load() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { reports: [], lastRunAt: null };
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { reports: [], lastRunAt: null };
  }
}

function save(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    logger.error('efficiency.store.write_failed', { message: e.message });
  }
}

function addReport(report) {
  const store = load();
  report.id = `eff-${Date.now()}`;
  report.generatedAt = new Date().toISOString();

  store.reports.unshift(report);
  if (store.reports.length > MAX_REPORTS) {
    store.reports = store.reports.slice(0, MAX_REPORTS);
  }
  store.lastRunAt = report.generatedAt;
  save(store);
  return report;
}

function getReports({ limit = 10 } = {}) {
  const store = load();
  return store.reports.slice(0, limit);
}

function getReport(id) {
  const store = load();
  return store.reports.find(r => r.id === id) || null;
}

function getLatest() {
  const store = load();
  return store.reports[0] || null;
}

function getLastRunAt() {
  return load().lastRunAt;
}

module.exports = { addReport, getReports, getReport, getLatest, getLastRunAt };

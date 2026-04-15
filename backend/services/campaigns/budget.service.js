/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * KI-OS Budget-Management-Modul
 * Einfaches Budget-Tracking für Kampagnen.
 * Storage: .ki-os-budgets.json (atomic write)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const logger = require('../core/logger.service');

const BUDGETS_PATH = path.join(process.cwd(), '.ki-os-budgets.json');

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
function load() {
  try {
    if (!fs.existsSync(BUDGETS_PATH)) return { budgets: [] };
    return JSON.parse(fs.readFileSync(BUDGETS_PATH, 'utf8'));
  } catch {
    return { budgets: [] };
  }
}

function save(store) {
  const tmp = BUDGETS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, BUDGETS_PATH);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
function createBudget({ campaignId, amountCents, currency = 'EUR', label = '' }) {
  const store = load();
  const existing = store.budgets.find(b => b.campaignId === campaignId);
  if (existing) return existing;

  const budget = {
    id:          randomUUID(),
    campaignId,
    label,
    currency,
    amountCents:  Number(amountCents) || 0,
    spentCents:   0,
    ledger:       [],
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString(),
  };
  store.budgets.push(budget);
  save(store);
  logger.info('budget.created', { budgetId: budget.id, campaignId, amountCents });
  return budget;
}

function getBudget(campaignId) {
  const { budgets } = load();
  return budgets.find(b => b.campaignId === campaignId) || null;
}

function checkBudget(campaignId, requestedCents) {
  const budget = getBudget(campaignId);
  if (!budget) return { allowed: true, remaining: null, note: 'no_budget_set' };

  const remaining = budget.amountCents - budget.spentCents;
  const allowed   = remaining >= Number(requestedCents);
  return {
    allowed,
    remaining,
    spentCents:  budget.spentCents,
    amountCents: budget.amountCents,
    currency:    budget.currency,
    note: allowed ? 'within_budget' : 'budget_exceeded',
  };
}

function bookSpend(campaignId, spentCents, reason = '') {
  const store = load();
  const idx = store.budgets.findIndex(b => b.campaignId === campaignId);
  if (idx === -1) {
    logger.warn('budget.book_failed_not_found', { campaignId });
    return null;
  }

  const entry = {
    id:         randomUUID(),
    spentCents: Number(spentCents),
    reason,
    timestamp:  new Date().toISOString(),
  };
  store.budgets[idx].spentCents  += Number(spentCents);
  store.budgets[idx].ledger.push(entry);
  store.budgets[idx].updatedAt    = new Date().toISOString();
  save(store);

  logger.info('budget.spend_booked', { campaignId, spentCents, reason });
  return store.budgets[idx];
}

function getBudgetStatus(campaignId) {
  const budget = getBudget(campaignId);
  if (!budget) return null;
  const remaining = budget.amountCents - budget.spentCents;
  const pct = budget.amountCents > 0
    ? Math.round((budget.spentCents / budget.amountCents) * 100)
    : 0;
  return {
    ...budget,
    remaining,
    utilizationPct: pct,
    status: pct >= 100 ? 'exhausted' : pct >= 80 ? 'warning' : 'ok',
  };
}

module.exports = { createBudget, getBudget, checkBudget, bookSpend, getBudgetStatus };

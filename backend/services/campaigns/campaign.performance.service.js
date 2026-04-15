/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

/**
 * Campaign Performance Service
 * Tracks impressions, clicks, conversions and computes ROI per campaign.
 * Community Edition: metrics are stored locally; no social-connector ingestion.
 */

const fs   = require('fs');
const path = require('path');
const logger = require('../core/logger.service');

const PERF_FILE = path.join(process.cwd(), '.ki-os-campaign-performance.json');

// ── Storage helpers ────────────────────────────────────────────────────────

function readAll() {
  try {
    if (fs.existsSync(PERF_FILE)) {
      return JSON.parse(fs.readFileSync(PERF_FILE, 'utf8'));
    }
  } catch (e) {
    logger.warn({ event: 'campaign_perf_read_error', error: e.message });
  }
  return {};
}

function writeAll(data) {
  const tmp = PERF_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, PERF_FILE);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get performance snapshot for a campaign.
 * Returns zero-valued metrics if none recorded yet.
 */
function getPerformance(campaignId) {
  const all = readAll();
  return all[campaignId] ?? {
    campaignId,
    impressions:  0,
    clicks:       0,
    conversions:  0,
    spentCents:   0,
    currency:     'EUR',
    ctr:          0,
    cvr:          0,
    cpcCents:     0,
    roiPct:       null,
    updatedAt:    null,
  };
}

/**
 * Record a metric event for a campaign.
 * @param {string} campaignId
 * @param {'impression'|'click'|'conversion'} eventType
 * @param {number} [count=1]
 */
function recordEvent(campaignId, eventType, count = 1) {
  const all  = readAll();
  const perf = all[campaignId] ?? {
    campaignId,
    impressions: 0,
    clicks:      0,
    conversions: 0,
    spentCents:  0,
    currency:    'EUR',
    updatedAt:   null,
  };

  switch (eventType) {
    case 'impression':  perf.impressions  += count; break;
    case 'click':       perf.clicks       += count; break;
    case 'conversion':  perf.conversions  += count; break;
    default:
      logger.warn({ event: 'campaign_perf_unknown_event', eventType, campaignId });
      return perf;
  }

  perf.updatedAt = new Date().toISOString();
  all[campaignId] = perf;
  writeAll(all);

  logger.info({ event: 'campaign_perf_recorded', campaignId, eventType, count });
  return _enrich(perf);
}

/**
 * Update the spend figure and optionally the ROI reference (revenue).
 * @param {string} campaignId
 * @param {number} spentCents
 * @param {number} [revenueCents] — if provided, ROI = (revenue - spent) / spent * 100
 */
function updateSpend(campaignId, spentCents, revenueCents) {
  const all  = readAll();
  const perf = all[campaignId] ?? {
    campaignId,
    impressions: 0,
    clicks:      0,
    conversions: 0,
    spentCents:  0,
    currency:    'EUR',
    roiPct:      null,
    updatedAt:   null,
  };

  perf.spentCents = spentCents;
  if (revenueCents !== undefined && spentCents > 0) {
    perf.roiPct = Math.round(((revenueCents - spentCents) / spentCents) * 100);
  }
  perf.updatedAt  = new Date().toISOString();
  all[campaignId] = perf;
  writeAll(all);

  return _enrich(perf);
}

/**
 * Delete performance data for a campaign (called on campaign delete).
 */
function deletePerformance(campaignId) {
  const all = readAll();
  delete all[campaignId];
  writeAll(all);
  logger.info({ event: 'campaign_perf_deleted', campaignId });
}

// ── Internal ───────────────────────────────────────────────────────────────

function _enrich(perf) {
  const p = { ...perf };
  p.ctr     = p.impressions > 0 ? +(p.clicks       / p.impressions * 100).toFixed(2) : 0;
  p.cvr     = p.clicks      > 0 ? +(p.conversions  / p.clicks      * 100).toFixed(2) : 0;
  p.cpcCents = p.clicks     > 0 ? Math.round(p.spentCents / p.clicks) : 0;
  return p;
}

module.exports = { getPerformance, recordEvent, updateSpend, deletePerformance };

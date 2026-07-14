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
 * KI-OS Campaign Service
 * Verwaltet Marketing-Kampagnen und orchestriert deren Ausführung über den DAG-Layer.
 *
 * Community Edition:
 *   - Keine Social-Media-Connectors erforderlich — Kampagnen erzeugen Content + Plan
 *   - Ausführung via ephemere DAG-Tasks (kein Agent-Slot verbraucht)
 *   - Budget-Tracking über budget.service.js
 *   - Performance-Daten als Platzhalter (erweiterbar wenn Social-Connectors vorhanden)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const logger = require('../core/logger.service');
const budgetSvc = require('./budget.service');

const CAMPAIGNS_PATH = path.join(process.cwd(), '.ki-os-campaigns.json');

const CAMPAIGN_DAG_ID = 'campaign-orchestrator';

// ---------------------------------------------------------------------------
// Storage (atomic write)
// ---------------------------------------------------------------------------
function load() {
  try {
    if (!fs.existsSync(CAMPAIGNS_PATH)) return { campaigns: [] };
    return JSON.parse(fs.readFileSync(CAMPAIGNS_PATH, 'utf8'));
  } catch {
    return { campaigns: [] };
  }
}

function save(store) {
  const tmp = CAMPAIGNS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, CAMPAIGNS_PATH);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildCampaignDagPayload(campaign) {
  return {
    dagId: CAMPAIGN_DAG_ID,
    payload: {
      campaignId:  campaign.id,
      goal:        campaign.goal,
      product:     campaign.product,
      audience:    campaign.audience,
      platforms:   campaign.platforms,
      tone:        campaign.tone || 'professional',
      budgetCents: campaign.budgetCents || 0,
      currency:    campaign.currency || 'EUR',
      language:    campaign.language || 'de',
      scheduleAt:  campaign.scheduleAt || null,
    },
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
function listCampaigns() {
  const { campaigns } = load();
  return campaigns.filter(c => c.status !== 'deleted');
}

function getCampaign(id) {
  const { campaigns } = load();
  return campaigns.find(c => c.id === id) || null;
}

function createCampaign(data) {
  if (!data.goal)    throw Object.assign(new Error('goal is required'),    { code: 'VALIDATION_ERROR' });
  if (!data.product) throw Object.assign(new Error('product is required'), { code: 'VALIDATION_ERROR' });

  const store = load();
  const now = new Date().toISOString();
  const campaign = {
    id:          randomUUID(),
    name:        data.name || `Kampagne ${new Date().toLocaleDateString('de-DE')}`,
    goal:        data.goal,
    product:     data.product,
    audience:    data.audience || '',
    platforms:   Array.isArray(data.platforms) && data.platforms.length ? data.platforms : ['manual'],
    tone:        data.tone || 'professional',
    language:    data.language || 'de',
    budgetCents: Number(data.budgetCents) || 0,
    currency:    data.currency || 'EUR',
    scheduleAt:  data.scheduleAt || null,
    status:      'draft',
    dagRunId:    null,
    contentPlan: null,
    performance: null,
    createdAt:   now,
    updatedAt:   now,
  };

  store.campaigns.push(campaign);
  save(store);

  // Create budget if set
  if (campaign.budgetCents > 0) {
    budgetSvc.createBudget({
      campaignId:  campaign.id,
      amountCents: campaign.budgetCents,
      currency:    campaign.currency,
      label:       campaign.name,
    });
  }

  logger.info('campaign.created', { campaignId: campaign.id, name: campaign.name });
  return campaign;
}

function updateCampaignField(id, fields) {
  const store = load();
  const idx = store.campaigns.findIndex(c => c.id === id);
  if (idx === -1) return null;
  const allowed = ['name', 'goal', 'product', 'audience', 'platforms', 'tone', 'language', 'budgetCents', 'currency', 'scheduleAt', 'status', 'dagRunId', 'contentPlan', 'performance'];
  allowed.forEach(key => { if (fields[key] !== undefined) store.campaigns[idx][key] = fields[key]; });
  store.campaigns[idx].updatedAt = new Date().toISOString();
  save(store);
  return store.campaigns[idx];
}

function deleteCampaign(id) {
  return updateCampaignField(id, { status: 'deleted' }) !== null;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
async function executeCampaign(id, ctx = {}) {
  const campaign = getCampaign(id);
  if (!campaign) throw Object.assign(new Error('Campaign not found'), { code: 'NOT_FOUND' });
  if (campaign.status === 'running') throw Object.assign(new Error('Campaign already running'), { code: 'ALREADY_RUNNING' });

  // Budget check
  if (campaign.budgetCents > 0) {
    const budgetCheck = budgetSvc.checkBudget(id, 0);
    if (budgetCheck && budgetCheck.status === 'exhausted') {
      throw Object.assign(new Error('Campaign budget exhausted'), { code: 'BUDGET_EXHAUSTED' });
    }
  }

  updateCampaignField(id, { status: 'running' });
  logger.info('campaign.execution.started', { campaignId: id, platforms: campaign.platforms });

  try {
    const { executeDag } = require('../dag/dag.runtime.service');
    const dagInput = buildCampaignDagPayload(campaign);
    const dagResult = await executeDag(dagInput, {
      userId:   ctx?.pki?.userId   || ctx?.userId   || 'system',
      tenantId: ctx?.pki?.tenantId || ctx?.tenantId || 'default',
      role:     ctx?.pki?.role     || ctx?.role     || 'admin',
    });

    // Extract content plan from DAG output
    const contentPlan = extractContentPlan(dagResult, campaign);

    updateCampaignField(id, {
      status:     'completed',
      dagRunId:   dagResult.runId,
      contentPlan,
    });

    logger.info('campaign.execution.completed', { campaignId: id, dagRunId: dagResult.runId });
    return { success: true, campaignId: id, dagRunId: dagResult.runId, contentPlan };
  } catch (e) {
    updateCampaignField(id, { status: 'failed' });
    logger.error('campaign.execution.failed', { campaignId: id, error: e.message });
    throw e;
  }
}

function extractContentPlan(dagResult, campaign) {
  try {
    // Try to get text output from terminal nodes
    const output = dagResult.result;
    const text = typeof output === 'string'
      ? output
      : output?.text || output?.output?.text || JSON.stringify(output || {}).slice(0, 2000);

    return {
      generatedAt: new Date().toISOString(),
      platforms:   campaign.platforms,
      content:     text,
      status:      'ready_for_review',
      note:        campaign.platforms.includes('manual')
        ? 'Kein Social-Connector konfiguriert — Content ist zur manuellen Veröffentlichung bereit.'
        : 'Content generiert — Connector-Publishing verfügbar wenn Social-Connectors konfiguriert sind.',
    };
  } catch {
    return { generatedAt: new Date().toISOString(), content: null, status: 'extraction_failed' };
  }
}

function getCampaignStatus(id) {
  const campaign = getCampaign(id);
  if (!campaign) return null;
  const budget = budgetSvc.getBudgetStatus(id);
  return { ...campaign, budget: budget || null };
}

// ---------------------------------------------------------------------------
// Seed campaign DAG template in dag.registry.store
// ---------------------------------------------------------------------------
function seedCampaignDag() {
  try {
    const registry = require('../dag/dag.registry.store');
    registry.ensureSeed({
      dagId: CAMPAIGN_DAG_ID,
      name:  'Campaign Orchestrator',
      seeded: true,
      nodes: [
        { id: 'brief_parse',      type: 'task',         workerType: 'chat',     prompt: 'Parse campaign brief and extract key messaging points, target audience, and platform requirements.' },
        { id: 'content_generate', type: 'task',         workerType: 'chat',     prompt: 'Generate compelling campaign content for the specified platforms, audience, and tone.' },
        { id: 'budget_check',     type: 'task',         workerType: 'chat',     prompt: 'Evaluate budget feasibility and estimate cost per platform post.' },
        { id: 'policy_check',     type: 'policy_check'                                                                                                                       },
        { id: 'platform_prepare', type: 'task',         workerType: 'chat',     prompt: 'Format and adapt content for each target platform (character limits, hashtags, media specs).' },
        { id: 'report_merge',     type: 'merge'                                                                                                                               },
      ],
      edges: [
        { from: 'brief_parse',      to: 'content_generate' },
        { from: 'brief_parse',      to: 'budget_check'     },
        { from: 'content_generate', to: 'policy_check'     },
        { from: 'budget_check',     to: 'policy_check'     },
        { from: 'policy_check',     to: 'platform_prepare' },
        { from: 'platform_prepare', to: 'report_merge'     },
      ],
    });
    logger.info('campaign.dag.seeded', { dagId: CAMPAIGN_DAG_ID });
  } catch (e) {
    logger.warn('campaign.dag.seed_failed', { error: e.message });
  }
}

// Seed on module load
seedCampaignDag();

module.exports = {
  listCampaigns, getCampaign, createCampaign, updateCampaignField,
  deleteCampaign, executeCampaign, getCampaignStatus, seedCampaignDag,
};

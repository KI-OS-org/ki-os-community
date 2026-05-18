/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const fs = require('fs');
const path = require('path');

const RISK_TIERS = { LOW: 0.2, MEDIUM: 0.5, HIGH: 0.8, CRITICAL: 1.0 };

const POLICY_PACKS = {
  community: { allowedTools: ['ask', 'agentmesh', 'swarm', 'tower', 'sessions', 'roles'], maxCostUsd: 10, requireApproval: false },
  enterprise: { allowedTools: ['*'], maxCostUsd: 999, requireApproval: true },
};

/**
 * @param {number} score - Risikobewertung 0-1
 * @returns {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'}
 */
function getRiskTier(score) {
  if (score == null || score < 0) return 'LOW';
  if (score <= RISK_TIERS.LOW) return 'LOW';
  if (score <= RISK_TIERS.MEDIUM) return 'MEDIUM';
  if (score <= RISK_TIERS.HIGH) return 'HIGH';
  return 'CRITICAL';
}

/**
 * @param {string} edition - Edition ('community' oder 'enterprise')
 * @returns {{allowedTools: string[], maxCostUsd: number, requireApproval: boolean}}
 */
function getPolicyPack(edition) {
  const activeEdition = edition || process.env.KIOS_EDITION || 'community';
  return POLICY_PACKS[activeEdition] || POLICY_PACKS.community;
}

/**
 * @param {string} toolName - Tool-Name
 * @param {string} edition - Edition
 * @returns {boolean}
 */
function isToolAllowed(toolName, edition) {
  if (!toolName || typeof toolName !== 'string') return false;
  const safeEdition = Object.keys(POLICY_PACKS).includes(edition) ? edition : 'community';
  const pack = getPolicyPack(safeEdition);
  if (!pack.allowedTools) return false;
  if (pack.allowedTools.includes('*')) return true;
  return pack.allowedTools.includes(toolName);
}

/**
 * @param {string} runId - Run-ID
 * @param {string} event - Event-Typ
 * @param {object} metadata - Zusätzliche Metadaten
 */
function auditEvent(runId, event, metadata) {
  const safeRunId = String(runId || '').replace(/\r?\n/g, ' ').slice(0, 128);
  const safeEvent = String(event || '').replace(/\r?\n/g, ' ').slice(0, 128);
  const safeMeta  = (metadata && typeof metadata === 'object') ? metadata : {};
  const auditPath = path.join(process.cwd(), '.ki-os-governance-audit.ndjson');
  const line = JSON.stringify({ ts: new Date().toISOString(), runId: safeRunId, event: safeEvent, metadata: safeMeta }) + '\n';
  try {
    fs.appendFileSync(auditPath, line, 'utf8');
  } catch (err) {
    console.error('[Governance Audit] Schreibfehler:', err.message);
  }
}

/**
 * @returns {{edition: string, policyPack: object, riskTiers: object, auditEnabled: boolean}}
 */
function getGovernanceStatus() {
  const edition = process.env.KIOS_EDITION || 'community';
  return {
    edition,
    policyPack: getPolicyPack(edition),
    riskTiers: RISK_TIERS,
    auditEnabled: true
  };
}

module.exports = { getRiskTier, getPolicyPack, isToolAllowed, auditEvent, getGovernanceStatus, RISK_TIERS, POLICY_PACKS };

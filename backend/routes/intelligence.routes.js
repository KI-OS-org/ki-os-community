/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';
const http = require('http');
const express = require('express');
const router = express.Router();

const { scanFeatures } = require('../services/intelligence/feature-scout.service');
const {
  analyzeImpact,
  MAX_AUTO_COST_USD
} = require('../services/intelligence/impact-analyzer.service');
const { createProposal, getProposals, updateProposalStatus } = require('../services/intelligence/sprint-proposer.service');
const { getRecommendation } = require('../services/routing/learned.router');

function startAgentMeshRun(feature) {
  const payload = JSON.stringify({
    taskDescription: `Auto-build: ${feature.name} — ${feature.description}`,
    mode: 'runtime',
    autoTriggered: true
  });
  const port = process.env.PORT || 3000;

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/agentmesh/runs',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }
    }, (res) => {
      res.resume();
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
          return;
        }

        reject(new Error(`HTTP ${res.statusCode || 'unknown'}`));
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function processFeature(feature) {
  const analysis = analyzeImpact(feature);
  const result = { feature, analysis };

  if (analysis.action === 'BUILD') {
    const proposal = createProposal(feature, analysis);
    result.autoBuilt = analysis.estimatedCostUsd <= MAX_AUTO_COST_USD;
    result.proposed = !result.autoBuilt;
    result.proposalId = proposal.id;

    if (result.autoBuilt) {
      try {
        await startAgentMeshRun(feature);
      } catch (err) {
        console.warn('[Intelligence] Auto-build trigger fehlgeschlagen:', err.message);
      }
    }
  } else if (analysis.action === 'PROPOSE') {
    const proposal = createProposal(feature, analysis);
    result.autoBuilt = false;
    result.proposed = true;
    result.proposalId = proposal.id;
  } else {
    result.autoBuilt = false;
    result.proposed = false;
    result.proposalId = null;
  }

  return result;
}

async function runIntelligenceScan() {
  const features = await scanFeatures();
  const results = [];

  for (const feature of features) {
    results.push(await processFeature(feature));
  }

  return {
    features,
    results,
    proposed: results.filter((item) => item.proposed).length,
    built: results.filter((item) => item.autoBuilt).length
  };
}

router.get('/proposals', async (req, res) => {
  try {
    const proposals = await getProposals();
    res.json({ success: true, data: proposals, count: proposals.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/scan', async (req, res) => {
  try {
    const scanResult = await runIntelligenceScan();
    const firstProposal = scanResult.results.find((item) => item.proposalId);

    res.json({
      success: true,
      scanned: scanResult.features.length,
      proposed: scanResult.proposed > 0,
      proposedCount: scanResult.proposed,
      built: scanResult.built,
      autoBuilt: scanResult.built > 0,
      proposalId: firstProposal ? firstProposal.proposalId : null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/proposals/:id', async (req, res) => {
  try {
    const { status } = req.body || {};
    updateProposalStatus(req.params.id, status);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/router/recommend', async (req, res) => {
  try {
    const task = req.query?.task;
    const budget = parseFloat(req.query?.budget || 0);
    const recommendation = getRecommendation(task, budget);
    res.json({ success: true, recommendation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

if (
  process.env.INTELLIGENCE_AUTO_SCAN === 'true' &&
  !global._kios_intelligence_scan_started
) {
  global._kios_intelligence_scan_started = true;
  const intervalMs = Number(process.env.INTELLIGENCE_SCAN_INTERVAL_MS || 86400000);

  console.log('[Intelligence] Auto-Scan aktiviert...');

  setTimeout(() => {
    runIntelligenceScan().catch((err) => {
      console.warn('[Intelligence] Auto-Scan fehlgeschlagen:', err.message);
    });

    setInterval(() => {
      runIntelligenceScan().catch((err) => {
        console.warn('[Intelligence] Auto-Scan fehlgeschlagen:', err.message);
      });
    }, intervalMs);
  }, 60000);
}

module.exports = router;

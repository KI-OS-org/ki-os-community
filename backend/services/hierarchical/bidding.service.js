/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Hierarchical Bidding Service
 * Selects agents through quality/cost/latency bids and records economic decisions.
 *
 * @license AGPL-3.0-only
 */
'use strict';

let economic;
try {
  economic = require('../economic/economic.service');
} catch {
  economic = null;
}

function normalizeBudget(task = {}, fallback = 1) {
  const value = Number(task.budgetUSD ?? task.maxCostUSD ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

class BiddingService {
  constructor(options = {}) {
    this.qualityWeight = Number(options.qualityWeight ?? 0.58);
    this.costWeight = Number(options.costWeight ?? 0.27);
    this.latencyWeight = Number(options.latencyWeight ?? 0.15);
    this.decisions = [];
  }

  collectBids(task, agents, context = {}) {
    return (agents || [])
      .filter(agent => agent && typeof agent.bid === 'function' && (!agent.canHandle || agent.canHandle(task)))
      .map(agent => agent.bid(task, context));
  }

  scoreBid(bid, task = {}) {
    const budgetUSD = normalizeBudget(task, 0.1);
    const latencyTargetMs = Number(task.latencyTargetMs || 2500);
    const costScore = Math.max(0, Math.min(1, 1 - (Number(bid.estimatedCostUSD || 0) / Math.max(0.0001, budgetUSD))));
    const latencyScore = Math.max(0, Math.min(1, 1 - (Number(bid.estimatedLatencyMs || 0) / Math.max(1, latencyTargetMs * 2))));
    const qualityScore = Math.max(0, Math.min(1, Number(bid.quality || 0)));
    return Number((
      qualityScore * this.qualityWeight +
      costScore * this.costWeight +
      latencyScore * this.latencyWeight
    ).toFixed(4));
  }

  decide(task, agents, context = {}) {
    const bids = this.collectBids(task, agents, context)
      .map(bid => ({ ...bid, score: this.scoreBid(bid, task) }))
      .sort((a, b) => b.score - a.score || a.estimatedCostUSD - b.estimatedCostUSD);

    if (!bids.length) {
      throw new Error(`No agent bids available for task ${task.id || task.title || 'unknown'}`);
    }

    const winner = bids[0];
    let economicDecision = null;
    if (economic && typeof economic.evaluateEconomicDecision === 'function') {
      try {
        economicDecision = economic.evaluateEconomicDecision({
          taskClass: task.capability || task.domain || 'generic',
          provider: 'hierarchical',
          model: winner.agentId,
          budgetCents: Math.round(normalizeBudget(task, 0.1) * 100),
          trustScore: Math.round((winner.quality || 0) * 100),
          outcomeCoverage: winner.capabilityMatch || 0.5,
          latencyMs: winner.estimatedLatencyMs,
          roiSignal: winner.score
        });
      } catch {
        economicDecision = null;
      }
    }

    const decision = {
      taskId: task.id,
      winner,
      bids,
      economicDecision,
      createdAt: new Date().toISOString()
    };
    this.decisions.unshift(decision);
    this.decisions = this.decisions.slice(0, 200);
    return decision;
  }

  getStats() {
    const winners = {};
    for (const decision of this.decisions) {
      const id = decision.winner?.agentId || 'unknown';
      winners[id] = (winners[id] || 0) + 1;
    }
    return {
      totalDecisions: this.decisions.length,
      winners,
      lastDecisionAt: this.decisions[0]?.createdAt || null
    };
  }
}

module.exports = { BiddingService };

/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Hierarchical Specialist Agent
 * Domain-specific worker for research, coding, writing and review.
 *
 * @license AGPL-3.0-only
 */
'use strict';

const { WorkerAgent } = require('./worker.agent');

const DOMAIN_DEFAULTS = {
  research: { quality: 0.9, costPerTask: 0.055, latencyMs: 1400 },
  coding: { quality: 0.88, costPerTask: 0.065, latencyMs: 1500 },
  writing: { quality: 0.84, costPerTask: 0.04, latencyMs: 1100 },
  review: { quality: 0.91, costPerTask: 0.05, latencyMs: 1200 }
};

class SpecialistAgent extends WorkerAgent {
  constructor(options = {}) {
    const domain = String(options.domain || 'generic').toLowerCase();
    const defaults = DOMAIN_DEFAULTS[domain] || {};
    super({
      ...defaults,
      ...options,
      id: options.id || `specialist-${domain}-${Math.random().toString(36).slice(2, 8)}`,
      name: options.name || `${domain}-specialist`,
      capabilities: [domain, ...(options.capabilities || [])]
    });
    this.role = 'SPECIALIST';
    this.type = 'specialist';
    this.domain = domain;
  }

  canHandle(task = {}) {
    if (!this.active) return false;
    const required = String(task.capability || task.domain || 'generic').toLowerCase();
    return required === this.domain || this.capabilities.includes(required);
  }

  bid(task = {}, context = {}) {
    const bid = super.bid(task, context);
    const exactDomain = String(task.capability || task.domain || '').toLowerCase() === this.domain;
    return {
      ...bid,
      domain: this.domain,
      quality: Math.min(0.99, bid.quality + (exactDomain ? 0.08 : 0.02)),
      rationale: exactDomain ? 'specialist_domain_match' : bid.rationale
    };
  }

  async execute(task = {}, context = {}) {
    this.completedTasks += 1;
    const title = task.title || task.id || `${this.domain} subtask`;
    const domainOutput = {
      research: `Research synthesis for ${title}: key facts, assumptions and knowledge gaps identified.`,
      coding: `Coding execution for ${title}: implementation approach, integration points and verification notes prepared.`,
      writing: `Writing output for ${title}: response structure, tone and final wording drafted.`,
      review: `Review for ${title}: risks, quality checks and follow-up findings assessed.`
    }[this.domain] || `Specialist execution for ${title}.`;

    return {
      agentId: this.id,
      role: this.role,
      domain: this.domain,
      taskId: task.id,
      status: 'completed',
      output: `${domainOutput}\nScope: ${task.description || title}`,
      artifacts: [{ type: `${this.domain}_note`, content: domainOutput }],
      metrics: {
        quality: this.quality,
        costUSD: this.costPerTask,
        latencyMs: this.latencyMs
      }
    };
  }

  toA2AAgent() {
    const agent = super.toA2AAgent();
    agent.metadata.domain = this.domain;
    return agent;
  }
}

module.exports = { SpecialistAgent, DOMAIN_DEFAULTS };

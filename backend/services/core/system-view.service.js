/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license Proprietär — https://ki-os.org/license
 * @desc System View / Telemetry Service — privacy-safe event tracking, nicht auf GitHub
 */
'use strict';

const logger = require('./logger.service');
const METRICS = { requests: 0, errors: 0, violations: 0, evidence_gaps: 0 };

class TelemetryService {
  logEvent(type, data = {}) {
    METRICS.requests++;
    if (type === 'error') METRICS.errors++;
    if (type === 'contract_violation') METRICS.violations++;

    if (type === 'verification' && data.issues_count > 0) {
      METRICS.evidence_gaps += data.issues_count;
    }

    const safeData = { ...data };
    ['userId', 'user_id', 'email', 'tenantId', 'query', 'message', 'input_text'].forEach(key => delete safeData[key]);

    logger.info('telemetry.event', {
      level: 'INFO',
      event: type,
      timestamp: new Date().toISOString(),
      meta: safeData,
    });
  }

  getStats() { return METRICS; }
}

module.exports = new TelemetryService();

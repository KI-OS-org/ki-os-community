/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Ghost Control — Ghost Executor Service
 * 
 * Führt Ghost Steps im Backend aus.
 * Verarbeitet API-Calls und andere Backend-Aktionen.
 * 
 * @module services/ghost/ghost-executor.service.js
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 */

const http = require('http');
const https = require('https');
const { updateSession, writeGhostAudit } = require('./ghost.security');
const { push: emitUI } = require('../ui/ui.eventbus');

const GHOST_SYSTEM_USER_ID = 'ghost-system';
const GHOST_SYSTEM_ROLE = 'system';
const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const ALLOWED_API_ENDPOINTS = new Set(
  (process.env.GHOST_ALLOWED_API_ENDPOINTS || '/api/agents')
    .split(',')
    .map(endpoint => endpoint.trim())
    .filter(Boolean)
);

/**
 * Ghost Executor Service
 */
class GhostExecutorService {
  /**
   * Führt einen Ghost Step aus
   * 
   * @param {Object} step - GhostStep
   * @param {Object} context - Execution Context
   * @returns {Promise<Object>}
   */
  async executeStep(step, context = {}) {
    try {
      switch (step.type) {
        case 'api_call':
          return await this.executeApiCall(step, context);
        
        case 'confirm':
          return await this.waitForConfirmation(step, context);
        
        case 'speak':
          return await this.executeSpeak(step, context);
        
        default:
          return { success: true, message: `Step ${step.type} executed` };
      }
    } catch (error) {
      console.error('[GhostExecutor] Error executing step:', error);
      return {
        success: false,
        error: error.message,
        stepId: step.id,
      };
    }
  }

  /**
   * Führt API-Call aus
   */
  async executeApiCall(step, context) {
    const { target, payload } = step;
    
    if (!target || !payload) {
      throw new Error('API call requires target and payload');
    }

    console.log('[GhostExecutor] Executing API call:', target);

    // API-Call ausführen
    const result = await this.makeApiRequest(target, payload, context);

    // Audit-Log Eintrag erstellen
    await this.logToAudit(step, result, context);

    return {
      success: true,
      result,
      stepId: step.id,
    };
  }

  /**
   * Macht HTTP-Request
   */
  async makeApiRequest(endpoint, payload, context = {}) {
    const url = await this.resolveApiEndpoint(endpoint, context);

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-User-Id': GHOST_SYSTEM_USER_ID,
          'X-Role': GHOST_SYSTEM_ROLE,
          'X-User-Role': GHOST_SYSTEM_ROLE,
          'X-Trace-Id': context.traceId || `ghost-${Date.now()}`,
        },
      };

      const transport = url.protocol === 'https:' ? https : http;
      const req = transport.request(options, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve({ raw: data });
            }
          } else {
            reject(new Error(`API Error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('API Timeout'));
      });
      
      req.write(postData);
      req.end();
    });
  }

  /**
   * Validiert und normalisiert interne API-Routes.
   */
  async resolveApiEndpoint(endpoint, context = {}) {
    const rawEndpoint = String(endpoint || '').trim();

    const deny = async (reason) => {
      await this.logSecurityEvent({
        reason,
        target: rawEndpoint || '<empty>',
        traceId: context.traceId,
      });
      throw new Error(`Blocked unsafe Ghost API target: ${reason}`);
    };

    if (!rawEndpoint) {
      await deny('missing_target');
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(rawEndpoint) || rawEndpoint.startsWith('//')) {
      await deny('absolute_url_not_allowed');
    }

    if (rawEndpoint.includes('\\')) {
      await deny('invalid_path_separator');
    }

    if (!rawEndpoint.startsWith('/api/')) {
      await deny('non_api_route_not_allowed');
    }

    let url;
    try {
      url = new URL(rawEndpoint, process.env.API_BASE_URL || DEFAULT_API_BASE_URL);
    } catch (error) {
      await deny('invalid_url');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      await deny('unsupported_protocol');
    }

    if (!url.pathname.startsWith('/api/')) {
      await deny('path_traversal_outside_api');
    }

    if (!ALLOWED_API_ENDPOINTS.has(url.pathname)) {
      await deny('endpoint_not_allowlisted');
    }

    return url;
  }

  /**
   * Audit-Log für blockierte Ghost-Security-Events.
   */
  async logSecurityEvent(event) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'ghost_api_call_blocked',
      userId: GHOST_SYSTEM_USER_ID,
      role: GHOST_SYSTEM_ROLE,
      status: 'blocked',
      reason: event.reason,
      decisionReason: event.reason,
      target: event.target,
      traceId: event.traceId,
    };

    console.error('[GhostExecutor] Blocked unsafe API call:', event.reason, event.target);

    try {
      const fs = require('fs').promises;
      const path = require('path');
      const auditFile = process.env.GHOST_AUDIT_FILE || path.join(process.cwd(), '.ki-os-audit.ndjson');

      await fs.appendFile(auditFile, JSON.stringify(auditEntry) + '\n', 'utf-8');
    } catch (error) {
      console.error('[GhostExecutor] Failed to write security audit log:', error);
    }
  }

  /**
   * Wartet auf User-Confirmation
   */
  async waitForConfirmation(step, context) {
    console.log('[GhostExecutor] Waiting for confirmation:', step.callout);
    await writeGhostAudit('ghost_confirmation_required', {
      stepId: step.id,
      stepType: step.type,
      decisionReason: 'step_requires_user_confirmation',
    }, context).catch(() => {});
    
    // In der Frontend-Implementation wird hier auf User-Input gewartet
    // Für Backend-Execution geben wir nur den Status zurück
    return {
      success: true,
      requiresConfirmation: true,
      message: step.callout,
      stepId: step.id,
    };
  }

  /**
   * Führt Speak-Step aus (nur Logging im Backend)
   */
  async executeSpeak(step, context) {
    console.log('[GhostExecutor] Speak:', step.callout);
    
    return {
      success: true,
      message: step.callout,
      stepId: step.id,
    };
  }

  /**
   * Schreibt ins Audit-Log
   */
  async logToAudit(step, result, context) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'ghost_api_call',
      userId: GHOST_SYSTEM_USER_ID,
      role: GHOST_SYSTEM_ROLE,
      ip: context.ip || 'unknown',
      route: context.route || null,
      status: 'ok',
      details: `Ghost executed API call: ${step.target}`,
      decisionReason: 'allowlisted_internal_api_call',
      stepId: step.id,
      stepType: step.type,
      result: result.id || 'unknown',
      traceId: context.traceId,
    };

    // Audit-Log speichern
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const auditFile = process.env.GHOST_AUDIT_FILE || path.join(process.cwd(), '.ki-os-audit.ndjson');
      
      await fs.appendFile(auditFile, JSON.stringify(auditEntry) + '\n', 'utf-8');
      console.log('[GhostExecutor] Audit log entry created');
    } catch (error) {
      console.error('[GhostExecutor] Failed to write audit log:', error);
    }
  }

  /**
   * Führt gesamten Plan aus
   */
  async executePlan(plan, context = {}) {
    const results = [];
    
    console.log('[GhostExecutor] Starting plan execution:', plan.id);
    await writeGhostAudit('ghost_plan_execution_start', {
      planId: plan.id,
      sessionId: plan.sessionId,
      stepCount: Array.isArray(plan.steps) ? plan.steps.length : 0,
      decisionReason: 'executor_started_plan',
    }, context).catch(() => {});

    emitUI('ghost.plan.executing', { planId: plan.id, title: plan.title, stepCount: plan.steps.length });
    try {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];

        console.log(`[GhostExecutor] Executing step ${i + 1}/${plan.steps.length}:`, step.type);
        emitUI('ghost.step.started', { planId: plan.id, stepId: step.id, type: step.type, callout: step.callout, stepNum: i + 1, total: plan.steps.length });
        const result = await this.executeStep(step, context);
        emitUI('ghost.step.completed', { planId: plan.id, stepId: step.id, type: step.type, success: result.success !== false });
        results.push(result);
        
        // Bei API-Calls mit Confirmation warten
        if (result.requiresConfirmation) {
          console.log('[GhostExecutor] Waiting for user confirmation...');
          // Frontend wird hier den User fragen
          break;
        }
        
        // Kurze Pause zwischen Steps
        if (step.duration) {
          await this.sleep(step.duration);
        }
      }

      const completed = {
        planId: plan.id,
        sessionId: plan.sessionId,
        results,
        completedAt: new Date().toISOString(),
      };

      emitUI('ghost.plan.completed', { planId: plan.id, title: plan.title, stepCount: results.length });
      await writeGhostAudit('ghost_plan_execution_end', {
        planId: plan.id,
        sessionId: plan.sessionId,
        resultCount: results.length,
        decisionReason: 'executor_finished_plan',
      }, context).catch(() => {});

      return completed;
    } catch (error) {
      await writeGhostAudit('ghost_plan_execution_failed', {
        planId: plan.id,
        sessionId: plan.sessionId,
        error: error.message,
        decisionReason: 'executor_step_failed',
      }, context).catch(() => {});
      throw error;
    }
  }

  /**
   * Sleep Helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Session-Status speichern
   */
  async saveSession(sessionId, status) {
    try {
      await updateSession(sessionId, status);
    } catch (error) {
      console.error('[GhostExecutor] Failed to save session:', error);
    }
  }
}

module.exports = GhostExecutorService;

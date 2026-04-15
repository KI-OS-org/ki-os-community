/**
 * Ghost Control — Ghost Executor Service
 * 
 * Führt Ghost Steps im Backend aus.
 * Verarbeitet API-Calls und andere Backend-Aktionen.
 * 
 * @module services/ghost/ghost-executor.service.js
 */

const https = require('https');
const auditLog = require('../ui/runtime.store');

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

    console.log('[GhostExecutor] Executing API call:', target, payload);

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
  makeApiRequest(endpoint, payload, context) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, process.env.API_BASE_URL || 'http://localhost:3000');
      
      const postData = JSON.stringify(payload);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-User-Id': context.userId || 'ghost-system',
          'X-Role': context.role || 'system',
          'X-Trace-Id': context.traceId || `ghost-${Date.now()}`,
        },
      };

      const req = https.request(options, (res) => {
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
   * Wartet auf User-Confirmation
   */
  async waitForConfirmation(step, context) {
    console.log('[GhostExecutor] Waiting for confirmation:', step.callout);
    
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
      userId: context.userId || 'ghost-system',
      status: 'ok',
      details: `Ghost executed API call: ${step.target}`,
      stepId: step.id,
      stepType: step.type,
      result: result.id || 'unknown',
      traceId: context.traceId,
    };

    // Audit-Log speichern
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const auditFile = path.join(process.cwd(), '.ki-os-audit.ndjson');
      
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

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      
      console.log(`[GhostExecutor] Executing step ${i + 1}/${plan.steps.length}:`, step.type);
      
      const result = await this.executeStep(step, context);
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

    return {
      planId: plan.id,
      sessionId: plan.sessionId,
      results,
      completedAt: new Date().toISOString(),
    };
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
      const fs = require('fs').promises;
      const path = require('path');
      const sessionFile = path.join(process.cwd(), '.ki-os-ghost-sessions.json');
      
      let sessions = {};
      try {
        const data = await fs.readFile(sessionFile, 'utf-8');
        sessions = JSON.parse(data);
      } catch (e) {
        // File existiert nicht
      }
      
      sessions[sessionId] = {
        ...sessions[sessionId],
        ...status,
        updatedAt: new Date().toISOString(),
      };
      
      await fs.writeFile(sessionFile, JSON.stringify(sessions, null, 2), 'utf-8');
    } catch (error) {
      console.error('[GhostExecutor] Failed to save session:', error);
    }
  }
}

module.exports = GhostExecutorService;

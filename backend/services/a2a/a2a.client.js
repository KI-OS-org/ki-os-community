/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS A2A Client SDK
 * 
 * Einfache Client-Bibliothek für Agent-Integration.
 * 
 * Usage:
 * ```javascript
 * const client = new A2AClient({
 *   agentId: 'my-agent',
 *   agentName: 'My Agent',
 *   capabilities: ['web-search', 'data-analysis'],
 * });
 * 
 * await client.connect();
 * 
 * // Nachrichten empfangen
 * client.on('message', (msg) => {
 *   console.log('Received:', msg);
 *   client.acknowledge(msg.messageId);
 * });
 * 
 * // Nachricht senden
 * await client.send({
 *   to: 'other-agent',
 *   type: 'task_request',
 *   payload: { query: 'Search for...' },
 * });
 * 
 * await client.close();
 * ```
 * 
 * @module services/a2a/a2a.client
 * @license AGPL-3.0
 */

'use strict';

const EventEmitter = require('events');
const http = require('http');

const DEFAULT_BASE_URL = 'http://localhost:3000';

class A2AClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      baseUrl: options.baseUrl || process.env.A2A_BASE_URL || DEFAULT_BASE_URL,
      agentId: options.agentId || null,
      agentName: options.agentName || 'unknown',
      agentType: options.agentType || 'generic',
      capabilities: options.capabilities || [],
      heartbeatInterval: options.heartbeatInterval || 30000,
      pollInterval: options.pollInterval || 5000,
    };
    
    this.agentId = null;
    this.connected = false;
    this.pollTimer = null;
    this.heartbeatTimer = null;
  }
  
  /**
   * Verbindung herstellen
   */
  async connect() {
    if (this.connected) {
      return;
    }
    
    // Agent registrieren
    const agentInfo = await this._register();
    this.agentId = agentInfo.id;
    
    console.log(`[A2AClient] Connected as ${this.agentId}`);
    
    this.connected = true;
    
    // Poll-Loop starten
    this._startPolling();
    
    // Heartbeat-Loop starten
    this._startHeartbeat();
    
    return agentInfo;
  }
  
  /**
   * Verbindung trennen
   */
  async close() {
    if (!this.connected) {
      return;
    }
    
    // Timer stoppen
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    // Agent abmelden
    if (this.agentId) {
      await this._unregister();
    }
    
    this.connected = false;
    console.log('[A2AClient] Closed');
  }
  
  /**
   * Nachricht senden
   * @param {object} message - Nachricht
   * @returns {object} Gesendete Nachricht
   */
  async send(message) {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    
    return await this._request('POST', '/api/a2a/send', {
      ...message,
      from: this.agentId,
    });
  }
  
  /**
   * Broadcast senden
   * @param {object} message - Nachricht
   * @returns {number} Anzahl Empfänger
   */
  async broadcast(message) {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    
    return await this._request('POST', '/api/a2a/broadcast', {
      ...message,
      from: this.agentId,
    });
  }
  
  /**
   * Nachricht als gelesen markieren
   * @param {string} messageId - Nachrichten-ID
   * @returns {boolean} Erfolg
   */
  async acknowledge(messageId) {
    return await this._request('DELETE', `/api/a2a/messages/${messageId}`);
  }
  
  /**
   * Nachricht als abgeschlossen markieren
   * @param {string} messageId - Nachrichten-ID
   * @param {object} result - Ergebnis
   * @returns {boolean} Erfolg
   */
  async complete(messageId, result = {}) {
    return await this._request('POST', `/api/a2a/messages/${messageId}/complete`, {
      result,
    });
  }
  
  /**
   * Agent-Status aktualisieren
   * @param {string} status - Status (active, busy, offline)
   * @returns {boolean} Erfolg
   */
  async updateStatus(status) {
    return await this._request('PATCH', `/api/a2a/agents/${this.agentId}/status`, {
      status,
    });
  }
  
  /**
   * Alle Agents holen
   * @returns {Array} Agents
   */
  async getAgents() {
    return await this._request('GET', '/api/a2a/agents');
  }
  
  /**
   * Agents mit Capability holen
   * @param {string} capability - Capability
   * @returns {Array} Agents
   */
  async getAgentsByCapability(capability) {
    return await this._request('GET', `/api/a2a/agents/capabilities/${capability}`);
  }
  
  /**
   * Agent-Info holen
   * @param {string} agentId - Agent-ID
   * @returns {object} Agent-Info
   */
  async getAgent(agentId) {
    return await this._request('GET', `/api/a2a/agents/${agentId}`);
  }
  
  /**
   * Agent-Stats holen
   * @returns {object} Stats
   */
  async getStats() {
    return await this._request('GET', '/api/a2a/stats');
  }
  
  /**
   * Agent registrieren
   * @private
   */
  async _register() {
    return await this._request('POST', '/api/a2a/agents', {
      id: this.config.agentId,
      name: this.config.agentName,
      type: this.config.agentType,
      capabilities: this.config.capabilities,
      endpoint: null, // Optional: Callback-URL für Push-Nachrichten
    });
  }
  
  /**
   * Agent abmelden
   * @private
   */
  async _unregister() {
    return await this._request('DELETE', `/api/a2a/agents/${this.agentId}`);
  }
  
  /**
   * Poll-Loop starten
   * @private
   */
  _startPolling() {
    this.pollTimer = setInterval(async () => {
      try {
        const messages = await this._request('GET', `/api/a2a/messages/${this.agentId}?limit=100`);
        
        for (const msg of messages) {
          // Event emitieren
          this.emit('message', msg);
          
          // Spezifische Event-Typs
          this.emit(`message:${msg.type}`, msg);
        }
      } catch (error) {
        console.error('[A2AClient] Poll error:', error.message);
        this.emit('error', error);
      }
    }, this.config.pollInterval);
  }
  
  /**
   * Heartbeat-Loop starten
   * @private
   */
  _startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this._request('POST', `/api/a2a/agents/${this.agentId}/heartbeat`);
      } catch (error) {
        console.error('[A2AClient] Heartbeat error:', error.message);
        this.emit('error', error);
      }
    }, this.config.heartbeatInterval);
  }
  
  /**
   * HTTP-Request
   * @private
   */
  _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.config.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data ? { message: data } : {});
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }
}

module.exports = {
  A2AClient,
};

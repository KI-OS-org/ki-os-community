/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS A2A Service
 * 
 * Haupt-Service für Agent-zu-Agent-Kommunikation.
 * Kombiniert EventBus, Registry und MessageStore.
 * 
 * @module services/a2a/a2a.service
 * @license AGPL-3.0
 */

'use strict';

const { a2aBus, publish } = require('./a2a.eventbus');
const { registry, get, getAll, getByCapability, getByType, register, unregister, heartbeat, updateStatus } = require('./a2a.registry');
const { messageStore, save, getForAgent, markAsRead, markAsCompleted, incrementRetry, moveToDeadLetter } = require('./a2a.message.store');

const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000;

class A2AService {
  constructor() {
    this.initialized = false;
    this.heartbeatInterval = null;
  }
  
  /**
   * Service initialisieren
   */
  async init() {
    if (this.initialized) {
      return;
    }
    
    // Registry laden
    await registry.load();
    
    // Message Store initialisieren
    await messageStore.init();
    
    // Event-Handler registrieren
    this._registerEventHandlers();
    
    // Heartbeat-Loop starten (alle 30s)
    this._startHeartbeatLoop();
    
    // Cleanup-Loop starten (alle 5 Min)
    this._startCleanupLoop();
    
    this.initialized = true;
    console.log('[A2AService] Initialized');
  }
  
  /**
   * Agent registrieren
   * @param {object} agentInfo - Agent-Info
   * @returns {object} Registrierte Agent-Info
   */
  async registerAgent(agentInfo) {
    const agent = await register(agentInfo);
    
    // Event veröffentlichen
    publish('agent.registered', { agent });
    
    return agent;
  }
  
  /**
   * Agent abmelden
   * @param {string} agentId - Agent-ID
   * @returns {boolean} Erfolg
   */
  async unregisterAgent(agentId) {
    const removed = await unregister(agentId);
    
    if (removed) {
      publish('agent.unregistered', { agentId });
    }
    
    return removed;
  }
  
  /**
   * Nachricht senden
   * @param {object} message - Nachricht
   * @returns {object} Gesendete Nachricht
   */
  async sendMessage(message) {
    const fullMessage = {
      messageId: this._generateId(),
      type: message.type || 'task_request',
      from: message.from,
      to: message.to,
      payload: message.payload || {},
      timestamp: new Date().toISOString(),
      correlationId: message.correlationId || this._generateId(),
      expiresAt: message.expiresAt || this._expiryDate(30000),
    };
    
    // Persistent speichern
    await save(fullMessage);
    
    // Event veröffentlichen
    publish('agent.task_requested', {
      message: fullMessage,
    });
    
    console.log(`[A2AService] Message sent: ${fullMessage.messageId} from ${fullMessage.from} to ${fullMessage.to}`);
    
    return fullMessage;
  }
  
  /**
   * Broadcast an alle Agents
   * @param {object} message - Nachricht
   * @returns {number} Anzahl Empfänger
   */
  async broadcast(message) {
    const agents = getAll();
    let sent = 0;
    
    for (const agent of agents) {
      if (agent.status === 'active') {
        await this.sendMessage({
          ...message,
          to: agent.id,
        });
        sent++;
      }
    }
    
    console.log(`[A2AService] Broadcast sent to ${sent} agents`);
    
    return sent;
  }
  
  /**
   * Nachrichten für Agent holen
   * @param {string} agentId - Agent-ID
   * @param {number} limit - Maximale Anzahl
   * @returns {Array} Nachrichten
   */
  async getMessages(agentId, limit = 100) {
    return await getForAgent(agentId, limit);
  }
  
  /**
   * Nachricht als gelesen markieren
   * @param {string} messageId - Nachrichten-ID
   * @returns {boolean} Erfolg
   */
  async acknowledgeMessage(messageId) {
    return await markAsRead(messageId);
  }
  
  /**
   * Nachricht als abgeschlossen markieren
   * @param {string} messageId - Nachrichten-ID
   * @param {object} result - Ergebnis
   * @returns {Promise<void>}
   */
  async completeMessage(messageId, result) {
    await markAsCompleted(messageId);
    
    // Response-Event
    publish('agent.task_completed', {
      messageId,
      result,
    });
  }
  
  /**
   * Fehlerhafte Nachricht behandeln (Retry)
   * @param {string} messageId - Nachrichten-ID
   * @param {string} error - Fehlermeldung
   * @returns {Promise<void>}
   */
  async handleMessageError(messageId, error) {
    const result = await incrementRetry(messageId);
    
    if (result.retry_count >= MAX_RETRIES) {
      // Max Retries erreicht -> Dead-Letter
      await moveToDeadLetter(messageId, 'max_retries_exceeded', error);
      
      publish('agent.error', {
        messageId,
        error: 'Max retries exceeded',
      });
      
      console.error(`[A2AService] Message ${messageId} moved to dead-letter queue`);
    } else {
      console.warn(`[A2AService] Message ${messageId} retry ${result.retry_count}/${MAX_RETRIES}`);
    }
  }
  
  /**
   * Agent-Heartbeat
   * @param {string} agentId - Agent-ID
   * @returns {boolean} Erfolg
   */
  async sendHeartbeat(agentId) {
    const success = await heartbeat(agentId);
    
    if (success) {
      publish('agent.heartbeat', { agentId });
    }
    
    return success;
  }
  
  /**
   * Agent-Status aktualisieren
   * @param {string} agentId - Agent-ID
   * @param {string} status - Status
   * @returns {boolean} Erfolg
   */
  async updateAgentStatus(agentId, status) {
    return await updateStatus(agentId, status);
  }
  
  /**
   * Alle Agents holen
   * @returns {Array} Agents
   */
  getAllAgents() {
    return getAll();
  }
  
  /**
   * Agents mit Capability holen
   * @param {string} capability - Capability
   * @returns {Array} Agents
   */
  getAgentsByCapability(capability) {
    return getByCapability(capability);
  }
  
  /**
   * Agents by Type holen
   * @param {string} type - Typ
   * @returns {Array} Agents
   */
  getAgentsByType(type) {
    return getByType(type);
  }
  
  /**
   * A2A-Stats holen
   */
  getStats() {
    return {
      registry: registry.getStats(),
      eventBus: a2aBus.getStats(),
      initialized: this.initialized,
    };
  }
  
  /**
   * Event-Handler registrieren
   * @private
   */
  _registerEventHandlers() {
    // Auf Task-Completed reagieren
    a2aBus.on('agent.task_completed', async (event) => {
      const { messageId } = event.payload;
      if (messageId) {
        await markAsCompleted(messageId);
      }
    });
    
    // Auf Error reagieren
    a2aBus.on('agent.error', async (event) => {
      const { messageId, error } = event.payload;
      if (messageId) {
        await this.handleMessageError(messageId, error);
      }
    });
  }
  
  /**
   * Heartbeat-Loop starten
   * @private
   */
  _startHeartbeatLoop() {
    this.heartbeatInterval = setInterval(async () => {
      // Registry cleanup (expired agents)
      await registry.load();
    }, 30000); // 30s
  }
  
  /**
   * Cleanup-Loop starten
   * @private
   */
  _startCleanupLoop() {
    setInterval(async () => {
      const deleted = await messageStore.cleanup();
      if (deleted > 0) {
        console.log(`[A2AService] Cleaned up ${deleted} expired messages`);
      }
    }, 300000); // 5 Min
  }
  
  /**
   * Unique ID generieren
   * @private
   */
  _generateId() {
    return `a2a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Expiry-Datum berechnen
   * @private
   */
  _expiryDate(timeoutMs) {
    return new Date(Date.now() + timeoutMs).toISOString();
  }
  
  /**
   * Service stoppen
   */
  async shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    await messageStore.close();
    
    console.log('[A2AService] Shutdown complete');
  }
}

// Singleton
const _instance = new A2AService();

module.exports = {
  A2AService,
  a2aService: _instance,
  init: () => _instance.init(),
  registerAgent: (agent) => _instance.registerAgent(agent),
  unregisterAgent: (agentId) => _instance.unregisterAgent(agentId),
  sendMessage: (message) => _instance.sendMessage(message),
  broadcast: (message) => _instance.broadcast(message),
  getMessages: (agentId, limit) => _instance.getMessages(agentId, limit),
  acknowledgeMessage: (messageId) => _instance.acknowledgeMessage(messageId),
  completeMessage: (messageId, result) => _instance.completeMessage(messageId, result),
  handleMessageError: (messageId, error) => _instance.handleMessageError(messageId, error),
  sendHeartbeat: (agentId) => _instance.sendHeartbeat(agentId),
  updateAgentStatus: (agentId, status) => _instance.updateAgentStatus(agentId, status),
  getAllAgents: () => _instance.getAllAgents(),
  getAgentsByCapability: (capability) => _instance.getAgentsByCapability(capability),
  getAgentsByType: (type) => _instance.getAgentsByType(type),
  getStats: () => _instance.getStats(),
  shutdown: () => _instance.shutdown(),
};

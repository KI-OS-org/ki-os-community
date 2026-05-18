/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS A2A Agent Registry
 * 
 * Registrierung und Discovery von Agents.
 * Speichert Agent-Info, Capabilities, Health-Status.
 * 
 * @module services/a2a/a2a.registry
 * @license AGPL-3.0
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');

const REGISTRY_FILE = process.env.A2A_REGISTRY_FILE || path.join(__dirname, '..', '..', '..', '.ki-os-a2a-registry.json');

class A2ARegistry {
  constructor() {
    this.agents = new Map();
    this.file = REGISTRY_FILE;
  }
  
  /**
   * Registry laden
   */
  async load() {
    try {
      const data = await fs.readFile(this.file, 'utf-8');
      const parsed = JSON.parse(data);
      
      this.agents = new Map(Object.entries(parsed.agents || {}));
      
      // Expired Agents entfernen
      this._cleanupExpired();
      
      return this.agents.size;
    } catch (error) {
      // Datei existiert nicht - leer starten
      this.agents = new Map();
      return 0;
    }
  }
  
  /**
   * Agent registrieren
   * @param {object} agent - Agent-Info
   * @returns {object} Registrierte Agent-Info
   */
  async register(agent) {
    const agentInfo = {
      id: agent.id || this._generateId(),
      name: agent.name || 'unknown',
      type: agent.type || 'generic',
      capabilities: agent.capabilities || [],
      endpoint: agent.endpoint || null,
      metadata: agent.metadata || {},
      status: 'active',
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      heartbeatInterval: agent.heartbeatInterval || 30000, // 30s default
    };
    
    this.agents.set(agentInfo.id, agentInfo);
    await this._save();
    
    console.log(`[A2ARegistry] Agent registered: ${agentInfo.id} (${agentInfo.name})`);
    
    return agentInfo;
  }
  
  /**
   * Agent abmelden
   * @param {string} agentId - Agent-ID
   * @returns {boolean} Erfolg
   */
  async unregister(agentId) {
    const removed = this.agents.delete(agentId);
    if (removed) {
      await this._save();
      console.log(`[A2ARegistry] Agent unregistered: ${agentId}`);
    }
    return removed;
  }
  
  /**
   * Agent holen
   * @param {string} agentId - Agent-ID
   * @returns {object|null} Agent-Info
   */
  get(agentId) {
    return this.agents.get(agentId) || null;
  }
  
  /**
   * Alle Agents holen
   * @returns {Array} Alle Agents
   */
  getAll() {
    return Array.from(this.agents.values());
  }
  
  /**
   * Agents mit Capability holen
   * @param {string} capability - Gesuchte Capability
   * @returns {Array} Passende Agents
   */
  getByCapability(capability) {
    return Array.from(this.agents.values())
      .filter(agent => 
        agent.capabilities.includes(capability) &&
        agent.status === 'active'
      );
  }
  
  /**
   * Agents by Type holen
   * @param {string} type - Agent-Typ
   * @returns {Array} Passende Agents
   */
  getByType(type) {
    return Array.from(this.agents.values())
      .filter(agent => agent.type === type);
  }
  
  /**
   * Heartbeat aktualisieren
   * @param {string} agentId - Agent-ID
   * @returns {boolean} Erfolg
   */
  async heartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }
    
    agent.lastHeartbeat = new Date().toISOString();
    agent.status = 'active';
    
    await this._save();
    return true;
  }
  
  /**
   * Agent-Status aktualisieren
   * @param {string} agentId - Agent-ID
   * @param {string} status - Status (active, busy, offline)
   */
  async updateStatus(agentId, status) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }
    
    agent.status = status;
    await this._save();
    return true;
  }
  
  /**
   * Expired Agents entfernen (kein Heartbeat > 2x Interval)
   * @private
   */
  _cleanupExpired() {
    const now = Date.now();
    let removed = 0;
    
    for (const [id, agent] of this.agents.entries()) {
      const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
      const maxAge = agent.heartbeatInterval * 2;
      
      if (now - lastHeartbeat > maxAge) {
        agent.status = 'offline';
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`[A2ARegistry] Cleaned up ${removed} expired agents`);
      this._save();
    }
  }
  
  /**
   * Registry speichern
   * @private
   */
  async _save() {
    const data = {
      agents: Object.fromEntries(this.agents),
      updatedAt: new Date().toISOString(),
    };
    
    await fs.writeFile(this.file, JSON.stringify(data, null, 2), 'utf-8');
  }
  
  /**
   * Unique ID generieren
   * @private
   */
  _generateId() {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Registry-Stats
   */
  getStats() {
    const agents = Array.from(this.agents.values());
    const byStatus = {};
    const byType = {};
    
    agents.forEach(a => {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      byType[a.type] = (byType[a.type] || 0) + 1;
    });
    
    return {
      total: agents.length,
      byStatus,
      byType,
      active: agents.filter(a => a.status === 'active').length,
    };
  }
}

// Singleton
const _instance = new A2ARegistry();

module.exports = {
  A2ARegistry,
  registry: _instance,
  register: (agent) => _instance.register(agent),
  unregister: (agentId) => _instance.unregister(agentId),
  get: (agentId) => _instance.get(agentId),
  getAll: () => _instance.getAll(),
  getByCapability: (capability) => _instance.getByCapability(capability),
  getByType: (type) => _instance.getByType(type),
  heartbeat: (agentId) => _instance.heartbeat(agentId),
  updateStatus: (agentId, status) => _instance.updateStatus(agentId, status),
  getStats: () => _instance.getStats(),
  load: () => _instance.load(),
};

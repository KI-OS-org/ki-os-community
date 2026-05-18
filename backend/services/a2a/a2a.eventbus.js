/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS A2A Event-Bus
 * 
 * Event-basierte Agent-zu-Agent-Kommunikation.
 * Publisher/Subscriber-Pattern mit persistenten Events.
 * 
 * Event-Types:
 * - agent.registered — Neuer Agent registriert
 * - agent.unregistered — Agent abgemeldet
 * - agent.task_requested — Task-Anfrage
 * - agent.task_completed — Task abgeschlossen
 * - agent.error — Agent-Fehler
 * - agent.heartbeat — Heartbeat (alle 30s)
 * 
 * @module services/a2a/a2a.eventbus
 * @license AGPL-3.0
 */

'use strict';

const EventEmitter = require('events');
const { bus: globalBus, push: pushGlobal } = require('../ui/ui.eventbus');

class A2AEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    
    // Event-Queue für persistente Events
    this.eventQueue = [];
    this.maxQueueSize = 1000;
    
    // Mit globalem Bus verbinden (für Cross-Module-Events)
    this._subscribeToGlobalBus();
  }
  
  /**
   * Event veröffentlichen
   * @param {string} type - Event-Typ
   * @param {object} payload - Event-Daten
   * @param {boolean} persistent - Persistent speichern (für Replay)
   */
  publish(type, payload, persistent = true) {
    const event = {
      eventId: this._generateId(),
      type,
      payload,
      timestamp: new Date().toISOString(),
      source: 'a2a',
    };
    
    // Im globalen Bus veröffentlichen
    pushGlobal(`a2a.${type}`, event);
    
    // Lokal emitieren
    this.emit(type, event);
    
    // Persistent speichern (wenn gewünscht)
    if (persistent) {
      this._queueEvent(event);
    }
    
    return event;
  }
  
  /**
   * Event abonnieren
   * @param {string} type - Event-Typ
   * @param {function} handler - Event-Handler
   */
  subscribe(type, handler) {
    this.on(type, handler);
    return () => this.off(type, handler);
  }
  
  /**
   * Alle Events eines Types holen (für Replay)
   * @param {string} type - Event-Typ
   * @param {number} limit - Maximale Anzahl
   * @returns {Array} Events
   */
  getEvents(type, limit = 100) {
    if (!type) {
      return this.eventQueue.slice(-limit);
    }
    
    return this.eventQueue
      .filter(e => e.type === type)
      .slice(-limit);
  }
  
  /**
   * Event in Queue speichern
   * @private
   */
  _queueEvent(event) {
    this.eventQueue.push(event);
    
    // Queue-Size begrenzen
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue.shift();
    }
  }
  
  /**
   * Mit globalem Bus verbinden
   * @private
   */
  _subscribeToGlobalBus() {
    // A2A-Events vom globalen Bus empfangen
    globalBus.on('a2a.*', (event) => {
      if (event && event.type) {
        this.emit(event.type, event);
      }
    });
  }
  
  /**
   * Unique ID generieren
   * @private
   */
  _generateId() {
    return `a2a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Queue leeren (für Testing)
   */
  clearQueue() {
    this.eventQueue = [];
  }
  
  /**
   * Queue-Stats
   */
  getStats() {
    const byType = {};
    this.eventQueue.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
    });
    
    return {
      total: this.eventQueue.length,
      byType,
      maxQueueSize: this.maxQueueSize,
    };
  }
}

// Singleton
const _instance = new A2AEventBus();

module.exports = {
  A2AEventBus,
  a2aBus: _instance,
  publish: (type, payload, persistent) => _instance.publish(type, payload, persistent),
  subscribe: (type, handler) => _instance.subscribe(type, handler),
  getEvents: (type, limit) => _instance.getEvents(type, limit),
};

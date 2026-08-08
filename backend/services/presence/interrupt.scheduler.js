/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const EventEmitter = require('events');
const { routeSignal, flushSuppressed, getSuppressedCount } = require('./signal.router');
const { getPolicy, isSilent } = require('./presence.policy');
const { THRESHOLDS, PRESENCE_STATES } = require('../../schemas/presence.schema');

// ─── Konfiguration ───────────────────────────────────────────────────────────

const INTERRUPT_QUEUE_MAX = parseInt(process.env.INTERRUPT_QUEUE_MAX) || 10;
const INTERRUPT_MAX_AGE_MS = parseInt(process.env.INTERRUPT_MAX_AGE_MS) || 1800000; // 30 Minuten

// ─── Singleton Scheduler-Zustand ──────────────────────────────────────────────

class InterruptScheduler extends EventEmitter {
  constructor() {
    super();
    this._queue = [];
    this._lastFlush = Date.now();
  }

  // ─── Haupt-API ─────────────────────────────────────────────────────────────

  /**
   * Plant die Auslieferung eines Signals
   * @param {Object} signal - Das Signal-Objekt
   * @param {Object} currentState - Aktueller State
   * @returns {{ queued: boolean, immediate: boolean, result?: Object }}
   */
  schedule(signal, currentState) {
    // Prüfen, ob Signal sofort dispatched werden kann
    const routingResult = routeSignal(signal, currentState);

    if (routingResult.dispatched) {
      this.emit('signal:dispatch', {
        signal,
        routing: routingResult,
        ts: Date.now()
      });
      return { queued: false, immediate: true, result: routingResult };
    }

    // Signal in Queue einreihen
    if (this._queue.length < INTERRUPT_QUEUE_MAX) {
      this._queue.push({
        signal,
        state: currentState.state,
        timestamp: Date.now()
      });
      return { queued: true, immediate: false };
    }

    // Queue voll → Signal droppen
    this.emit('signal:dropped', {
      signal,
      reason: 'Queue voll'
    });
    return { queued: false, immediate: false };
  }

  /**
   * Wird aufgerufen, wenn der State wechselt
   * @param {Object} newState - Neuer State
   * @returns {{ flushed: Object[] }} Geflushtes Array
   */
  onStateChange(newState) {
    const flushedSignals = [];

    // Bei NIGHT-State: Queue leeren
    if (newState.state === PRESENCE_STATES.NIGHT) {
      this._queue.forEach(item => {
        this.emit('signal:dropped', {
          signal: item.signal,
          reason: 'NIGHT-State'
        });
      });
      this._queue = [];
      return { flushed: [] };
    }

    // Bei IDLE-State: Alle queued Signale flushen
    if (newState.state === PRESENCE_STATES.IDLE) {
      const signalsToFlush = this._queue.map(item => item.signal);
      this._queue = [];
      this.emit('signal:flush', {
        signals: signalsToFlush,
        state: newState
      });
      return { flushed: signalsToFlush };
    }

    // Prüfen, ob gestaute Signale jetzt relevant sind
    const now = Date.now();
    this._queue = this._queue.filter(item => {
      // Zu alte Signale droppen
      if (now - item.timestamp > INTERRUPT_MAX_AGE_MS) {
        this.emit('signal:dropped', {
          signal: item.signal,
          reason: 'Signal zu alt'
        });
        return false;
      }

      // Prüfen, ob Signal jetzt relevant ist
      const policy = getPolicy(newState.state, item.signal.type, item.signal.priority);
      if (!isSilent(newState.state, item.signal.type, item.signal.priority)) {
        const routingResult = routeSignal(item.signal, newState);
        if (routingResult.dispatched) {
          flushedSignals.push(item.signal);
          this.emit('signal:dispatch', {
            signal: item.signal,
            routing: routingResult,
            ts: now
          });
          return false;
        }
      }
      return true;
    });

    if (flushedSignals.length > 0) {
      this.emit('signal:flush', {
        signals: flushedSignals,
        state: newState
      });
    }

    return { flushed: flushedSignals };
  }

  /**
   * Gibt den Status der Queue zurück
   * @returns {{ count: number, oldestMs: number, items: Object[] }}
   */
  getQueueStatus() {
    const now = Date.now();
    const oldest = this._queue.length > 0
      ? Math.min(...this._queue.map(item => item.timestamp))
      : now;

    return {
      count: this._queue.length,
      oldestMs: now - oldest,
      items: this._queue.map(item => item.signal)
    };
  }

  // ─── Helper-Methoden ───────────────────────────────────────────────────────

  /**
   * Entfernt alle Signale aus der Queue
   */
  clearQueue() {
    this._queue = [];
  }

  /**
   * Gibt die Anzahl der gedrosselten Signale zurück
   * @returns {number}
   */
  getSuppressedCount() {
    return getSuppressedCount();
  }

  /**
   * Gibt alle gedrosselten Signale zurück und leert die Queue
   * @returns {Object[]}
   */
  flushSuppressed() {
    return flushSuppressed();
  }
}

// ─── Singleton-Export ─────────────────────────────────────────────────────────

const scheduler = new InterruptScheduler();

module.exports = {
  schedule: scheduler.schedule.bind(scheduler),
  onStateChange: scheduler.onStateChange.bind(scheduler),
  getQueueStatus: scheduler.getQueueStatus.bind(scheduler),
  on: scheduler.on.bind(scheduler),
  off: scheduler.off.bind(scheduler),
  clearQueue: scheduler.clearQueue.bind(scheduler),
  getSuppressedCount: scheduler.getSuppressedCount.bind(scheduler),
  flushSuppressed: scheduler.flushSuppressed.bind(scheduler),
};

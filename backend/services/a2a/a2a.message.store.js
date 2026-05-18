/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS A2A Message Store
 * 
 * Persistente Speicherung von A2A-Nachrichten.
 * SQLite für Reliability (Dead-Letter-Queue, Retry).
 * 
 * @module services/a2a/a2a.message.store
 * @license AGPL-3.0
 */

'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', '..', '.ki-os-a2a-messages.db');

class A2AMessageStore {
  constructor() {
    this.db = null;
  }
  
  /**
   * Datenbank initialisieren
   */
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('[A2AMessageStore] DB init error:', err);
          return reject(err);
        }
        
        console.log('[A2AMessageStore] Database initialized');
        this._createTables().then(resolve).catch(reject);
      });
    });
  }
  
  /**
   * Tabellen anlegen
   * @private
   */
  async _createTables() {
    const createMessages = `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        from_agent TEXT NOT NULL,
        to_agent TEXT,
        payload TEXT,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        correlation_id TEXT,
        error_message TEXT
      )
    `;
    
    const createDeadLetter = `
      CREATE TABLE IF NOT EXISTS dead_letter (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        original_payload TEXT,
        error_type TEXT,
        error_message TEXT,
        failed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON messages(to_agent);
      CREATE INDEX IF NOT EXISTS idx_messages_correlation ON messages(correlation_id);
    `;
    
    await this._run(createMessages);
    await this._run(createDeadLetter);
    await this._run(createIndexes);
  }
  
  /**
   * Nachricht speichern
   * @param {object} message - Nachricht
   * @returns {Promise<object>} Gespeicherte Nachricht
   */
  async save(message) {
    const sql = `
      INSERT INTO messages (id, type, from_agent, to_agent, payload, status, correlation_id, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      message.messageId,
      message.type,
      message.from,
      message.to || null,
      JSON.stringify(message.payload),
      'pending',
      message.correlationId || null,
      message.expiresAt || null,
    ];
    
    await this._run(sql, params);
    return message;
  }
  
  /**
   * Nachrichten für Agent holen
   * @param {string} agentId - Agent-ID
   * @param {number} limit - Maximale Anzahl
   * @returns {Promise<Array>} Nachrichten
   */
  async getForAgent(agentId, limit = 100) {
    const sql = `
      SELECT * FROM messages
      WHERE to_agent = ? AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at ASC
      LIMIT ?
    `;
    
    return await this._all(sql, [agentId, limit]);
  }
  
  /**
   * Nachricht als gelesen markieren
   * @param {string} messageId - Nachrichten-ID
   * @returns {Promise<boolean>} Erfolg
   */
  async markAsRead(messageId) {
    const sql = `
      UPDATE messages
      SET status = 'read', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await this._run(sql, [messageId]);
    return true;
  }
  
  /**
   * Nachricht als abgeschlossen markieren
   * @param {string} messageId - Nachrichten-ID
   * @returns {Promise<boolean>} Erfolg
   */
  async markAsCompleted(messageId) {
    const sql = `
      UPDATE messages
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await this._run(sql, [messageId]);
    return true;
  }
  
  /**
   * Retry-Count erhöhen
   * @param {string} messageId - Nachrichten-ID
   * @returns {Promise<object>} Nachricht mit neuem Retry-Count
   */
  async incrementRetry(messageId) {
    const sql = `
      UPDATE messages
      SET retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `;
    
    const result = await this._get(sql, [messageId]);
    return result;
  }
  
  /**
   * Nachricht an Dead-Letter-Queue senden
   * @param {string} messageId - Nachrichten-ID
   * @param {string} errorType - Fehler-Typ
   * @param {string} errorMessage - Fehlermeldung
   * @returns {Promise<void>}
   */
  async moveToDeadLetter(messageId, errorType, errorMessage) {
    const message = await this._get('SELECT * FROM messages WHERE id = ?', [messageId]);
    
    if (!message) {
      return;
    }
    
    const insertDl = `
      INSERT INTO dead_letter (id, message_id, original_payload, error_type, error_message)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await this._run(insertDl, [
      `dl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId,
      message.payload,
      errorType,
      errorMessage,
    ]);
    
    const updateMessage = `
      UPDATE messages
      SET status = 'dead_letter', updated_at = CURRENT_TIMESTAMP, error_message = ?
      WHERE id = ?
    `;
    
    await this._run(updateMessage, [errorMessage, messageId]);
  }
  
  /**
   * Dead-Letter-Queue holen
   * @param {number} limit - Maximale Anzahl
   * @returns {Promise<Array>} Dead-Letter-Einträge
   */
  async getDeadLetter(limit = 100) {
    return await this._all('SELECT * FROM dead_letter ORDER BY failed_at DESC LIMIT ?', [limit]);
  }
  
  /**
   * Abgelaufene Nachrichten löschen
   * @returns {Promise<number>} Anzahl gelöschter Nachrichten
   */
  async cleanup() {
    const sql = `
      DELETE FROM messages
      WHERE expires_at < datetime('now')
      OR (status = 'read' AND created_at < datetime('now', '-7 days'))
    `;
    
    const result = await this._run(sql);
    return result.changes;
  }
  
  /**
   * Helper: SQL ausführen
   * @private
   */
  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }
  
  /**
   * Helper: Einzelnes Ergebnis
   * @private
   */
  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
  /**
   * Helper: Alle Ergebnisse
   * @private
   */
  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
  
  /**
   * Datenbank schließen
   */
  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else {
          console.log('[A2AMessageStore] Database closed');
          resolve();
        }
      });
    });
  }
}

// Singleton
const _instance = new A2AMessageStore();

module.exports = {
  A2AMessageStore,
  messageStore: _instance,
  init: () => _instance.init(),
  save: (message) => _instance.save(message),
  getForAgent: (agentId, limit) => _instance.getForAgent(agentId, limit),
  markAsRead: (messageId) => _instance.markAsRead(messageId),
  markAsCompleted: (messageId) => _instance.markAsCompleted(messageId),
  incrementRetry: (messageId) => _instance.incrementRetry(messageId),
  moveToDeadLetter: (messageId, errorType, errorMessage) => _instance.moveToDeadLetter(messageId, errorType, errorMessage),
  getDeadLetter: (limit) => _instance.getDeadLetter(limit),
  cleanup: () => _instance.cleanup(),
  close: () => _instance.close(),
};

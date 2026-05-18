/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS ClickHouse Client
 * 
 * Connection-Pooling und Query-Helper für ClickHouse Analytics.
 * 
 * @module services/telemetry/clickhouse.client
 * @license AGPL-3.0
 */

'use strict';

const { createClient } = require('@clickhouse/client');

class ClickHouseClient {
  constructor(options = {}) {
    this.config = {
      host: options.host || process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
      username: options.username || process.env.CLICKHOUSE_USER || 'ki_os',
      password: options.password || process.env.CLICKHOUSE_PASSWORD || 'ChangeMe123!',
      database: options.database || process.env.CLICKHOUSE_DATABASE || 'ki_os_analytics',
      request_timeout: options.request_timeout || 30000,
      max_open_connections: options.max_open_connections || 10,
      compression: {
        request: false,
        response: true,
      },
    };
    
    this.client = null;
    this.isConnected = false;
  }
  
  /**
   * Verbindung zu ClickHouse herstellen
   */
  async connect() {
    if (this.client) {
      return this.client;
    }
    
    try {
      this.client = createClient(this.config);
      
      // Verbindung testen
      await this.client.ping();
      this.isConnected = true;
      
      console.log('[ClickHouseClient] Connected to', this.config.host);
      return this.client;
    } catch (error) {
      console.error('[ClickHouseClient] Connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }
  
  /**
   * Verbindung schließen
   */
  async disconnect() {
    if (!this.client) {
      return;
    }
    
    try {
      await this.client.close();
      this.isConnected = false;
      this.client = null;
      console.log('[ClickHouseClient] Disconnected');
    } catch (error) {
      console.error('[ClickHouseClient] Disconnect error:', error.message);
    }
  }
  
  /**
   * Query ausführen (SELECT)
   * @param {string} query - SQL Query
   * @param {object} params - Query-Parameter
   * @returns {Promise<Array>} Ergebnisse
   */
  async query(query, params = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const resultSet = await this.client.query({
        query,
        query_params: params,
        format: 'JSONEachRow',
      });
      
      return await resultSet.json();
    } catch (error) {
      console.error('[ClickHouseClient] Query error:', error.message);
      throw error;
    }
  }
  
  /**
   * Insert ausführen (Batch-Insert)
   * @param {string} table - Tabellenname
   * @param {Array} values - Werte (Array von Objekten)
   * @returns {Promise<void>}
   */
  async insert(table, values) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }
    
    try {
      await this.client.insert({
        table,
        values,
        format: 'JSONEachRow',
      });
      
      console.log(`[ClickHouseClient] Inserted ${values.length} rows into ${table}`);
    } catch (error) {
      console.error('[ClickHouseClient] Insert error:', error.message);
      throw error;
    }
  }
  
  /**
   * Command ausführen (DDL, OPTIMIZE, etc.)
   * @param {string} query - SQL Command
   * @returns {Promise<void>}
   */
  async command(query) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      await this.client.command({ query });
    } catch (error) {
      console.error('[ClickHouseClient] Command error:', error.message);
      throw error;
    }
  }
  
  /**
   * Health-Check
   * @returns {Promise<object>} Health-Status
   */
  async health() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const result = await this.query('SELECT 1 AS ok');
      
      return {
        status: 'healthy',
        connected: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Singleton-Instance
let _instance = null;

function getClickHouseClient(options = {}) {
  if (!_instance) {
    _instance = new ClickHouseClient(options);
  }
  return _instance;
}

module.exports = {
  ClickHouseClient,
  getClickHouseClient,
};

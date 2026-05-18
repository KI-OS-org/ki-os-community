/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = process.env.SALES_DB_PATH || path.join(process.cwd(), 'data', 'sales.db');

class CatalogService {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS catalog_items (
        id TEXT PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        basePrice INTEGER NOT NULL,
        currency TEXT DEFAULT 'EUR',
        unit TEXT DEFAULT 'Stück',
        active INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    this.upsertStmt = this.db.prepare(`
      INSERT INTO catalog_items (
        id, sku, name, description, category, basePrice, currency, unit, active, createdAt, updatedAt
      ) VALUES (
        @id, @sku, @name, @description, @category, @basePrice, @currency, @unit, @active, @createdAt, @updatedAt
      ) ON CONFLICT(sku) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        category = excluded.category,
        basePrice = excluded.basePrice,
        currency = excluded.currency,
        unit = excluded.unit,
        active = excluded.active,
        updatedAt = excluded.updatedAt
      RETURNING id
    `);
  }

  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  getCurrentTimestamp() {
    return new Date().toISOString();
  }

  importFromJson(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(data)) {
        throw new Error('Invalid JSON format: Expected array of items');
      }

      let imported = 0;
      let updated = 0;
      const errors = [];

      for (const item of data) {
        try {
          const result = this.upsertItem({
            sku: item.sku,
            name: item.name,
            description: item.description || null,
            category: item.category || null,
            basePrice: item.basePrice,
            currency: item.currency || 'EUR',
            unit: item.unit || 'Stück',
            active: 1
          });
          result ? updated++ : imported++;
        } catch (err) {
          errors.push({
            sku: item.sku,
            error: err.message
          });
        }
      }

      return { imported, updated, errors };
    } catch (err) {
      return { imported: 0, updated: 0, errors: [{ error: err.message }] };
    }
  }

  importFromCsv(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) {
        throw new Error('CSV file must contain at least header and one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const requiredFields = ['sku', 'name', 'basePrice'];
      for (const field of requiredFields) {
        if (!headers.includes(field)) {
          throw new Error(`Missing required CSV header: ${field}`);
        }
      }

      let imported = 0;
      let updated = 0;
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) {
          errors.push({
            line: i + 1,
            error: 'Column count does not match header'
          });
          continue;
        }

        const item = {};
        for (let j = 0; j < headers.length; j++) {
          item[headers[j]] = values[j] || null;
        }

        try {
          const result = this.upsertItem({
            sku: item.sku,
            name: item.name,
            description: item.description || null,
            category: item.category || null,
            basePrice: parseInt(item.basePrice),
            currency: item.currency || 'EUR',
            unit: item.unit || 'Stück',
            active: 1
          });
          result ? updated++ : imported++;
        } catch (err) {
          errors.push({
            line: i + 1,
            sku: item.sku,
            error: err.message
          });
        }
      }

      return { imported, updated, errors };
    } catch (err) {
      return { imported: 0, updated: 0, errors: [{ error: err.message }] };
    }
  }

  upsertItem(item) {
    if (!item.sku || !item.name || item.basePrice === undefined) {
      throw new Error('Missing required fields: sku, name, basePrice');
    }

    const now = this.getCurrentTimestamp();
    const existing = this.getItem(item.sku);

    const params = {
      id: existing ? existing.id : this.generateId(),
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: item.category,
      basePrice: item.basePrice,
      currency: item.currency,
      unit: item.unit,
      active: item.active !== undefined ? item.active : 1,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    this.upsertStmt.run(params);
    return existing !== null;
  }

  getItems(category) {
    let query = 'SELECT * FROM catalog_items WHERE active = 1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY name ASC';
    return this.db.prepare(query).all(params);
  }

  getItem(sku) {
    return this.db.prepare('SELECT * FROM catalog_items WHERE sku = ?').get(sku);
  }

  updatePrice(sku, basePrice) {
    const now = this.getCurrentTimestamp();
    this.db.prepare(`
      UPDATE catalog_items 
      SET basePrice = ?, updatedAt = ?
      WHERE sku = ?
    `).run(basePrice, now, sku);
    return this.getItem(sku);
  }

  deactivate(sku) {
    const now = this.getCurrentTimestamp();
    this.db.prepare(`
      UPDATE catalog_items 
      SET active = 0, updatedAt = ?
      WHERE sku = ?
    `).run(now, sku);
    return { success: true };
  }
}

module.exports = { CatalogService };

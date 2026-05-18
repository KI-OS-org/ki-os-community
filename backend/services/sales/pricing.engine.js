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

class PricingEngine {
  constructor() {
    this.db = new Database(DB_PATH);
    this.createTable();
  }

  createTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pricing_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT,              -- null = gilt für alle
        category TEXT,         -- null = gilt für alle Kategorien
        ruleType TEXT NOT NULL, -- 'volume' | 'discount_pct' | 'fixed_price' | 'bundle'
        minQty INTEGER DEFAULT 1,
        maxQty INTEGER,        -- null = unbegrenzt
        value REAL NOT NULL,   -- % bei discount_pct, Preis in Cent bei fixed_price
        priority INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        validFrom TEXT,
        validUntil TEXT
      )
    `);
  }

  addRule(rule) {
    rule.id = crypto.randomUUID();
    this.validateRule(rule);
    this.db.prepare('INSERT INTO pricing_rules (id, name, sku, category, ruleType, minQty, maxQty, value, priority, active, validFrom, validUntil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      rule.id, rule.name, rule.sku, rule.category, rule.ruleType, rule.minQty, rule.maxQty, rule.value, rule.priority, rule.active, rule.validFrom, rule.validUntil
    );
  }

  validateRule(rule) {
    if (!rule.name || !rule.ruleType) {
      throw new Error('Name and ruleType are required');
    }
    if (rule.ruleType !== 'volume' && rule.ruleType !== 'discount_pct' && rule.ruleType !== 'fixed_price' && rule.ruleType !== 'bundle') {
      throw new Error('Invalid ruleType');
    }
    if (rule.ruleType === 'discount_pct' && (rule.value <= 0 || rule.value > 100)) {
      throw new Error('Discount percentage must be between 0 and 100');
    }
    if (rule.ruleType === 'fixed_price' && rule.value <= 0) {
      throw new Error('Fixed price must be greater than 0');
    }
  }

  getRules(sku) {
    let query = 'SELECT * FROM pricing_rules WHERE active = 1';
    if (sku) {
      query += ' AND (sku = ? OR sku IS NULL)';
    }
    query += ' ORDER BY priority DESC';
    const stmt = this.db.prepare(query);
    return sku ? stmt.all(sku) : stmt.all();
  }

  calculate(sku, basePrice, qty, category) {
    const rules = this.getRules(sku);
    let finalPrice = basePrice * qty;
    let appliedRule = null;
    let savings = 0;

    for (const rule of rules) {
      if (rule.category && rule.category !== category) continue;

      switch (rule.ruleType) {
        case 'volume':
          if (qty >= rule.minQty && (rule.maxQty === null || qty <= rule.maxQty)) {
            finalPrice = basePrice * qty * (1 - rule.value / 100);
            appliedRule = rule.name;
            savings = basePrice * qty - finalPrice;
          }
          break;
        case 'discount_pct':
          finalPrice = basePrice * qty * (1 - rule.value / 100);
          appliedRule = rule.name;
          savings = basePrice * qty - finalPrice;
          break;
        case 'fixed_price':
          finalPrice = rule.value * qty;
          appliedRule = rule.name;
          savings = basePrice * qty - finalPrice;
          break;
        case 'bundle':
          if (qty >= rule.minQty) {
            finalPrice = rule.value;
            appliedRule = rule.name;
            savings = basePrice * qty - finalPrice;
          }
          break;
      }
    }

    return {
      basePrice,
      qty,
      appliedRule,
      finalPrice,
      savings,
      currency: 'EUR'
    };
  }

  quote(items) {
    const results = items.map(item => this.calculate(item.sku, item.basePrice, item.qty, item.category));
    const subtotal = items.reduce((sum, item) => sum + item.basePrice * item.qty, 0);
    const totalSavings = results.reduce((sum, result) => sum + result.savings, 0);
    const total = subtotal - totalSavings;

    return {
      items: results,
      subtotal,
      totalSavings,
      total,
      currency: 'EUR'
    };
  }
}

module.exports = { PricingEngine };

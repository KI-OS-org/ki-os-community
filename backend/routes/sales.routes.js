/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: sales.routes.js
 * Express-Router fuer CRM- und Sales-Endpunkte inkl. DNA-Routen.
 * @license AGPL-3.0-only
 */
'use strict';
const express = require('express');
const crmService = require('../services/sales/crm.service');
const { KimbaDnaService } = require('../services/sales/kimba-dna.service');
const { OutreachService } = require('../services/sales/outreach.service');
const { CatalogService } = require('../services/sales/catalog.service');
const { PricingEngine } = require('../services/sales/pricing.engine');
const router = express.Router();
const catalog = new CatalogService();
const pricing = new PricingEngine();
const dna = new KimbaDnaService();
const outreach = new OutreachService();

router.get('/pipeline', (req, res) => { res.json(crmService.getPipelineStats()); });
router.get('/contacts', (req, res) => { res.json(crmService.getContacts(req.query.status)); });
router.post('/contacts', (req, res) => { try { res.status(201).json(crmService.addContact(req.body)); } catch (error) { res.status(400).json({ error: error.message }); } });
router.put('/contacts/:id/status', (req, res) => { try { const contact = crmService.updateContactStatus(req.params.id, req.body.status); if (!contact) return res.status(404).json({ error: 'contact not found' }); return res.json(contact); } catch (error) { return res.status(400).json({ error: error.message }); } });
router.post('/contacts/:id/offers', (req, res) => { try { res.status(201).json(crmService.createOffer(req.params.id, req.body.title, req.body.priceCents)); } catch (error) { const statusCode = error.message.startsWith('contact not found:') ? 404 : 400; res.status(statusCode).json({ error: error.message }); } });
router.get('/contacts/overdue', (req, res) => { res.json(crmService.getOverdueContacts(req.query.days)); });

// DNA-Routen
router.post('/dna/profile', (req, res) => {
  try {
    const profile = dna.setProfile(req.body);
    res.json({ success: true, profile });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/dna/profile', (req, res) => {
  res.json(dna.getProfile() || {});
});

router.post('/dna/interview', (req, res) => {
  try {
    dna.setInterviewAnswer(req.body.question, req.body.answer);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/dna/interview', (req, res) => {
  res.json({ answers: dna.getInterviewAnswers() });
});

router.post('/dna/style', (req, res) => {
  try {
    dna.setStyleCalibration(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/dna/style', (req, res) => {
  res.json(dna.getStyleCalibration() || {});
});

// Outreach-Routen
router.post('/contacts/:id/outreach', async (req, res) => {
  try {
    const contact = crmService.getContacts().find(c => c.id === req.params.id);
    if (!contact) return res.status(404).json({ error: 'contact not found' });
    const draft = await outreach.draftOutreach(contact, req.body.channel || 'email');
    return res.status(201).json(draft);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/contacts/:id/outreach', (req, res) => {
  res.json(outreach.getDrafts(req.params.id));
});

router.put('/outreach/:draftId/status', (req, res) => {
  try {
    res.json(outreach.updateStatus(req.params.draftId, req.body.status));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/followups/due', (req, res) => {
  res.json(outreach.getScheduledFollowups(req.query.days));
});

// Katalog-Routen
router.get('/catalog', (req, res) => res.json(catalog.getItems(req.query.category)));
router.get('/catalog/:sku', (req, res) => {
  const item = catalog.getItem(req.params.sku);
  if (!item) return res.status(404).json({ error: 'not found' });
  return res.json(item);
});
router.post('/catalog/import', async (req, res) => {
  try {
    const { filePath, format = 'json' } = req.body;
    const result = format === 'csv' ? catalog.importFromCsv(filePath) : catalog.importFromJson(filePath);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/catalog/:sku/price', (req, res) => {
  try { res.json(catalog.updatePrice(req.params.sku, req.body.basePrice)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Preisengine-Routen
router.get('/pricing/rules', (req, res) => res.json(pricing.getRules(req.query.sku)));
router.post('/pricing/rules', (req, res) => {
  try { res.status(201).json(pricing.addRule(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/pricing/calculate', (req, res) => {
  try {
    const { sku, basePrice, qty, category } = req.body;
    res.json(pricing.calculate(sku, basePrice, qty, category));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/pricing/quote', (req, res) => {
  try { res.json(pricing.quote(req.body.items || [])); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

async function handleSalesRequest(path, method, body, query) {
  const subPath = path.replace(/^\/sales/, '') || '/';
  return new Promise((resolve) => {
    let statusCode = 200;
    let responseBody = null;
    const fakeReq = {
      method: method.toUpperCase(),
      url: subPath,
      path: subPath,
      params: {},
      query: query || {},
      body: body || {},
      headers: {},
    };
    const fakeRes = {
      statusCode: 200,
      status(code) { statusCode = code; this.statusCode = code; return this; },
      json(data) { responseBody = data; resolve({ statusCode, body: data }); },
      send(data) { responseBody = data; resolve({ statusCode, body: data }); },
      end() { resolve({ statusCode, body: responseBody }); },
    };
    const fakeNext = (err) => {
      if (err) resolve({ statusCode: 500, body: { error: err.message || String(err) } });
      else resolve({ statusCode: 404, body: { error: 'Not Found', path, method } });
    };
    try {
      router(fakeReq, fakeRes, fakeNext);
    } catch (e) {
      resolve({ statusCode: 500, body: { error: e.message } });
    }
  });
}

module.exports = { router, handleSalesRequest };

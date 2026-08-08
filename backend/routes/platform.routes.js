/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Platform API — Services/Backends/Routing/Kosten für die AI Service Platform (S8)
'use strict';

const express = require('express');
const router = express.Router();
const { listServices, getServiceStatus, enableService, disableService } = require('../services/platform/service.catalog.js');
const { listBackends, getBackendStatus } = require('../services/platform/control.plane.js');
const { routeTask, explainRouting } = require('../services/platform/service.router.js');
const { getCostOverview } = require('../services/tower/tower.service.js');

// GET /services - List all services
router.get('/services', (req, res) => {
  try {
    const services = listServices();
    res.json({ services, count: services.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /services/:id - Get service status
router.get('/services/:id', (req, res) => {
  try {
    const service = getServiceStatus(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Unbekannter Dienst', id: req.params.id });
    }
    res.json({ service });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /services/:id/enable - Enable a service
router.post('/services/:id/enable', (req, res) => {
  try {
    const service = enableService(req.params.id);
    res.json({ success: true, service });
  } catch (e) {
    res.status(404).json({ error: e.message, id: req.params.id });
  }
});

// POST /services/:id/disable - Disable a service
router.post('/services/:id/disable', (req, res) => {
  try {
    const service = disableService(req.params.id);
    res.json({ success: true, service });
  } catch (e) {
    res.status(404).json({ error: e.message, id: req.params.id });
  }
});

// GET /backends - List all backends
router.get('/backends', (req, res) => {
  try {
    const backends = listBackends();
    res.json({ backends, count: backends.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /backends/:id - Get backend status
router.get('/backends/:id', (req, res) => {
  try {
    const backend = getBackendStatus(req.params.id);
    if (!backend) {
      return res.status(404).json({ error: 'Unbekanntes Backend', id: req.params.id });
    }
    res.json({ backend });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /route - Route a task
router.post('/route', async (req, res) => {
  const { text, context, forceLocal, forceProvider, economicProfile, quality } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text muss angegeben werden' });
  }

  try {
    const routing = await explainRouting(text, { context, forceLocal, forceProvider, economicProfile, quality });
    res.json({ routing });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /costs - Get cost overview
router.get('/costs', async (req, res) => {
  try {
    const costs = await getCostOverview(Number(req.query.limit) || 50);
    res.json({ costs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

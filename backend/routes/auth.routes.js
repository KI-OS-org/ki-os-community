/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
// Datei: auth.routes.js
// Express Router für Auth-Endpunkte.
// @license AGPL-3.0-only

'use strict';

const express = require('express');
const { handleAuthRequest } = require('../services/auth/auth.controller');
const { createIpRateLimiter } = require('../middleware/ip-rate-limit');

const router = express.Router();

const loginLimiter = createIpRateLimiter({ max: 10, windowMs: 15 * 60 * 1000, message: 'Too many login attempts from this IP' });
const registerLimiter = createIpRateLimiter({ max: 5, windowMs: 60 * 60 * 1000, message: 'Too many registration attempts from this IP' });
const refreshLimiter = createIpRateLimiter({ max: 30, windowMs: 15 * 60 * 1000, message: 'Too many token refresh attempts from this IP' });

router.post('/login', loginLimiter, async (req, res) => {
  const result = await handleAuthRequest('/auth/login', 'POST', req.body, req.headers);
  res.status(result.statusCode).json(result.body);
});

router.post('/register', registerLimiter, async (req, res) => {
  const result = await handleAuthRequest('/auth/register', 'POST', req.body, req.headers);
  res.status(result.statusCode).json(result.body);
});

router.post('/refresh', refreshLimiter, async (req, res) => {
  const result = await handleAuthRequest('/auth/refresh', 'POST', req.body, req.headers);
  res.status(result.statusCode).json(result.body);
});

router.post('/logout', async (req, res) => {
  const result = await handleAuthRequest('/auth/logout', 'POST', req.body, req.headers);
  res.status(result.statusCode).json(result.body);
});

router.get('/me', async (req, res) => {
  const result = await handleAuthRequest('/auth/me', 'GET', req.query, req.headers);
  res.status(result.statusCode).json(result.body);
});

module.exports = router;

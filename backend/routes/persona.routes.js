/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
const express = require('express');
const { getPersona, setPersona, resetPersona } = require('../services/kimba/persona.memory');
const { PROFILES } = require('../services/kimba/persona.profiles');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const userId = req.user?.id || 'default';
    const persona = getPersona(userId);
    res.json(persona);
  } catch (e) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', (req, res) => {
  try {
    const { role, params } = req.body;
    const userId = req.user?.id || 'default';
    if (!role || !PROFILES[role]) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    setPersona(userId, role, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/', (req, res) => {
  try {
    const userId = req.user?.id || 'default';
    resetPersona(userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
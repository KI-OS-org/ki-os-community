/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc SkillForge API — Muster-Vorschläge erstellen/auflisten/freigeben/ablehnen (S5)
'use strict';

const express = require('express');
const router = express.Router();
const { synthesize, listProposals, getProposal, approveProposal, rejectProposal } = require('../services/skillforge/skill.synthesizer.js');
const { sendMessage } = require('../services/telegram/telegram.bot.js');

// POST /propose - Neues Proposal erstellen
router.post('/propose', async (req, res) => {
  const { pattern } = req.body;

  if (!pattern || !Array.isArray(pattern.steps)) {
    return res.status(400).json({ error: 'pattern mit steps-Array muss angegeben werden' });
  }

  try {
    const proposal = await synthesize(pattern);

    // Telegram-Benachrichtigung (best-effort)
    let telegramNotified = false;
    if (process.env.TELEGRAM_ALLOWED_CHAT_ID) {
      try {
        const message = `🧩 Neuer Skill-Vorschlag: ${proposal.skill.name}\n${proposal.skill.description}\n\nFreigeben: kios skillforge approve ${proposal.id}\nAblehnen: kios skillforge reject ${proposal.id}`;
        await sendMessage(process.env.TELEGRAM_ALLOWED_CHAT_ID, message);
        telegramNotified = true;
      } catch (e) {
        console.error('Fehler beim Senden der Telegram-Nachricht:', e.message);
      }
    }

    res.json({ success: true, proposal, telegramNotified });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /proposals - Liste aller Proposals (optional mit Status-Filter)
router.get('/proposals', (req, res) => {
  try {
    const proposals = listProposals(req.query.status);
    res.json({ proposals, count: proposals.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /proposals/:id - Einzelnes Proposal abrufen
router.get('/proposals/:id', (req, res) => {
  try {
    const proposal = getProposal(req.params.id);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal nicht gefunden', id: req.params.id });
    }
    res.json({ proposal });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /proposals/:id/approve - Proposal freigeben
router.post('/proposals/:id/approve', async (req, res) => {
  try {
    const result = await approveProposal(req.params.id);
    if (result.approved === false) {
      return res.status(404).json({ error: 'Proposal nicht gefunden', id: req.params.id });
    }
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /proposals/:id/reject - Proposal ablehnen
router.post('/proposals/:id/reject', async (req, res) => {
  try {
    const result = await rejectProposal(req.params.id);
    if (result.rejected === false) {
      return res.status(404).json({ error: 'Proposal nicht gefunden', id: req.params.id });
    }
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

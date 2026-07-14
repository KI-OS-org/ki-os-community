/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba - COMMERCIAL License (Business/Enterprise only)
// @desc Synchroner Mobile-Chat-Endpunkt für KIMBA Voice App
'use strict';
const express = require('express');
const router = express.Router();
const llmRouter = require('../services/core/llm.router');
const claudeBridge = require('../services/claude-bridge.service');

const KIOS_MODE_PRESET = {
  // ── Sprachassistenz & Koordination ──────────────────────────────────────────
  koordination: { model: 'claude-haiku-4-5-20251001',              maxTokens: 400,  temperature: 0.4 },
  strategie:    { model: 'claude-sonnet-4-6',                       maxTokens: 800,  temperature: 0.3 },
  highend:      { model: 'claude-sonnet-4-6',                       maxTokens: 1000, temperature: 0.3 },
  precise:      { model: 'claude-sonnet-4-6',                       maxTokens: 500,  temperature: 0.3 },
  optimal:      { model: 'claude-haiku-4-5-20251001',               maxTokens: 300,  temperature: 0.5 },
  // ── Code-Ausführung (aktueller Modell-Stack 2026-05) ────────────────────────
  execution:    { model: 'mistralai/codestral-2508',                 maxTokens: 500,  temperature: 0.2 },
  review:       { model: 'deepseek/deepseek-r1-0528',                maxTokens: 600,  temperature: 0.2 },
  analyse:      { model: 'google/gemini-2.5-flash-lite',             maxTokens: 600,  temperature: 0.4 },
  'low-cost':   { model: 'google/gemini-2.5-flash-lite',             maxTokens: 250,  temperature: 0.5 },
  // ── Komplexitäts-Routing (DeepSWE-inspiriert, Stand 2026-05-28) ─────────────
  // L1: Config, Docs, kleine Helpers — schnellstes + robustestes (ΔC+7 im DeepSWE-Test)
  L1:           { model: 'google/gemini-2.5-flash-lite',             maxTokens: 400,  temperature: 0.2 },
  // L2: Standard Routes, Services, Tests — Flash Lite gewinnt auch R2 mit 100% bei 1s Latenz
  L2:           { model: 'google/gemini-2.5-flash-lite',             maxTokens: 800,  temperature: 0.2 },
  // L3: Neue Architektur, Multi-Service-Integration — Grok 4.3 bester R4-Score (82%, ΔC+18)
  L3:           { model: 'x-ai/grok-4.3',                            maxTokens: 2000, temperature: 0.2 },
  // L4: Novel/Multi-File (668+ Zeilen, unbekannte Problemstellung) — nur Top-Modelle
  L4:           { model: 'claude-sonnet-4-6',                        maxTokens: 4000, temperature: 0.2 },
};

const DEFAULT_BRIEFING = 'Du bist KIMBA, Head of Engineering bei KI-OS. Du koordinierst Teams (Blau/Orange/Rot/Gold), gibst präzise Arbeitsaufträge und fasst Ergebnisse strukturiert zusammen. Antworte auf Deutsch, professionell und direkt.\n\nFüge am Ende deiner Antwort auf einer neuen Zeile eine Mood-Annotation hinzu:\nMOODS:[{"mood":"fragend","at":0},{"mood":"belehrend","at":3500}]\nVerfügbare Moods: neutral, laecheln, laugh, fragend, belehrend, flow, veraergert\nWähle 1-3 Moods passend zum Inhalt und schätze das Timing in ms basierend auf der Textlänge vor dem Mood-Wechsel (ca. 60ms pro Zeichen).';

const CODE_KEYWORDS = [
  'baue', 'erstell', 'schreib', 'schreibe', 'fix', 'fixe', 'füge', 'lösch',
  'refactor', 'commit', 'push', 'test', 'implementier', 'code', 'build',
  'deploy', 'sprint', 'öffne datei', 'lese datei', 'zeig mir den code',
  'ändere', 'aktualisiere', 'build', 'create', 'write', 'fix', 'add', 'delete',
  'refactor', 'commit', 'push', 'test', 'implement', 'code', 'build', 'deploy',
  'sprint', 'open file', 'read file', 'show me the code', 'change', 'update'
];

function classifyIntent(text) {
  if (!text) return 'kimba';

  const lowerText = text.toLowerCase().trim();

  // Force Claude Code if starts with !
  if (lowerText.startsWith('!')) {
    return 'claude-code';
  }

  // Check for code keywords
  for (const keyword of CODE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return 'claude-code';
    }
  }

  return 'kimba';
}

function parseMoodsFromOutput(raw) {
  const match = raw.match(/\nMOODS:(\[.*?\])\s*$/s);
  if (!match) return { cleanOutput: raw.trim(), moods: [] };
  try {
    const moods = JSON.parse(match[1]);
    const cleanOutput = raw.slice(0, match.index).trim();
    return { cleanOutput, moods };
  } catch {
    return { cleanOutput: raw.replace(/\nMOODS:.*$/s, '').trim(), moods: [] };
  }
}

// POST /api/mobile/ask
router.post('/ask', express.json(), async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    const qualityMode = String(req.body?.qualityMode || 'koordination');
    const briefing = String(req.body?.briefing || DEFAULT_BRIEFING).trim();
    const pendingContext = req.body?.pendingContext;
    const forceClaude = Boolean(req.body?.forceClaude);

    if (!text) return res.status(400).json({ error: 'text required' });

    const intent = classifyIntent(text);

    if (intent === 'claude-code' || forceClaude) {
      // Handle with Claude Code
      const result = await claudeBridge.runClaudeCode(text);
      return res.json({
        output: result.output,
        moods: [],
        claudeCode: true,
        duration: result.duration
      });
    }

    // Handle with KIMBA LLM
    const preset = KIOS_MODE_PRESET[qualityMode] || KIOS_MODE_PRESET.koordination;
    const interruptedResponse = String(pendingContext?.response || '').trim();
    const userPrompt = interruptedResponse
      ? `Vorheriger Kontext (unterbrochen): ${interruptedResponse}\n\nNeue Frage: ${text}`
      : text;

    const result = await llmRouter.call({
      systemPrompt: briefing,
      userPrompt,
      maxTokens: preset.maxTokens,
      temperature: preset.temperature,
      model: preset.model,
    });

    const { cleanOutput, moods } = parseMoodsFromOutput(String(result || ''));
    res.json({ output: cleanOutput, moods });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mobile/run-claude
router.post('/run-claude', express.json(), async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const allowedTools = req.body?.allowedTools;

    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const result = await claudeBridge.runClaudeCode(prompt, allowedTools ? { allowedTools } : {});

    res.json({
      output: result.output,
      duration: result.duration,
      exitCode: result.exitCode,
      claudeCode: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

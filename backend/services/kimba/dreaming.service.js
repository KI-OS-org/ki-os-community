/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
'use strict';

const fs = require('fs');
const path = require('path');

const SWARM_STORE = path.join(process.cwd(), '.swarm-memory', 'store.json');
const HANDOFF_FILE = path.join(process.cwd(), '.tmp', 'session-handoff.md');
const REPORT_PATH = path.join(process.cwd(), '.tmp', 'dreaming-report.json');
const BACKEND_URL = process.env.KIOS_URL || 'http://localhost:3000';

class DreamingService {
  _loadSwarmMemory() {
    try {
      const data = fs.readFileSync(SWARM_STORE, 'utf-8');
      const parsed = JSON.parse(data);
      const entries = Array.isArray(parsed) ? parsed : (parsed.entries || parsed.store || []);
      return entries.slice(-30).map(e =>
        `[${e.timestamp || '?'}] ${e.agent || e.role || '?'}: ${e.content || e.text || JSON.stringify(e).slice(0, 100)}`
      ).join('\n') || '(no data)';
    } catch {
      return '(no data)';
    }
  }

  _loadHandoff() {
    try {
      const data = fs.readFileSync(HANDOFF_FILE, 'utf-8');
      return data.substring(0, 2000);
    } catch (error) {
      return '(no handoff)';
    }
  }

  async _llm(message) {
    const https = require('https');
    const key = process.env.OPENAI_API_KEY;
    if (!key) return '';
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: message }],
      max_tokens: 500,
      temperature: 0.7,
    });
    return new Promise(resolve => {
      const req = https.request({
        hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString());
            resolve(json.choices?.[0]?.message?.content || '');
          } catch { resolve(''); }
        });
      });
      req.on('error', () => resolve(''));
      req.write(body);
      req.end();
    });
  }

  async run() {
    const memory = this._loadSwarmMemory();
    const handoff = this._loadHandoff();

    const stackContext = `KI-OS Tech-Stack: Node.js, Express, SQLite, LanceDB, React Native (Mobile), TypeScript (CLI), Discord.js (Bot), OpenRouter API, OpenAI API, Gemini TTS. KEIN Kubernetes, KEIN Helm, KEIN ClickHouse, KEIN Kafka, KEIN Confluence.`;

    const problemPrompt = `
Du analysierst KI-OS — ein lokales KI-Betriebssystem.
${stackContext}

AUFGABE: Identifiziere AUSSCHLIESSLICH Probleme und offene Punkte die WÖRTLICH im Session-Handoff unten stehen.
Füge NICHTS hinzu, was nicht explizit dort steht.
Falls der Handoff "(no handoff)" ist oder keine offenen Punkte enthält: schreibe nur "Keine offenen Punkte im aktuellen Handoff."

Session Handoff (einzige Quelle — letzte 24h):
${handoff}
`;

    const problems = await this._llm(problemPrompt);

    const noProblems = !problems || problems.toLowerCase().includes('keine offenen');

    let visions = '';
    let briefingSupplement = '';

    if (noProblems) {
      briefingSupplement = 'Keine offenen Blocker aus der letzten Session.';
    } else {
      const solutionPrompt = `
KI-OS Tech-Stack: Node.js, Express, SQLite, LanceDB, Discord.js, OpenRouter, OpenAI, Gemini TTS.
Nenne NUR Technologien aus diesem Stack. Erfinde KEINE Tools.

Probleme (aus echtem KI-OS Kontext):
${problems}

Pro Problem ein konkreter nächster Schritt. Format: Problem: X → Schritt: Z
Auf Deutsch.
`;
      visions = await this._llm(solutionPrompt);

      const briefingPrompt = `
Maximal 2 direkte Handlungsempfehlungen aus diesem KI-OS Kontext. Kein Intro, keine Floskeln.
NUR was unten steht — keine Erfindungen. Auf Deutsch.

Probleme: ${problems}
Schritte: ${visions}
`;
      briefingSupplement = await this._llm(briefingPrompt);
    }

    const report = {
      generatedAt: Date.now(),
      problems,
      visions,
      briefingSupplement,
      memoryEntries: memory === '(no data)' ? 0 : 
        memory.split('\n').filter(line => line.trim().length > 0).length
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    return report;
  }

  loadReport() {
    try {
      if (!fs.existsSync(REPORT_PATH)) {
        return null;
      }

      const data = fs.readFileSync(REPORT_PATH, 'utf-8');
      const report = JSON.parse(data);

      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now - report.generatedAt < twentyFourHours) {
        return report;
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Nightly Scheduler — läuft täglich um 03:00 Uhr
// ---------------------------------------------------------------------------
const DREAM_HOUR   = Number(process.env.DREAMING_HOUR   || 3);
const DREAM_MINUTE = Number(process.env.DREAMING_MINUTE || 0);
let _timer = null;

function _msUntilDream() {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(DREAM_HOUR, DREAM_MINUTE, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function startDreamingScheduler() {
  if (_timer) return;
  const delay = _msUntilDream();
  const hours = Math.floor(delay / 3600000);
  const mins  = Math.floor((delay % 3600000) / 60000);
  try {
    const logger = require('../core/logger.service');
    logger.info('[Dreaming] Nacht-Scheduler aktiv', {
      nextRun: `${DREAM_HOUR}:${String(DREAM_MINUTE).padStart(2, '0')} Uhr`,
      inMs: delay,
      inTime: `${hours}h ${mins}m`,
    });
  } catch {}
  _timer = setTimeout(async function tick() {
    try {
      const svc = new DreamingService();
      await svc.run();
    } catch {}
    _timer = setTimeout(tick, _msUntilDream());
  }, delay);
}

module.exports = { DreamingService, startDreamingScheduler };

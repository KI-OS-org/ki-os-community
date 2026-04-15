/**
 * @file    build-setup-scripts.js
 * @desc    Delegierter Build: setup.sh (Mac/Linux) + setup.bat (Windows) für Community Edition.
 *          Builder: Gemini 2.5 Flash Lite | Reviewer: DeepSeek V3.1
 * @usage   node scripts/build-setup-scripts.js
 * @author  Koordiniert von Kimba (Head of Engineering)
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const OpenRouter = require('../backend/services/providers/openrouter.provider');

const BUILDER  = 'google/gemini-2.5-flash-lite';
const REVIEWER = 'deepseek/deepseek-chat-v3.1';

const BUILD_SYSTEM = `Du bist ein Shell-Script-Spezialist.
Schreibe robuste, nutzerfreundliche Setup-Scripts.
Regeln:
- Fehler immer mit verständlicher Meldung + Hilfe-Link
- Interaktive Eingaben mit read (bash) / set /p (batch)
- Farbige Ausgabe wo möglich
- Vollständiges Script ausgeben, keine Auslassungen`;

const REVIEW_SYSTEM = `Du bist Shell-Script-Reviewer.
Prüfe: Korrektheit, Fehlerbehandlung, Cross-Platform-Kompatibilität, Sicherheit.
Antworte NUR als JSON ohne Markdown:
{"approved":true|false,"score":0.0-1.0,"issues":["..."],"summary":"1 Satz"}`;

// ─── Keys die interaktiv abgefragt werden ──────────────────────────────────

const REQUIRED_KEYS = [
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key (https://openrouter.ai/keys)', required: true },
  { key: 'ANTHROPIC_API_KEY',  label: 'Anthropic API Key (optional, Enter zum Überspringen)', required: false },
  { key: 'OPENAI_API_KEY',     label: 'OpenAI API Key (optional, Enter zum Überspringen)', required: false },
];

// ─── Tasks ────────────────────────────────────────────────────────────────────

const TASKS = [
  {
    id: 'setup-sh',
    file: 'setup.sh',
    description: 'setup.sh — Interaktives Setup-Script für Mac/Linux',
    task: `Schreibe setup.sh für KI-OS Community Edition (Mac/Linux, bash).

Das Script muss folgende Schritte in dieser Reihenfolge ausführen:

1. HEADER: Farbige Willkommens-Box ausgeben:
   "KI-OS Community Edition — Setup"
   "(c) 2026 ki-os.org — Ingo Schaffer & Kimba"

2. NODE.JS CHECK:
   - node --version prüfen, mindestens v18 erforderlich
   - Wenn fehlt oder zu alt: Fehlermeldung + Link "https://nodejs.org" + exit 1
   - Wenn ok: "✓ Node.js $(node --version) gefunden"

3. .ENV ERSTELLEN:
   - Wenn .env bereits existiert: "⚠ .env existiert bereits — wird nicht überschrieben"
   - Wenn nicht: cp .env.example .env
   - Dann interaktiv folgende Keys abfragen (read -r -p):
     a) OPENROUTER_API_KEY — Pflicht, leer = Warnung + nochmal fragen (max 3 Versuche)
     b) ANTHROPIC_API_KEY — optional, Enter = überspringen
     c) OPENAI_API_KEY — optional, Enter = überspringen
   - Keys in .env mit sed ersetzen: sed -i (Mac: sed -i '')
   - Mac/Linux Unterschied bei sed -i erkennen (uname check)

4. NPM INSTALL (Root):
   - "Installing backend dependencies..."
   - npm install --silent
   - Bei Fehler: exit 1 mit Meldung

5. FRONTEND INSTALL + BUILD:
   - cd frontend/orbit-control
   - npm install --silent
   - npm run build
   - cd zurück zum Root
   - Bei Fehler: exit 1

6. ABSCHLUSS:
   - Grüne Box:
     "✅ KI-OS ist bereit!"
     "Starte mit: npm start"
     "Dann öffne: http://localhost:3000"

Wichtig:
- set -euo pipefail am Anfang
- Alle Fehlerfälle abfangen
- sed -i Unterschied Mac vs Linux (uname -s check)
- Chmod +x Hinweis am Ende nicht nötig (wird vom build-script gesetzt)`,
    mustContain: ['node --version', 'OPENROUTER_API_KEY', '.env.example', 'npm install', 'npm run build', 'localhost:3000']
  },

  {
    id: 'setup-bat',
    file: 'setup.bat',
    description: 'setup.bat — Interaktives Setup-Script für Windows',
    task: `Schreibe setup.bat für KI-OS Community Edition (Windows, cmd/batch).

Das Script muss folgende Schritte in dieser Reihenfolge ausführen:

1. HEADER:
   @echo off, chcp 65001 (UTF-8), cls
   Willkommens-Box mit echo:
   "KI-OS Community Edition - Setup"
   "(c) 2026 ki-os.org"

2. NODE.JS CHECK:
   - node --version > nul 2>&1, errorlevel prüfen
   - Wenn fehlt: Fehlermeldung + "Download: https://nodejs.org" + pause + exit /b 1
   - Wenn ok: "OK: Node.js gefunden"

3. .ENV ERSTELLEN:
   - Wenn .env existiert (if exist .env): Warnung, nicht überschreiben
   - Wenn nicht: copy .env.example .env
   - Interaktiv abfragen mit set /p:
     a) OPENROUTER_API_KEY — Pflicht
     b) ANTHROPIC_API_KEY — optional (Enter = leer lassen)
     c) OPENAI_API_KEY — optional
   - Keys in .env mit PowerShell ersetzen:
     powershell -Command "(Get-Content .env) -replace 'OPENROUTER_API_KEY=', 'OPENROUTER_API_KEY=%OR_KEY%' | Set-Content .env"

4. NPM INSTALL (Root):
   - echo Installing backend dependencies...
   - call npm install
   - if errorlevel 1: Fehlermeldung + exit /b 1

5. FRONTEND INSTALL + BUILD:
   - cd frontend\\orbit-control
   - call npm install
   - call npm run build
   - cd ..\\..\\ (zurück zum Root)

6. ABSCHLUSS:
   - "KI-OS ist bereit! Starte mit: npm start"
   - "Dann oeffne: http://localhost:3000"
   - pause

Wichtig: Robuste Fehlerbehandlung mit errorlevel checks nach jedem kritischen Schritt.`,
    mustContain: ['node --version', 'OPENROUTER_API_KEY', '.env.example', 'npm install', 'npm run build', 'localhost:3000']
  }
];

// ─── Build + Review ───────────────────────────────────────────────────────────

async function buildTask(task) {
  const messages = [
    { role: 'system', content: BUILD_SYSTEM },
    { role: 'user',   content: task.task }
  ];
  const t0  = Date.now();
  const res = await OpenRouter.chat({ model: BUILDER, messages, temperature: 0.1 });
  return { text: res.text || res.reply || '', ms: Date.now() - t0 };
}

async function reviewOutput(task, output) {
  const messages = [
    { role: 'system', content: REVIEW_SYSTEM },
    { role: 'user',   content: `Aufgabe: ${task.description}\n\nScript:\n${output}` }
  ];
  const res = await OpenRouter.chat({ model: REVIEWER, messages, temperature: 0.1 });
  const raw = (res.text || '{}').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw.match(/\{[\s\S]+\}/)?.[0] || raw); }
  catch { return { approved: false, score: 0.5, issues: ['Review parse failed'], summary: 'Manual check needed' }; }
}

function extractCode(text) {
  const match = text.match(/```(?:bash|bat|batch|sh|cmd)?\s*([\s\S]+?)```/);
  return match ? match[1].trim() : text.trim();
}

function checkMustContain(output, items) {
  return items.filter(s => !output.includes(s));
}

// ─── Hauptlauf ────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  KI-OS Setup Scripts Build                                ║');
  console.log(`║  Builder:  ${BUILDER.padEnd(34)}      ║`);
  console.log(`║  Reviewer: ${REVIEWER.padEnd(34)}      ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const results = [];

  for (const task of TASKS) {
    console.log(`\n▶ [${task.id}] ${task.description}`);

    const build   = await buildTask(task);
    const code    = extractCode(build.text);
    const review  = await reviewOutput(task, code);
    const missing = checkMustContain(code, task.mustContain);

    const status = review.approved && missing.length === 0 ? '✅ APPROVED'
                 : review.approved && missing.length > 0   ? '⚠️  APPROVED (missing checks)'
                 : '❌ NEEDS REVISION';

    console.log(`  → Build: ${build.ms}ms | Score: ${review.score} | ${status}`);
    if (missing.length)        console.log(`  → Missing: ${missing.join(', ')}`);
    if (review.issues?.length) console.log(`  → Issues: ${review.issues.slice(0, 2).join(' | ')}`);
    console.log(`  → ${review.summary}`);

    results.push({ task, code, review, missing, status });
  }

  // Output
  console.log('\n' + '═'.repeat(70));
  for (const r of results) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  ${r.task.file} | ${r.status} | Score: ${r.review.score}`);
    console.log('─'.repeat(70));
    console.log(r.code);
  }

  const allApproved = results.every(r => r.review.approved);
  if (allApproved) {
    for (const r of results) {
      fs.writeFileSync(r.task.file, r.code, 'utf8');
      if (r.task.file.endsWith('.sh')) {
        try { require('child_process').execSync(`chmod +x ${r.task.file}`); } catch {}
      }
      console.log(`\n✅ Geschrieben: ${r.task.file}`);
    }
  } else {
    console.log('\n⚠️  Nicht alle approved — Kimba prüft manuell');
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

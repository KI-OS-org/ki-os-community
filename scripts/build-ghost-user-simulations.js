/**
 * @file    build-ghost-user-simulations.js
 * @desc    Baut Ghost Control User-Simulation Tests via Qwen 2.5 72B.
 *          3 Nutzer-Profile: Einsteiger · Medium · Fortgeschritten.
 *          Führt echte Ghost Plan API-Calls durch (DeepSeek/Gemini Flash/Qwen).
 *          Claude = Briefing. Qwen = Test-Code. DeepSeek = Review.
 * @usage   node scripts/build-ghost-user-simulations.js
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { build, review } = require('../backend/services/agent/qwen.builder.agent');

const TESTS_DIR = path.join(__dirname, '..', 'tests');

// ─── Briefings ────────────────────────────────────────────────────────────────

const BRIEFINGS = [

  // ── Einsteiger ──────────────────────────────────────────────────────────────
  {
    filename: 'ghost.simulation.beginner.test.js',
    task: `Schreibe eine Node.js Integration-Test-Datei die einen EINSTEIGER simuliert
der KI-OS Ghost Control zum ersten Mal benutzt.
Verwende Node.js native test runner (require('node:test') + require('node:assert')).
HTTP-Calls via node-fetch v2 (const fetch = require('node-fetch')).
Server: process.env.TEST_BASE_URL || 'http://localhost:3000'
Ghost Plan Endpoint: POST /api/ghost/plan

NUTZER-PROFIL: Einsteiger
- Schreibt einfache, kurze Anfragen
- Macht Tippfehler und unvollständige Sätze
- Testet was "passiert wenn man nichts eingibt"
- Fragt nach einfachen Aktionen wie Navigation

GENAU DIESE SZENARIEN als Tests (alle unter test() Blöcken, Timeout: 15000ms):

SZENARIO 1: Leere Eingabe
goal: ""
Erwartet: HTTP 400 (Validierungsfehler, goal fehlt)

SZENARIO 2: Sehr kurze Eingabe
goal: "hi"
Erwartet: HTTP 200, response ist valides JSON, hat entweder needsClarification oder plan

SZENARIO 3: Deutsche Alltagssprache
goal: "ich möchte einen agenten erstellen"
Erwartet: HTTP 200, response.needsClarification === false ODER needsClarification === true
assert: response hat needsClarification property (boolean)

SZENARIO 4: Englische Eingabe
goal: "create agent"
Erwartet: HTTP 200, valides JSON mit needsClarification property

SZENARIO 5: Zu langer Text (>500 Zeichen)
goal: "A".repeat(501)
Erwartet: HTTP 400, response.error existiert

SZENARIO 6: Ungültiger mode
goal: "neuen Job erstellen", mode: "falsch"
Erwartet: HTTP 400

REGELN:
- Jede response als JSON parsen und prüfen ob es valides JSON ist
- Keine echten LLM-Calls nötig — nur API-Endpunkt testen
- Kommentare erklären kurz was der Einsteiger versucht
- Vollständig ausführbar: node --test tests/ghost.simulation.beginner.test.js`
  },

  // ── Medium ──────────────────────────────────────────────────────────────────
  {
    filename: 'ghost.simulation.medium.test.js',
    task: `Schreibe eine Node.js Integration-Test-Datei die einen MEDIUM-Nutzer simuliert
der KI-OS Ghost Control regelmäßig benutzt und die Konzepte kennt.
Verwende Node.js native test runner (require('node:test') + require('node:assert')).
HTTP-Calls via node-fetch v2 (const fetch = require('node-fetch')).
Server: process.env.TEST_BASE_URL || 'http://localhost:3000'
Ghost Plan Endpoint: POST /api/ghost/plan

NUTZER-PROFIL: Medium
- Kennt Demo vs Build Modus
- Formuliert konkrete Ziele
- Nutzt verschiedene Aktionstypen (Agent, Job, Flow, Navigation)
- Erwartet strukturierte Antworten

GENAU DIESE SZENARIEN als Tests (alle unter test() Blöcken, Timeout: 15000ms):

SZENARIO 1: Demo-Modus — Agenten erstellen
goal: "Zeige mir wie ich einen neuen KI-Agenten für E-Mail-Analyse erstelle", mode: "demo"
Erwartet: HTTP 200, plan.steps ist Array mit mindestens 1 Element ODER needsClarification

SZENARIO 2: Build-Modus — Job erstellen
goal: "Erstelle einen täglichen Job der um 08:00 Uhr einen Bericht generiert", mode: "build"
Erwartet: HTTP 200, valides JSON

SZENARIO 3: Navigation-Intent
goal: "Navigiere zur Memory-Seite", mode: "demo"
Erwartet: HTTP 200, falls plan vorhanden: erster Step hat type navigate oder spotlight

SZENARIO 4: Komplexerer Workflow
goal: "Erstelle einen Agenten und verbinde ihn mit einem Webhook-Trigger", mode: "demo"
Erwartet: HTTP 200, valides JSON

SZENARIO 5: Mode explizit build
goal: "Speichere einen neuen Provider mit OpenAI Key", mode: "build"
Erwartet: HTTP 200

SZENARIO 6: Antwort-Struktur-Validierung
goal: "Öffne die Governance-Seite", mode: "demo"
Erwartet: HTTP 200, response hat entweder { needsClarification: false, plan: { id, steps } }
         oder { needsClarification: true, question: string }

REGELN:
- Bei jedem Test: prüfe dass response.needsClarification ein boolean ist
- Falls plan vorhanden: prüfe plan.id (string), plan.steps (array)
- Kommentare zeigen Nutzer-Perspektive
- Vollständig ausführbar: node --test tests/ghost.simulation.medium.test.js`
  },

  // ── Fortgeschritten ─────────────────────────────────────────────────────────
  {
    filename: 'ghost.simulation.advanced.test.js',
    task: `Schreibe eine Node.js Integration-Test-Datei die einen FORTGESCHRITTENEN Nutzer simuliert
der KI-OS Ghost Control intensiv nutzt und die Grenzen auslotet.
Verwende Node.js native test runner (require('node:test') + require('node:assert')).
HTTP-Calls via node-fetch v2 (const fetch = require('node-fetch')).
Server: process.env.TEST_BASE_URL || 'http://localhost:3000'
Ghost Plan Endpoint: POST /api/ghost/plan

NUTZER-PROFIL: Fortgeschritten
- Testet Edge Cases und komplexe Workflows
- Nutzt Sonderzeichen, Markdown, Code-Snippets in goals
- Macht Parallel-Requests (mehrere gleichzeitig)
- Validiert Response-Strukturen detailliert

GENAU DIESE SZENARIEN als Tests (alle unter test() Blöcken, Timeout: 20000ms):

SZENARIO 1: Sonderzeichen im goal
goal: "Erstelle Agent mit Name 'Müller & Söhne KI' für <email@domain.de>"
Erwartet: HTTP 200, kein Server-Crash, valides JSON

SZENARIO 2: Multi-Step Workflow
goal: "Erstelle einen Flow: Agent A analysiert E-Mail → Agent B kategorisiert → Agent C antwortet automatisch", mode: "build"
Erwartet: HTTP 200, falls plan: steps.length >= 3

SZENARIO 3: Technischer Prompt mit Code
goal: "Erstelle einen Agenten mit system prompt: 'Du bist ein JSON-Validator. Input: {data: string}. Output: {valid: boolean, errors: string[]}'", mode: "build"
Erwartet: HTTP 200, valides JSON

SZENARIO 4: Parallele Requests (3 gleichzeitig)
3 simultane POST /api/ghost/plan mit unterschiedlichen goals
Erwartet: alle 3 antworten mit HTTP 200, alle valides JSON

SZENARIO 5: Response-Zeit unter 10 Sekunden
goal: "Zeige Supervisor-Dashboard", mode: "demo"
Erwartet: HTTP 200 UND Antwortzeit < 10000ms
Messe: Date.now() vor und nach fetch()

SZENARIO 6: Vollständige Schema-Validierung bei needsClarification: false
goal: "Erstelle neuen Agenten für Datenanalyse", mode: "demo"
Falls plan vorhanden, prüfe ALLE Pflichtfelder:
  plan.id (string), plan.mode (demo|build), plan.title (string),
  plan.description (string), plan.steps (array, jeder Step hat id + type + callout)

REGELN:
- Für Parallel-Test: Promise.all([fetch(...), fetch(...), fetch(...)]) verwenden
- Response-Zeit mit Date.now() messen
- Schema-Validierung mit assert.ok() und spezifischen Fehlermeldungen
- Vollständig ausführbar: node --test tests/ghost.simulation.advanced.test.js`
  }
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Ghost Control User Simulations — Qwen Build + DeepSeek Rev ║');
  console.log('║  Profile: Einsteiger · Medium · Fortgeschritten             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('  ✗ OPENROUTER_API_KEY fehlt'); process.exit(1);
  }

  for (const briefing of BRIEFINGS) {
    console.log(`\n→ [Qwen] Schreibe: tests/${briefing.filename}`);
    const buildResult = await build(briefing.task, { language: 'javascript', maxTokens: 3500 });

    if (!buildResult.success) {
      console.log(`  ✗ Build-Fehler: ${buildResult.error}`); continue;
    }

    const match = buildResult.output.match(/```(?:javascript|js)?\s*([\s\S]+?)```/);
    const code  = match ? match[1].trim() : buildResult.output.trim();

    console.log(`  → [DeepSeek] Review: ${briefing.filename}`);
    const rev = await review(code, `Ghost Control User Simulation Test: ${briefing.filename}`);
    if (rev.success && rev.review) {
      const r = rev.review;
      console.log(`  DeepSeek: ${r.approved ? '✓' : '⚠'} score:${r.score} — ${r.summary}`);
    }

    const outPath = path.join(TESTS_DIR, briefing.filename);
    fs.writeFileSync(outPath, code, 'utf8');
    console.log(`  ✓ Geschrieben: tests/${briefing.filename} (${code.length} Zeichen)`);
  }

  console.log('\n─────────────────────────────────────────────────');
  console.log('Nächster Schritt — Server starten + Tests ausführen:');
  console.log('  npm start &');
  console.log('  node --test tests/ghost.simulation.beginner.test.js');
  console.log('  node --test tests/ghost.simulation.medium.test.js');
  console.log('  node --test tests/ghost.simulation.advanced.test.js\n');
}

main().catch(err => { console.error('Fehler:', err.message); process.exit(1); });

/**
 * @file    build-frontend-tests.js
 * @desc    Baut komplette Frontend-Test-Suite via Qwen 2.5 72B + DeepSeek Review.
 *          Deckt ALLE Seiten, Buttons, Eingaben und Ausgaben ab.
 *          Ghost Control POST /ghost/plan als Simulationsmotor.
 *          Claude = Briefing. Qwen = Code. DeepSeek = Review.
 * @usage   node scripts/build-frontend-tests.js
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { build, review } = require('../backend/services/agent/qwen.builder.agent');

const TESTS_DIR = path.join(__dirname, '..', 'tests', 'frontend');
if (!fs.existsSync(TESTS_DIR)) fs.mkdirSync(TESTS_DIR, { recursive: true });

const BASE = `process.env.TEST_BASE_URL || 'http://localhost:3000'`;
const GHOST_ENDPOINT = '/ghost/plan';

const COMMON_RULES = `
GEMEINSAME REGELN:
- Node.js native test runner: require('node:test') + require('node:assert')
- HTTP via node-fetch v2: const fetch = require('node-fetch')
- const BASE_URL = ${BASE}
- Ghost Plan via: POST \${BASE_URL}${GHOST_ENDPOINT} mit { goal, mode }
- Timeout pro test(): 20000ms — als dritten Parameter NICHT übergeben (nicht unterstützt)
  Stattdessen: eigener fetch AbortController mit 18000ms falls nötig
- Jeder Test prüft: HTTP-Status + JSON-Struktur + Ghost-Plan-Steps (falls plan vorhanden)
- Bei needsClarification: true → test passes (valide Antwort)
- Bei plan vorhanden: plan.steps muss Array sein, jeder Step hat id + type + callout
- VOLLSTÄNDIGE DATEI, sofort ausführbar
`;

// ─── Briefings ────────────────────────────────────────────────────────────────

const BRIEFINGS = [

  // ── 1. Navigation & Routing ────────────────────────────────────────────────
  {
    filename: 'nav.test.js',
    task: `Schreibe Node.js Tests für die KI-OS Navigation — alle 27 Seiten via Ghost Control.
${COMMON_RULES}

SZENARIEN (je 1 Ghost-Plan-Request pro Seite):

Für jede der folgenden Seiten: teste dass POST /ghost/plan mit goal="Navigiere zu [Seite]" HTTP 200 zurückgibt
und der Plan einen navigate-Step zur richtigen Route enthält ODER needsClarification: true zurückgibt.

Seiten und Routen:
Home (/), AgentMesh (/agentmesh), Agents (/agents), Flows (/flows), Runs (/runs), Jobs (/jobs),
Workspace (/workspace), Memory (/memory), Files (/files), Documents (/documents),
Connector Galaxy (/connector-galaxy), Integrations (/integrations), Webhooks (/webhooks),
Providers (/providers), MCP (/mcp),
Campaigns (/campaigns), Economic (/economic), Efficiency (/efficiency), Media Studio (/media),
Control (/control), Trust (/trust), Privacy (/privacy), Supervisor (/supervisor), Tests (/tests),
Tenants (/tenants), State (/state), Notifications (/notifications)

PRO TEST:
1. POST /ghost/plan mit goal: "Navigiere zur [Seite-Name] Seite", mode: "demo"
2. assert HTTP 200
3. assert response hat needsClarification (boolean) ODER plan.steps
4. Falls plan: prüfe ob erster Step type "navigate" ist mit target der die Route enthält

Schreibe die Tests EFFIZIENT — gruppiere ähnliche Tests oder nutze eine Hilfsfunktion testNavigation(name, route).`
  },

  // ── 2. Agents Page — CRUD ──────────────────────────────────────────────────
  {
    filename: 'agents.crud.test.js',
    task: `Schreibe Node.js Tests für die KI-OS Agents-Seite — alle CRUD-Operationen via Ghost Control.
${COMMON_RULES}

data-ghost Selektoren auf /agents:
new-agent-btn, agent-name (Input), agent-category (Select), agent-prompt (Textarea),
agent-save, agent-edit, agent-delete, agent-toggle

SZENARIEN:

TEST 1: Neuen Agenten erstellen (vollständiger Workflow)
goal: "Erstelle einen neuen Agenten namens 'Test-Agent' mit Kategorie 'General' und Prompt 'Du bist ein Assistent'", mode: "build"
Prüfe: plan.steps enthält spotlight+fill für agent-name, agent-category, agent-prompt, dann click agent-save

TEST 2: Agenten bearbeiten
goal: "Bearbeite den ersten Agenten in der Liste", mode: "build"
Prüfe: plan enthält click auf agent-edit

TEST 3: Agenten aktivieren/deaktivieren
goal: "Aktiviere den ersten Agenten in der Liste", mode: "build"
Prüfe: plan enthält click auf agent-toggle

TEST 4: Agenten löschen
goal: "Lösche den Agenten 'Test-Agent'", mode: "build"
Prüfe: plan enthält click auf agent-delete

TEST 5: Eingabe-Validierung — leerer Name
goal: "Erstelle einen Agenten ohne Name", mode: "build"
Prüfe: HTTP 200, valides JSON (Ghost Plan generiert immer einen Plan oder fragt nach)

TEST 6: Zu langer Prompt
goal: "Erstelle Agenten mit System Prompt von 10000 Zeichen", mode: "build"
Prüfe: HTTP 200, plan oder needsClarification`
  },

  // ── 3. Jobs & Flows ────────────────────────────────────────────────────────
  {
    filename: 'jobs.flows.test.js',
    task: `Schreibe Node.js Tests für Jobs und Flows in KI-OS via Ghost Control.
${COMMON_RULES}

JOBS data-ghost: new-job-btn, job-name, job-schedule, job-agent, job-save, job-run
FLOWS data-ghost: new-flow-btn, flow-name, flow-save, flow-execute

JOBS SZENARIEN:

TEST 1: Neuen Job erstellen
goal: "Erstelle einen täglichen Job 'Täglicher Bericht' um 08:00 Uhr mit dem ersten verfügbaren Agenten", mode: "build"
Prüfe: Steps enthalten new-job-btn, job-name fill, job-schedule fill, job-save

TEST 2: Job sofort ausführen
goal: "Führe den Job 'Täglicher Bericht' sofort aus", mode: "build"
Prüfe: Steps enthalten job-run click

TEST 3: Job ohne Zeitplan
goal: "Erstelle Job ohne Zeitplan nur mit Name", mode: "build"
Prüfe: HTTP 200

TEST 4: Flows — neuen Flow erstellen
goal: "Erstelle einen neuen Flow namens 'E-Mail Pipeline'", mode: "build"
Prüfe: Steps enthalten new-flow-btn, flow-name fill

TEST 5: Flow ausführen
goal: "Führe den Flow 'E-Mail Pipeline' aus", mode: "build"
Prüfe: Steps enthalten flow-execute

TEST 6: UX-Check — was zeigt die Flows-Seite dem User?
goal: "Zeige mir alle vorhandenen Flows", mode: "demo"
Prüfe: HTTP 200, plan oder needsClarification`
  },

  // ── 4. Workspace & Memory ──────────────────────────────────────────────────
  {
    filename: 'workspace.memory.test.js',
    task: `Schreibe Node.js Tests für Workspace und Memory in KI-OS via Ghost Control.
${COMMON_RULES}

SZENARIEN:

TEST 1: Workspace — Datei hochladen
goal: "Lade eine Datei im Workspace hoch", mode: "build"
Prüfe: HTTP 200, plan oder needsClarification

TEST 2: Memory — Eintrag suchen
goal: "Suche im Memory nach Einträgen über Agenten", mode: "demo"
Prüfe: HTTP 200

TEST 3: Memory — neuen Eintrag erstellen
goal: "Erstelle einen neuen Memory-Eintrag mit Text 'Wichtige Information'", mode: "build"
Prüfe: HTTP 200

TEST 4: Files — Datei suchen
goal: "Suche die Datei report.pdf in Files", mode: "demo"
Prüfe: HTTP 200

TEST 5: Documents — PDF verarbeiten
goal: "Lade ein PDF hoch und extrahiere den Text", mode: "build"
Prüfe: HTTP 200

TEST 6: Workspace UX — was sieht ein neuer Nutzer?
goal: "Zeige mir den Workspace Überblick", mode: "demo"
Prüfe: HTTP 200, plan hat steps`
  },

  // ── 5. Providers & Integrations ────────────────────────────────────────────
  {
    filename: 'providers.integrations.test.js',
    task: `Schreibe Node.js Tests für Providers, Integrations, Webhooks und MCP via Ghost Control.
${COMMON_RULES}

SZENARIEN:

TEST 1: Provider hinzufügen
goal: "Füge einen neuen OpenAI Provider mit API Key hinzu", mode: "build"
Prüfe: Steps enthalten Provider-Formular-Felder

TEST 2: Provider health check
goal: "Prüfe ob alle Provider gesund sind", mode: "demo"
Prüfe: HTTP 200

TEST 3: Integration hinzufügen
goal: "Verbinde eine neue Slack Integration", mode: "build"
Prüfe: HTTP 200

TEST 4: Webhook erstellen
goal: "Erstelle einen neuen Webhook für neue Agent-Runs", mode: "build"
Prüfe: HTTP 200, plan steps

TEST 5: Webhook testen
goal: "Teste den Webhook 'Agent Run Notifications'", mode: "build"
Prüfe: HTTP 200

TEST 6: MCP Capability aufrufen
goal: "Rufe die MCP Capability 'file-read' auf", mode: "build"
Prüfe: HTTP 200`
  },

  // ── 6. Governance & Trust ──────────────────────────────────────────────────
  {
    filename: 'governance.trust.test.js',
    task: `Schreibe Node.js Tests für Governance, Trust, Privacy und Supervisor via Ghost Control.
${COMMON_RULES}

SZENARIEN:

TEST 1: Control Plane — System-Health prüfen
goal: "Zeige mir den Gesundheitsstatus des Systems", mode: "demo"
Prüfe: HTTP 200, plan navigiert zu /control

TEST 2: Trust — Audit-Log anzeigen
goal: "Zeige das Audit-Log der letzten 24 Stunden", mode: "demo"
Prüfe: HTTP 200

TEST 3: Trust — Genehmigung erteilen
goal: "Genehmige die erste ausstehende Anfrage im Trust Center", mode: "build"
Prüfe: HTTP 200, steps enthalten approve-Aktion

TEST 4: Trust — Genehmigung ablehnen
goal: "Lehne die ausstehende Anfrage ab", mode: "build"
Prüfe: HTTP 200

TEST 5: Privacy — PII erkennen
goal: "Erkenne PII-Daten im Text 'Max Mustermann, max@test.de, Tel: 0123456789'", mode: "build"
Prüfe: HTTP 200

TEST 6: Supervisor — Eskalation anzeigen
goal: "Zeige alle offenen Eskalationen im Supervisor", mode: "demo"
Prüfe: HTTP 200, plan navigiert zu /supervisor`
  },

  // ── 7. AgentMesh & Runs ────────────────────────────────────────────────────
  {
    filename: 'agentmesh.runs.test.js',
    task: `Schreibe Node.js Tests für AgentMesh und Runs via Ghost Control.
${COMMON_RULES}

SZENARIEN:

TEST 1: AgentMesh — Task starten
goal: "Starte einen neuen Multi-Agent Task mit dem Ziel 'Analysiere den Markt für KI-Tools'", mode: "build"
Prüfe: HTTP 200, plan steps

TEST 2: AgentMesh — laufende Tasks anzeigen
goal: "Zeige alle laufenden AgentMesh Tasks", mode: "demo"
Prüfe: HTTP 200

TEST 3: Runs — letzten Run anzeigen
goal: "Zeige mir den letzten Agent-Run mit allen Details", mode: "demo"
Prüfe: HTTP 200, plan navigiert zu /runs

TEST 4: Runs — Run stoppen
goal: "Stoppe den laufenden Run", mode: "build"
Prüfe: HTTP 200

TEST 5: Runs — Run-Trace anzeigen
goal: "Zeige den Execution-Trace des letzten Runs", mode: "demo"
Prüfe: HTTP 200

TEST 6: AgentMesh — Ergebnis exportieren
goal: "Exportiere das Ergebnis des letzten AgentMesh-Tasks als JSON", mode: "build"
Prüfe: HTTP 200`
  },

  // ── 8. Intelligence & Media ────────────────────────────────────────────────
  {
    filename: 'intelligence.media.test.js',
    task: `Schreibe Node.js Tests für Campaigns, Economic, Efficiency und Media Studio via Ghost Control.
${COMMON_RULES}

SZENARIEN:

TEST 1: Campaign erstellen
goal: "Erstelle eine neue Social-Media Campaign für KI-OS mit 5 Posts", mode: "build"
Prüfe: HTTP 200, plan steps

TEST 2: Economic — Profil anzeigen
goal: "Zeige das aktuelle wirtschaftliche Profil und die Scorecards", mode: "demo"
Prüfe: HTTP 200

TEST 3: Efficiency — Wettbewerber-Analyse starten
goal: "Starte eine Wettbewerber-Analyse für KI-OS", mode: "build"
Prüfe: HTTP 200

TEST 4: Media Studio — Bild generieren
goal: "Generiere ein Bild mit dem Prompt 'KI-Roboter im Büro'", mode: "build"
Prüfe: HTTP 200

TEST 5: Media Studio — Video-Synthese
goal: "Erstelle ein kurzes Erklärvideo für KI-OS", mode: "build"
Prüfe: HTTP 200

TEST 6: Notifications — alle anzeigen
goal: "Zeige alle Benachrichtigungen der letzten Woche", mode: "demo"
Prüfe: HTTP 200`
  },

  // ── 9. System & State ──────────────────────────────────────────────────────
  {
    filename: 'system.state.test.js',
    task: `Schreibe Node.js Tests für System, State, Tenants und Connector Galaxy via Ghost Control.
${COMMON_RULES}

SZENARIEN:

TEST 1: State — exportieren
goal: "Exportiere den aktuellen System-State als JSON", mode: "build"
Prüfe: HTTP 200

TEST 2: State — importieren
goal: "Importiere einen State aus einer JSON-Datei", mode: "build"
Prüfe: HTTP 200

TEST 3: Tenants — neuen Tenant erstellen
goal: "Erstelle einen neuen Tenant 'Firma XYZ' mit Plan 'Professional'", mode: "build"
Prüfe: HTTP 200, plan steps

TEST 4: Connector Galaxy — Status prüfen
goal: "Zeige alle Konnektoren in der Galaxy und ihren Status", mode: "demo"
Prüfe: HTTP 200, plan navigiert zu /connector-galaxy

TEST 5: Connector Galaxy — Konnektor aktivieren
goal: "Aktiviere den inaktiven Konnektor in der Galaxy", mode: "build"
Prüfe: HTTP 200

TEST 6: Tests-Seite — Frontend Tests starten
goal: "Starte alle automatisierten Frontend Tests", mode: "build"
Prüfe: HTTP 200`
  },

  // ── 10. UX/UI Qualitäts-Check ─────────────────────────────────────────────
  {
    filename: 'ux.quality.test.js',
    task: `Schreibe Node.js Tests die UX/UI Qualität via Ghost Control prüfen.
${COMMON_RULES}

PRÜFKRITERIEN:
- Verständlichkeit: Ist der Ghost Plan-Text (callouts) klar und hilfreich?
- Vollständigkeit: Sind alle nötigen Steps vorhanden?
- Keine Duplikate: Keine zwei Steps mit identischem type+target
- Schritt-Anzahl: Zwischen 1 und 10 Steps (KIMBA-Regel)
- Deutsche Sprache: Callouts auf Deutsch

SZENARIEN:

TEST 1: Einfachster Workflow — genau 1 navigate Step erwartet
goal: "Öffne die Agents-Seite", mode: "demo"
Prüfe: plan.steps.length >= 1, erster Step type "navigate", callout.length > 0

TEST 2: Kein Step-Duplikat bei Agent-Erstellung
goal: "Erstelle einen neuen Agenten", mode: "demo"
Prüfe: Keine zwei Steps mit identischem target UND identischem type

TEST 3: Callouts nicht leer
goal: "Navigiere zum Memory und erstelle einen Eintrag", mode: "demo"
Prüfe: Alle steps haben callout.length > 5

TEST 4: Max 10 Steps eingehalten
goal: "Mache einen vollständigen Agenten-Erstellungs-Workflow mit allen Feldern", mode: "demo"
Prüfe: plan.steps.length <= 10

TEST 5: Reihenfolge korrekt — navigate vor spotlight vor click/fill
goal: "Erstelle einen neuen Job", mode: "demo"
Prüfe: Wenn navigate-Step vorhanden, erscheint er NICHT nach einem fill-Step

TEST 6: needsClarification hat immer question-Text
goal: "Mach irgendwas", mode: "demo"
Falls needsClarification: true → prüfe r.question.length > 10

TEST 7: Parallele UX-Loads — 5 gleichzeitige Anfragen
Alle 5 simultan: POST /ghost/plan mit verschiedenen goals
Prüfe: alle 5 antworten HTTP 200, duration < 30000ms gesamt (Promise.all mit Zeitstempel)`
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  KI-OS Frontend Test Builder — Komplette UI/UX Coverage        ║');
  console.log('║  10 Test-Suiten · Qwen baut · DeepSeek reviewed · Claude prüft ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('  ✗ OPENROUTER_API_KEY fehlt'); process.exit(1);
  }

  const results = [];

  for (const briefing of BRIEFINGS) {
    const outPath = path.join(TESTS_DIR, briefing.filename);
    console.log(`\n→ [Qwen] ${briefing.filename}`);

    const buildResult = await build(briefing.task, { language: 'javascript', maxTokens: 4000 });

    if (!buildResult.success) {
      console.log(`  ✗ Build-Fehler: ${buildResult.error}`);
      results.push({ filename: briefing.filename, built: false, error: buildResult.error });
      continue;
    }

    // Code-Block extrahieren
    const match = buildResult.output.match(/```(?:javascript|js)?\s*([\s\S]+?)```/);
    const code  = match ? match[1].trim() : buildResult.output.trim();

    if (code.length < 200) {
      console.log(`  ⚠ Output zu kurz (${code.length} Zeichen) — übersprungen`);
      results.push({ filename: briefing.filename, built: false, error: 'output too short' });
      continue;
    }

    // DeepSeek Review
    console.log(`  → [DeepSeek] Review`);
    const rev = await review(code, `KI-OS Frontend Test: ${briefing.filename}`);
    let score = '?';
    let approved = false;
    if (rev.success && rev.review) {
      score    = rev.review.score || '?';
      approved = rev.review.approved;
      console.log(`  DeepSeek: ${approved ? '✓' : '⚠'} score:${score} — ${(rev.review.summary || '').slice(0, 80)}`);
    }

    fs.writeFileSync(outPath, code, 'utf8');
    console.log(`  ✓ Geschrieben: tests/frontend/${briefing.filename} (${code.length} Zeichen)`);
    results.push({ filename: briefing.filename, built: true, score, approved, chars: code.length });
  }

  // Zusammenfassung
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  ERGEBNIS — Frontend Test Build                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  const ok  = results.filter(r => r.built);
  const err = results.filter(r => !r.built);

  for (const r of results) {
    const icon = r.built ? (r.approved ? '✓' : '⚠') : '✗';
    console.log(`  ${icon}  tests/frontend/${r.filename}${r.score ? ' score:' + r.score : ''}${r.error ? ' — ' + r.error : ''}`);
  }

  console.log(`\n  Gebaut: ${ok.length}/${results.length}  |  Fehler: ${err.length}`);
  console.log('\n  Ausführen (Server muss laufen):');
  console.log('  node --test tests/frontend/*.test.js\n');

  // Log-Datei
  const logPath = path.join(__dirname, '..', 'docs', 'FRONTEND_TESTS_BUILD.md');
  const lines = [
    '# Frontend Test Build — ' + new Date().toISOString().slice(0, 10) + '\n\n',
    '## Test-Suiten\n\n',
    '| Datei | Status | Score | Zeichen |\n',
    '|---|---|---|---|\n',
    ...results.map(r => `| \`tests/frontend/${r.filename}\` | ${r.built ? (r.approved ? '✅' : '⚠️') : '❌'} | ${r.score || '-'} | ${r.chars || '-'} |\n`),
    '\n## Abgedeckte Bereiche\n\n',
    '- Navigation (27 Seiten)\n',
    '- Agents CRUD (erstellen, bearbeiten, löschen, toggle)\n',
    '- Jobs & Flows (erstellen, ausführen)\n',
    '- Workspace & Memory (upload, suche, CRUD)\n',
    '- Providers & Integrations (hinzufügen, health check, webhooks, MCP)\n',
    '- Governance & Trust (audit, approve, reject, PII, supervisor)\n',
    '- AgentMesh & Runs (start, stop, trace, export)\n',
    '- Intelligence & Media (campaigns, economic, efficiency, media studio)\n',
    '- System & State (export, import, tenants, connector galaxy)\n',
    '- UX/UI Qualität (callout-Qualität, Duplikate, Step-Anzahl, Reihenfolge)\n',
  ];
  fs.writeFileSync(logPath, lines.join(''), 'utf8');
  console.log(`  Log: docs/FRONTEND_TESTS_BUILD.md\n`);
}

main().catch(err => { console.error('Fehler:', err.message); process.exit(1); });

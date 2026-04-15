/**
 * @file    build-v150-tests.js
 * @desc    Baut Test-Dateien für v1.5.0 Features via Qwen 2.5 72B.
 *          Abgedeckt: ghost.vision.service, ghost.plan timeout-fallback,
 *          build-file-headers (Dry-Run Logik).
 *          Claude = Briefing + Verifikation. Qwen = Code-Generierung.
 * @usage   node scripts/build-v150-tests.js
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { build, review } = require('../backend/services/agent/qwen.builder.agent');

const TESTS_DIR = path.join(__dirname, '..', 'tests');

// ─── Briefings von Claude (Head) an Qwen ─────────────────────────────────────

const TEST_BRIEFINGS = [

  // ── 1. Ghost Vision Service ────────────────────────────────────────────────
  {
    filename: 'ghost.vision.test.js',
    task: `Schreibe eine Node.js Test-Datei für ghost.vision.service.js in KI-OS.
Verwende Node.js native test runner (require('node:test') + require('node:assert')).
Kein Jest, kein Mocha, kein node-fetch.

DATEI-PFAD: backend/services/ghost/ghost.vision.service.js
EXPORT: { verifyStep }

SIGNATUR:
verifyStep(imageData, stepDescription, options?)
  imageData:       string — Base64 oder Data-URL (data:image/png;base64,...)
  stepDescription: string — was geprüft werden soll
  options:         { stepType?, target? }
  returns Promise<{ verified, confidence, description, hint?, provider }>

KONTEXT: Da kein echter API-Key im Test, sollen Provider-Calls gemockt werden.
Für Mocking: process.env.ANTHROPIC_API_KEY = 'test-key'; setzen und
require('../backend/services/providers/anthropic.provider') mocken via
require.cache Manipulation ODER einfach Fehler-Pfade testen (kein Key → Error).

GENAU DIESE SZENARIEN als Tests:

SZENARIO 1: verifyStep ohne imageData → wirft Error 'imageData ist erforderlich'
test: await assert.rejects(verifyStep('', 'step'), /imageData/)

SZENARIO 2: verifyStep ohne stepDescription → wirft Error 'stepDescription ist erforderlich'
test: await assert.rejects(verifyStep('data:image/png;base64,abc', ''), /stepDescription/)

SZENARIO 3: Ungültiger Bildtyp (data:image/bmp;base64,...) → wirft Error 'Nicht unterstützter Bildtyp'
test: await assert.rejects(verifyStep('data:image/bmp;base64,abc', 'step'), /Nicht unterstützter/)

SZENARIO 4: Bild zu groß (simuliert durch sehr langen Base64-String > 5MB) → wirft Error 'Bild zu groß'
const bigBase64 = 'A'.repeat(7 * 1024 * 1024); // ~7MB
test: await assert.rejects(verifyStep('data:image/png;base64,' + bigBase64, 'step'), /zu groß/)

SZENARIO 5: Kein Provider konfiguriert (kein ANTHROPIC_API_KEY, kein OPENROUTER_API_KEY) → wirft Error
delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENROUTER_API_KEY;
test: await assert.rejects(verifyStep('data:image/png;base64,abc123', 'step'), /Provider/)

REGELN:
- require.cache leeren für ghost.vision.service vor jedem Test der env vars ändert
- Jeder Test unabhängig (eigene describe/test Blöcke)
- Am Anfang Umgebungsvariablen sichern, am Ende wiederherstellen
- Vollständige Datei, sofort ausführbar mit: node --test tests/ghost.vision.test.js`
  },

  // ── 2. Ghost Plan Timeout Fallback ─────────────────────────────────────────
  {
    filename: 'ghost.plan.timeout.test.js',
    task: `Schreibe eine Node.js Test-Datei für den Timeout-Fallback in ghost.plan.service.js.
Verwende Node.js native test runner (require('node:test') + require('node:assert')).
Kein Jest, kein Mocha.

DATEI: backend/services/ghost/ghost.plan.service.js
EXPORT: { generatePlan }

KONTEXT: generatePlan() ruft intern callLLM() auf. Bei Timeout oder Provider-Fehler
soll statt eines 500-Errors ein { needsClarification: true, question: '...' } zurückgegeben werden.

MOCK-STRATEGIE: process.env manipulieren + openrouter/anthropic provider aus require.cache entfernen
und durch Mock ersetzen der einen Timeout simuliert.

GENAU DIESE SZENARIEN als Tests:

SZENARIO 1: generatePlan mit leerem goal → wirft Error (Validierung im Controller, nicht im Service)
Hinweis: Der Service wirft hier keinen Fehler — überspringen oder als Dokumentationstest.
test: const result = await generatePlan('', 'demo'); // kein crash erwartet

SZENARIO 2: generatePlan ohne API Keys → gibt { needsClarification: true } zurück
Vorbereitung: process.env.OPENROUTER_API_KEY = ''; process.env.ANTHROPIC_API_KEY = '';
test: const r = await generatePlan('Erstelle einen Agenten'); assert.strictEqual(r.needsClarification, true);

SZENARIO 3: generatePlan mit simuliertem Timeout-Fehler via gemocktem Provider
Mocking: require.cache Trick — openrouter.provider durch Mock ersetzen der Promise.reject(new Error('Ghost Plan LLM timeout after 20000ms')) wirft
test: r.needsClarification === true, r.question enthält 'langsam' oder 'timeout' oder 'erneut'

SZENARIO 4: generatePlan mit simuliertem 429-Fehler (Rate Limit) → needsClarification: true
Mocking: Provider wirft new Error('429 Too Many Requests')
test: r.needsClarification === true

SZENARIO 5: generatePlan mit gültigem Ziel + echtem API-Key → gibt valides Ergebnis zurück
Nur ausführen wenn OPENROUTER_API_KEY gesetzt ist (skip mit test.skip() wenn nicht).
test: result hat entweder plan.steps Array ODER needsClarification === true

REGELN:
- require.cache Pfade korrekt berechnen via path.resolve(__dirname, '../backend/services/...')
- Nach jedem Test: require.cache wiederherstellen + env vars zurücksetzen
- OPENROUTER_API_KEY Mocking: require.cache[providerPath] = { exports: { chat: async () => { throw new Error(...) } } }
- Vollständige Datei, sofort ausführbar mit: node --test tests/ghost.plan.timeout.test.js`
  },

  // ── 3. Build-File-Headers Script Logik ────────────────────────────────────
  {
    filename: 'build.file.headers.test.js',
    task: `Schreibe eine Node.js Test-Datei für die Kernlogik von scripts/build-file-headers.js.
Verwende Node.js native test runner (require('node:test') + require('node:assert')).
Kein Jest, kein Mocha. Kein API-Call nötig — nur Pure-Function-Tests.

WICHTIG: Das Script ist NICHT als Modul exportiert — teste die Logik als inline pure functions
die du im Test selbst definierst (exakt wie in build-file-headers.js implementiert).

FUNKTIONEN ZUM TESTEN (aus build-file-headers.js extrahieren und inline definieren):

1. hasFileHeader(content) → boolean
   Logik: content.includes('@file')

2. shouldSkipFile(filename) → boolean
   Logik: filename.endsWith('.min.js')

3. stripMarkdownFences(text) → string
   Logik: text.replace(/^\`\`\`(?:javascript|js)?\\s*/i, '').replace(/\\s*\`\`\`$/i, '').trim()

4. isValidHeaderResponse(text, originalContent) → boolean
   Logik: text.includes('@file') && text.length >= originalContent.length * 0.5

GENAU DIESE SZENARIEN als Tests:

SZENARIO 1: hasFileHeader — Datei MIT Header → true
content = '/**\\n * @file test.js\\n */\\n\\'use strict\\';';
assert.strictEqual(hasFileHeader(content), true)

SZENARIO 2: hasFileHeader — Datei OHNE Header → false
content = '\\'use strict\\';\\nconst x = 1;';
assert.strictEqual(hasFileHeader(content), false)

SZENARIO 3: hasFileHeader — Header in der Mitte (sollte auch true sein)
content = 'const x = 1;\\n// @file somewhere\\nmodule.exports = {};';
assert.strictEqual(hasFileHeader(content), true)

SZENARIO 4: shouldSkipFile — .min.js → true
assert.strictEqual(shouldSkipFile('jquery.min.js'), true)

SZENARIO 5: shouldSkipFile — normale .js → false
assert.strictEqual(shouldSkipFile('server.js'), false)

SZENARIO 6: stripMarkdownFences — mit Fences → sauber
input = '\`\`\`javascript\\nconst x = 1;\\n\`\`\`';
assert.strictEqual(stripMarkdownFences(input), 'const x = 1;')

SZENARIO 7: stripMarkdownFences — ohne Fences → unverändert
input = 'const x = 1;';
assert.strictEqual(stripMarkdownFences(input), 'const x = 1;')

SZENARIO 8: isValidHeaderResponse — zu kurze Antwort → false
original = 'A'.repeat(1000); response = 'A'.repeat(400);
assert.strictEqual(isValidHeaderResponse(response, original), false)

SZENARIO 9: isValidHeaderResponse — ohne @file → false
original = 'A'.repeat(100); response = 'A'.repeat(200);
assert.strictEqual(isValidHeaderResponse(response, original), false)

SZENARIO 10: isValidHeaderResponse — gültig → true
original = 'A'.repeat(100); response = '/**\\n * @file test.js\\n */\\n' + 'A'.repeat(100);
assert.strictEqual(isValidHeaderResponse(response, original), true)

REGELN:
- Alle Funktionen inline im Test definieren (kein require des Scripts)
- Kein fs, kein child_process, kein API-Call
- Vollständige Datei, sofort ausführbar mit: node --test tests/build.file.headers.test.js`
  }
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  v1.5.0 Test Builder — Qwen 2.5 72B + DeepSeek Review       ║');
  console.log('║  Claude = Briefing + Verifikation · Qwen = Code             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('  ✗ OPENROUTER_API_KEY fehlt'); process.exit(1);
  }

  const results = [];

  for (const briefing of TEST_BRIEFINGS) {
    console.log(`\n→ [Qwen] Schreibe: tests/${briefing.filename}`);

    const buildResult = await build(briefing.task, { language: 'javascript', maxTokens: 3000 });

    if (!buildResult.success) {
      console.log(`  ✗ Qwen Build-Fehler: ${buildResult.error}`);
      results.push({ filename: briefing.filename, ok: false, error: buildResult.error });
      continue;
    }

    // Code-Block extrahieren
    const match = buildResult.output.match(/```(?:javascript|js)?\s*([\s\S]+?)```/);
    const code  = match ? match[1].trim() : buildResult.output.trim();

    // DeepSeek Review
    console.log(`  → [DeepSeek] Review: tests/${briefing.filename}`);
    const reviewResult = await review(code, `Test-Datei für KI-OS ${briefing.filename}`);

    if (reviewResult.success && reviewResult.review) {
      const r = reviewResult.review;
      const scoreStr = r.score ? `score:${r.score}` : '';
      const status   = r.approved ? `✓ approved ${scoreStr}` : `⚠ nicht approved ${scoreStr} — ${(r.issues||[]).join('; ')}`;
      console.log(`  DeepSeek: ${status}`);
    }

    const outPath = path.join(TESTS_DIR, briefing.filename);
    fs.writeFileSync(outPath, code, 'utf8');
    console.log(`  ✓ Geschrieben: tests/${briefing.filename} (${code.length} Zeichen)`);
    results.push({ filename: briefing.filename, ok: true });
  }

  console.log('\n─────────────────────────────────────────────────');
  console.log('Ergebnis:');
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'}  ${r.filename}${r.error ? ' — ' + r.error : ''}`);
  }
  console.log('\nNächster Schritt (Claude verifiziert):');
  console.log('  node --test tests/ghost.vision.test.js');
  console.log('  node --test tests/ghost.plan.timeout.test.js');
  console.log('  node --test tests/build.file.headers.test.js\n');
}

main().catch(err => { console.error('Fehler:', err.message); process.exit(1); });

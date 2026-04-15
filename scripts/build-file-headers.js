/**
 * @file    build-file-headers.js
 * @desc    File Header Sweep — delegiert an Gemini 2.5 Flash Lite.
 *          Fügt Standard-Header (@file @desc @author @coauthor @license) in alle
 *          .js-Dateien ohne Header ein. Verarbeitet in Batches à 5 Dateien.
 *          Dryrun-Modus mit --dry: zeigt was geändert würde, schreibt nichts.
 * @usage   node scripts/build-file-headers.js [--dry] [--batch N]
 * @author  Koordiniert von Kimba (Head of Engineering)
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

require('dotenv').config();

const fs        = require('fs');
const path      = require('path');
const { execSync } = require('child_process');
const OpenRouter = require('../backend/services/providers/openrouter.provider');

// ─── Config ───────────────────────────────────────────────────────────────────

const ROOT        = path.resolve(__dirname, '..');
const BUILDER     = process.env.HEADER_BUILDER_MODEL  || 'google/gemini-2.5-flash-lite';
const DRY_RUN     = process.argv.includes('--dry');
const BATCH_ARG   = process.argv.indexOf('--batch');
const BATCH_SIZE  = BATCH_ARG !== -1 ? Number(process.argv[BATCH_ARG + 1]) || 5 : 5;
const TIMEOUT_MS  = 30000;

const SCAN_DIRS   = ['backend', 'core', 'scripts', 'runtime'];
const SKIP_DIRS   = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', '.turbo']);

// ─── Farben ───────────────────────────────────────────────────────────────────

const C = process.stdout.isTTY ? {
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
  red: '\x1b[31m', gray: '\x1b[90m', bold: '\x1b[1m', reset: '\x1b[0m'
} : { green:'', yellow:'', cyan:'', red:'', gray:'', bold:'', reset:'' };

const ok   = (m) => console.log(`  ${C.green}✓${C.reset}  ${m}`);
const info = (m) => console.log(`  ${C.gray}·${C.reset}  ${m}`);
const warn = (m) => console.log(`  ${C.yellow}⚠${C.reset}  ${m}`);
const fail = (m) => console.log(`  ${C.red}✗${C.reset}  ${m}`);

// ─── Datei-Sammlung ───────────────────────────────────────────────────────────

function collectFiles() {
  const results = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      if (e.name.endsWith('.min.js')) continue;
      const content = fs.readFileSync(full, 'utf8');
      if (!content.includes('@file')) results.push({ file: full, content });
    }
  }
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d));
  return results;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Du bist ein Code-Agent für KI-OS (Node.js CommonJS).
Deine Aufgabe: Füge einen Standard-Header-Block am Anfang jeder JS-Datei ein.

HEADER-FORMAT (exakt so, keine Variationen):
/**
 * @file    <dateiname.js>
 * @desc    <1-2 präzise Sätze was die Datei macht — kein BlaBla, kein "handles", "manages">
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

REGELN:
- @desc muss spezifisch sein: Nenne das KONKRETE was die Datei tut (z.B. "Express Routes für Ghost Control Endpoints — POST /ghost/plan, POST /ghost/verify")
- Kein "handles", "manages", "provides" als erstes Wort — direkt beschreiben
- Existing 'use strict'; bleibt erhalten und kommt NACH dem Header
- Falls bereits ein Kommentar am Anfang steht (der kein @file Header ist): ERSETZEN
- Antwort: NUR die komplette Datei mit eingefügtem Header, kein Markdown, keine Erklärungen`;

function buildPrompt(relPath, content) {
  const filename = path.basename(relPath);
  const first80  = content.slice(0, 800);
  return `Datei: ${relPath}
Dateiname: ${filename}

Erste 800 Zeichen des aktuellen Inhalts:
\`\`\`javascript
${first80}${content.length > 800 ? '\n// ... (gekürzt)' : ''}
\`\`\`

Vollständiger aktueller Inhalt:
\`\`\`javascript
${content}
\`\`\`

Füge den @file-Header ein und gib die KOMPLETTE Datei zurück.`;
}

// ─── LLM Call ─────────────────────────────────────────────────────────────────

async function addHeaderViaLLM(relPath, content) {
  const prompt  = buildPrompt(relPath, content);
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)
  );
  const call = OpenRouter.chat({
    model:       BUILDER,
    messages:    [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens:  4000
  });

  const res  = await Promise.race([call, timeout]);
  let text = res.text || res.reply || '';

  // Strip Markdown code fences if present
  text = text.replace(/^```(?:javascript|js)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return text;
}

// ─── Batched Processor ────────────────────────────────────────────────────────

async function processBatch(batch) {
  const results = await Promise.allSettled(
    batch.map(async ({ file, content }) => {
      const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
      try {
        const updated = await addHeaderViaLLM(relPath, content);
        if (!updated || updated.length < content.length * 0.5) {
          throw new Error('Response too short — likely truncated');
        }
        if (!updated.includes('@file')) {
          throw new Error('Response missing @file header');
        }
        return { file, relPath, updated, ok: true };
      } catch (err) {
        return { file, relPath, error: err.message, ok: false };
      }
    })
  );
  return results.map(r => r.value || r.reason);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   KI-OS File Header Sweep — Gemini Flash Lite    ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════╝${C.reset}`);
  if (DRY_RUN) console.log(`  ${C.yellow}DRY RUN — keine Dateien werden geändert${C.reset}`);
  console.log('');

  if (!process.env.OPENROUTER_API_KEY) {
    fail('OPENROUTER_API_KEY nicht gesetzt'); process.exit(1);
  }

  info('Sammle Dateien ohne @file Header...');
  const files = collectFiles();
  info(`${files.length} Dateien gefunden — Batch-Größe: ${BATCH_SIZE}`);
  console.log('');

  let done = 0, errors = 0;
  const batches = [];
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    batches.push(files.slice(i, i + BATCH_SIZE));
  }

  const logFile = path.join(ROOT, 'docs', `HEADER_SWEEP_${new Date().toISOString().slice(0,10)}.md`);
  const logLines = [`# File Header Sweep — ${new Date().toISOString().slice(0,10)}\n\n| Datei | Status |\n|---|---|\n`];

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`${C.bold}Batch ${b+1}/${batches.length}${C.reset} (${batch.map(f => path.basename(f.file)).join(', ')})`);

    const results = await processBatch(batch);

    for (const r of results) {
      if (r.ok) {
        if (!DRY_RUN) {
          fs.writeFileSync(r.file, r.updated, 'utf8');
        }
        ok(r.relPath);
        logLines.push(`| \`${r.relPath}\` | ✅ Header eingefügt |\n`);
        done++;
      } else {
        warn(`${r.relPath} — ${r.error}`);
        logLines.push(`| \`${r.relPath}\` | ⚠️ ${r.error} |\n`);
        errors++;
      }
    }

    // Rate-limit Pause zwischen Batches (außer letzter)
    if (b < batches.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Log schreiben
  if (!DRY_RUN) {
    fs.writeFileSync(logFile, logLines.join(''), 'utf8');
    info(`Log: docs/${path.basename(logFile)}`);
  }

  console.log('');
  console.log(`${C.bold}╔══════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${errors === 0 ? C.green : C.yellow}║  Ergebnis: ${done} OK · ${errors} Fehler${' '.repeat(Math.max(0, 36 - String(done).length - String(errors).length))}║${C.reset}`);
  console.log(`${C.bold}╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log('');

  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => { fail(err.message); process.exit(1); });

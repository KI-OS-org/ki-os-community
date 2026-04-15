/**
 * @file    github-safe-push.js
 * @desc    KI-OS Security Gate — Default DENY. Nur explizit whitelisted Dateien dürfen auf GitHub.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// WHITELIST — Default DENY: Alles ist verboten, außer explizit gelistet
// ─────────────────────────────────────────────────────────────────────────────

/** Erlaubte Dateierweiterungen */
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.ts', '.tsx', '.mjs', '.json', '.md', '.sh', '.bat', '.ps1',
  '.css', '.scss', '.svg', '.png', '.jpg', '.gif', '.mp4', '.ico',
  '.yaml', '.yml', '.txt', '.html', '.cmd', '.toml', '.swift', '.mts', '.lock',
]);

/** Sonderfälle ohne Erweiterung oder mit Punkt-Erweiterung */
const ALLOWED_EXTENSION_EXCEPTIONS = [
  /^\.env\.example$/,
  /^\.env\.local\.example$/,
  /^\.gitignore$/,
];

/** Erlaubte Pfad-Präfixe (Verzeichnisse) */
const ALLOWED_PATH_PREFIXES = [
  'backend/',
  'core/',
  'frontend/',
  'runtime/local/',
  'tests/',
  'scripts/',
  'Web/',
  'docs/',
];

/** Explizit erlaubte Root-Dateien (keine Unterverzeichnisse) */
const ALLOWED_ROOT_FILES = new Set([
  'LICENSE',
  'LICENSE.md',
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'START.md',
  'STARTUP_GUIDE.md',
  'LAUNCH_GUIDE.md',
  'package.json',
  'package-lock.json',
  'index.js',
  'build-community.js',
  'build-enterprise.js',
  'start-community.js',
  'start-community.sh',
  'setup.bat',
  'setup.sh',
  'create-macos-app.sh',
  'start-docker.sh',
  'start-docker.bat',
  '.dockerignore',
  'Dockerfile',
  'docker-compose.yml',
  'ki-os.sh',
  'KI-OS.bat',
  'KI-OS-Start.ps1',
  'START-community.bat',
  '.env.example',
  '.gitignore',
  'CONNECTORS.md',
  'CODE_OF_CONDUCT.md',
  'LICENSE-AGPL',
  'LICENSE-APACHE',
  'KI-OS.ico',
  'LINUX-MAC-START.md',
  'BUILD-EXE.md',
  'EXE-ANLEITUNG.md',
  'LAUNCH_DAY_CHECKLIST.md',
  'start.js',
]);

/** Whitelisted Scripts — nur diese aus scripts/ erlaubt */
const ALLOWED_SCRIPTS = new Set([
  'scripts/doctor.js',
  'scripts/doctor.frontend.js',
  'scripts/install-local.sh',
  'scripts/install-local.cmd',
  'scripts/setup-env.js',
  'scripts/build-release.sh',
  'scripts/build-release.bat',
  'scripts/build-release.ps1',
  'scripts/build-ghost-intent.js',
  'scripts/build-ghost-structured.js',
  'scripts/build-file-headers.js',
  'scripts/build-frontend-tests.js',
  'scripts/build-ghost-user-simulations.js',
  'scripts/build-v150-tests.js',
  'scripts/swarm-memory-seed.js',
  'scripts/setup-security-hook.ps1',
  'scripts/show-logo.ps1',
  'scripts/github-safe-push.js',  // sich selbst darf man pushen
  'scripts/discord-bot.js',
  'scripts/discord-setup-guide.md',
  'scripts/create-shortcuts.ps1',
  // Moved from root → scripts/
  'scripts/KI-OS-Start.ps1',
  'scripts/KI-OS.bat',
  'scripts/START-community.bat',
  'scripts/create-exe.vbs',
  'scripts/create-icon.ps1',
  'scripts/create-macos-app.sh',
  'scripts/ki-os-setup.iss',
  'scripts/ki-os.sh',
  'scripts/launcher.js',
  'scripts/package.exe.json',
  'scripts/start-community.js',
  'scripts/start-community.sh',
  'scripts/start-docker.bat',
  'scripts/start-docker.sh',
  // Community tools
  'scripts/build-setup-scripts.js',
  'scripts/check-community-leaks.js',
  'scripts/security-guard.js',
]);

// ─────────────────────────────────────────────────────────────────────────────
// HARD-BLOCKED — Diese Pfade/Muster sind IMMER verboten, egal ob in Whitelist
// ─────────────────────────────────────────────────────────────────────────────

/** Geblockte Pfad-Präfixe und Muster */
const HARD_BLOCKED_PATTERNS = [
  // Interne/sensitive Verzeichnisse
  /^\.claude\//,
  /\/\.claude\//,
  /^\.gitleaks/,
  /^infrastructure\//,
  /^runtime\/aws\//,
  /^backend\/services\/dag\//,
  /^backend\/services\/federation\//,
  /^backend\/services\/heygen\//,
  /^backend\/services\/retail-brain\//,
  /^tauri\//,

  // Sensitive Dateitypen
  /\.pem$/i,
  /\.key$/i,
  /\.pid$/i,
  /\.tsbuildinfo$/i,

  // Gefährliche Dateinamen
  /^sync\.bat$/i,
  /\/sync\.bat$/i,
  /^Secrets\.bat$/i,
  /\/Secrets\.bat$/i,

  // Session-Dateien (KI-interne Logs)
  /SESSION_.*\.md$/i,
  /_SESSION_.*\.md$/i,
  /GITHUB_SESSION_.*\.md$/i,
];

/** Secret-Patterns im Datei-INHALT */
const SECRET_CONTENT_PATTERNS = [
  { pattern: /sk-ant-[a-zA-Z0-9\-]{20,}/,              name: 'Anthropic API Key' },
  { pattern: /sk-or-[a-zA-Z0-9\-]{20,}/,               name: 'OpenRouter API Key' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/,                    name: 'OpenAI API Key' },
  { pattern: /AKIA[A-Z0-9]{16}/,                       name: 'AWS Access Key' },
  { pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, name: 'Private Key' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/,                name: 'Google API Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/,                   name: 'GitHub Personal Access Token' },
  { pattern: /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/, name: 'Slack Bot Token' },
  { pattern: /password\s*=\s*["'][^"']{6,}["']/i,     name: 'Hardcoded Password' },
  { pattern: /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9\-_]{16,}["']/i, name: 'Hardcoded API Key' },
];

/** Dateierweiterungen für Content-Scan */
const SCAN_EXTENSIONS = new Set([
  '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx',
  '.json', '.sh', '.bat', '.ps1', '.cmd',
  '.yaml', '.yml', '.toml',
]);

/** Verzeichnisse komplett überspringen */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'coverage',
  '.turbo', '.swarm-memory', '_archive', 'test-results',
]);

// ─────────────────────────────────────────────────────────────────────────────
// WHITELIST-LOGIK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prüft ob eine Datei auf der Whitelist steht.
 * Default DENY: gibt false zurück wenn kein expliziter Match.
 */
function isWhitelisted(relPath) {
  const filename  = path.basename(relPath);
  const ext       = path.extname(relPath).toLowerCase();
  const inSubdir  = relPath.includes('/');

  // Root-Dateien: exakte Matches aus ALLOWED_ROOT_FILES
  if (!inSubdir) {
    if (ALLOWED_ROOT_FILES.has(relPath)) return true;
    // Sonderfälle (z.B. .env.example, .gitignore)
    if (ALLOWED_EXTENSION_EXCEPTIONS.some(p => p.test(filename))) return true;
    return false; // Root-Datei nicht in Liste → DENY
  }

  // Scripts-Verzeichnis: nur ALLOWED_SCRIPTS
  if (relPath.startsWith('scripts/')) {
    return ALLOWED_SCRIPTS.has(relPath);
  }

  // Andere Verzeichnisse: Pfad-Präfix muss erlaubt sein
  const inAllowedDir = ALLOWED_PATH_PREFIXES.some(prefix => relPath.startsWith(prefix));
  if (!inAllowedDir) return false;

  // Erweiterung muss erlaubt sein
  if (!ext) {
    // Dateien ohne Erweiterung (z.B. LICENSE) — nur Root, oben bereits behandelt
    return false;
  }

  // Sonderfälle mit Doppel-Erweiterung (.env.example)
  if (ALLOWED_EXTENSION_EXCEPTIONS.some(p => p.test(filename))) return true;

  return ALLOWED_EXTENSIONS.has(ext);
}

// ─────────────────────────────────────────────────────────────────────────────
// FARBEN
// ─────────────────────────────────────────────────────────────────────────────

const C = process.stdout.isTTY ? {
  red:    '\x1b[31m', green:  '\x1b[32m', yellow: '\x1b[33m',
  cyan:   '\x1b[36m', bold:   '\x1b[1m',  reset:  '\x1b[0m',
  gray:   '\x1b[90m',
} : { red:'', green:'', yellow:'', cyan:'', bold:'', reset:'', gray:'' };

const ok   = (msg) => console.log(`  ${C.green}✓${C.reset}  ${msg}`);
const warn = (msg) => console.log(`  ${C.yellow}⚠${C.reset}  ${msg}`);
const fail = (msg) => console.log(`  ${C.red}✗${C.reset}  ${C.red}${msg}${C.reset}`);
const info = (msg) => console.log(`  ${C.gray}·${C.reset}  ${msg}`);

// ─────────────────────────────────────────────────────────────────────────────
// HELFER
// ─────────────────────────────────────────────────────────────────────────────

/** Alle Dateien im Repo sammeln (außer SKIP_DIRS) */
function collectFiles(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      collectFiles(full, results);
    } else {
      results.push(full);
    }
  }
  return results;
}

/** Relativer Pfad vom Root */
const rel = (f) => path.relative(ROOT, f);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

const HOOK_MODE = process.argv.includes('--hook');

let errors   = 0;
let warnings = 0;

console.log('');
console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}${C.cyan}║   KI-OS GitHub Security Gate  [Default DENY]     ║${C.reset}`);
console.log(`${C.bold}${C.cyan}║   Nur explizit whitelisted Dateien dürfen rein   ║${C.reset}`);
console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════╝${C.reset}`);
console.log('');

// ── [1/4] Git-Status + Datei-Liste ───────────────────────────────────────────
console.log(`${C.bold}[1/4] Git-Status + Datei-Liste${C.reset}`);

let stagedFiles = [];
try {
  const out = execSync('git -C "' + ROOT + '" diff --cached --diff-filter=d --name-only', { encoding: 'utf8' });
  stagedFiles = out.trim().split('\n').filter(Boolean);
  info(`${stagedFiles.length} Dateien gestaged`);
} catch {
  warn('Kein git-Staging gefunden — scanne alle Dateien');
}

// Fallback: letzter Commit (pre-push Modus)
if (stagedFiles.length === 0) {
  try {
    const out = execSync(
      'git -C "' + ROOT + '" diff --diff-filter=d --name-only HEAD~1 HEAD 2>/dev/null || git -C "' + ROOT + '" diff --diff-filter=d --name-only $(git -C "' + ROOT + '" rev-parse HEAD) 2>/dev/null || git -C "' + ROOT + '" show --diff-filter=d --name-only --format="" HEAD',
      { encoding: 'utf8' }
    );
    stagedFiles = out.trim().split('\n').filter(Boolean);
    if (stagedFiles.length > 0) info(`${stagedFiles.length} Dateien im letzten Commit (pre-push Modus)`);
  } catch { /* erster Commit oder kein HEAD */ }
}

const allFiles = collectFiles(ROOT);
info(`${allFiles.length} Dateien im Projekt gesamt`);

// Scan-Basis: gestaged wenn vorhanden, sonst alle Dateien
const targetFiles = stagedFiles.length > 0 ? stagedFiles : allFiles.map(f => rel(f));

if (stagedFiles.length > 0) {
  info(`Modus: Staged-Dateien-Check`);
} else {
  info(`Modus: Vollständiger Projekt-Scan`);
}
console.log('');

// ── [2/4] Default DENY — Nicht-whitelisted Dateien ───────────────────────────
console.log(`${C.bold}[2/4] Whitelist-Check (Default DENY)${C.reset}`);

let denyCount = 0;
for (const f of targetFiles) {
  if (!isWhitelisted(f)) {
    fail(`NICHT WHITELISTED → BLOCKIERT: ${f}`);
    errors++;
    denyCount++;
  }
}

if (denyCount === 0) ok(`Alle ${targetFiles.length} Dateien sind whitelisted`);
console.log('');

// ── [3/4] Hard-Blocked Pfade ─────────────────────────────────────────────────
console.log(`${C.bold}[3/4] Hard-Blocked Pfade & Dateinamen${C.reset}`);

let hardBlockCount = 0;
for (const f of targetFiles) {
  if (HARD_BLOCKED_PATTERNS.some(p => p.test(f))) {
    fail(`HARD BLOCKED → NIEMALS erlaubt: ${f}`);
    errors++;
    hardBlockCount++;
  }
}

if (hardBlockCount === 0) ok('Keine hard-geblockten Pfade gefunden');
console.log('');

// ── [4/4] Secret-Content-Scan ────────────────────────────────────────────────
console.log(`${C.bold}[4/4] Secret-Scan (Datei-Inhalte)${C.reset}`);

if (HOOK_MODE) {
  ok('Content-Scan durch gitleaks (Layer 1) abgedeckt — übersprungen');
  console.log('');
} else {
  // Gitignorierte Dateien batch-laden
  const ignoredSet = new Set();
  try {
    const ignored = execSync(
      `git -C "${ROOT}" ls-files --ignored --exclude-standard -o`,
      { encoding: 'utf8' }
    ).trim().split('\n').filter(Boolean);
    ignored.forEach(f => ignoredSet.add(f));
  } catch { /* kein git oder kein .gitignore */ }

  const filesToScan = stagedFiles.length > 0
    ? stagedFiles.map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f))
    : allFiles;

  let secretCount = 0;
  for (const f of filesToScan) {
    const ext = path.extname(f).toLowerCase();
    if (!SCAN_EXTENSIONS.has(ext)) continue;
    if (ignoredSet.has(rel(f))) continue;

    let content;
    try {
      content = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }

    for (const { pattern, name } of SECRET_CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        fail(`Secret gefunden [${name}] in: ${rel(f)}`);
        errors++;
        secretCount++;
        break; // Eine Meldung pro Datei
      }
    }
  }

  if (secretCount === 0) ok('Keine Secrets in Datei-Inhalten gefunden');
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// ERGEBNIS
// ─────────────────────────────────────────────────────────────────────────────

console.log(`${C.bold}╔══════════════════════════════════════════════════╗${C.reset}`);

if (errors === 0 && warnings === 0) {
  console.log(`${C.bold}${C.green}║  ✓  GRÜN — Sicher zum Pushen                     ║${C.reset}`);
  console.log(`${C.bold}${C.green}╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log('');
  console.log(`  Nächster Schritt:`);
  console.log(`  ${C.cyan}git push origin main${C.reset}`);
  console.log('');
  process.exit(0);
} else if (errors === 0 && warnings > 0) {
  console.log(`${C.bold}${C.yellow}║  ⚠  GELB — Warnungen vorhanden                   ║${C.reset}`);
  console.log(`${C.bold}${C.yellow}║  Warnungen: ${String(warnings).padEnd(37)}║${C.reset}`);
  console.log(`${C.bold}${C.yellow}╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log('');
  console.log(`  ${C.yellow}Warnungen prüfen, dann: git push origin main${C.reset}`);
  console.log('');
  process.exit(0);
} else {
  console.log(`${C.bold}${C.red}║  ✗  ROT — Push blockiert (Default DENY)          ║${C.reset}`);
  console.log(`${C.bold}${C.red}║  Fehler:    ${String(errors).padEnd(37)}║${C.reset}`);
  console.log(`${C.bold}${C.yellow}║  Warnungen: ${String(warnings).padEnd(37)}║${C.reset}`);
  console.log(`${C.bold}${C.red}╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log('');
  console.log(`  ${C.red}Nicht-whitelisted oder hard-geblockte Dateien gefunden.${C.reset}`);
  console.log(`  ${C.red}Bitte alle Fehler beheben bevor git push.${C.reset}`);
  console.log('');
  process.exit(1);
}

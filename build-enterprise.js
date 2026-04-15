#!/usr/bin/env node
/**
 * KI-OS Enterprise Edition — Build Script
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Kommerziell — https://ki-os.org/enterprise
 * =========================================================
 * Erstellt eine vollständige Enterprise-Distribution in dist/enterprise/.
 *
 * Strategie: Alle Dateien aus dem Haupt-Repo werden kopiert,
 * Enterprise-Services werden als Overlay hinzugefügt.
 * Interne Dateien (.claude/, .env mit Werten, Session-Docs) werden NICHT kopiert.
 *
 * Aufruf:
 *   node build-enterprise.js
 *   node build-enterprise.js --dry-run    # zeigt nur, was passieren würde
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT    = __dirname;
const DEST    = path.join(ROOT, 'dist', 'enterprise');

// ---------------------------------------------------------------------------
// Dateien/Verzeichnisse die NIEMALS in die Distribution kommen
// ---------------------------------------------------------------------------
const ALWAYS_EXCLUDE = new Set([
  '.claude',
  '.gitleaks.toml',
  '.git',
  'dist',
  'node_modules',
  '.next',
  'coverage',
  '.turbo',
  'out',
  // Interne Security-Scripts
  'scripts/github-safe-push.js',
  'scripts/ki-os-permissions-hook.js',
  'scripts/setup-security-hook.ps1',
  'scripts/setup-security-hook.sh',
  'ki-os-permissions.json',
  'ki-os-sync.conf',
  // Runtime State
  '.ki-os-agents.json',
  '.ki-os-approvals.json',
  '.ki-os-audit.ndjson',
  '.ki-os-circuit-breaker.json',
  '.ki-os-dag-registry.json',
  '.ki-os-dlq.json',
  '.ki-os-economic-optimizer.json',
  '.ki-os-email-queue.json',
  '.ki-os-federated-outcomes.json',
  '.ki-os-incidents.json',
  '.ki-os-instance.json',
  '.ki-os-memory.json',
  '.ki-os-mesh-runs.json',
  '.ki-os-packs.json',
  '.ki-os-routing-decisions.json',
  '.ki-os-routing-scorecards.json',
  '.ki-os-runtime-store.json',
  '.ki-os-supervisor-escalations.json',
  '.ki-os-supervisor-recoveries.json',
  '.ki-os-tenants.json',
  '.ki-os-ui-runtime.json',
  '.ki-os-users.json',
  '.ki-os-version',
  '.ki-os-ftp.env',
  'first-run.flag',
  '.swarm-memory',
  // Secrets
  '.env',
  '.env.local',
  '.blauer-elefant.pem',
  // Interne Dokumente
  'docs',
  'Dokumentation',
  'buch',
  '_archive',
  'Web',
  // Session & Build-Artefakte
  'sync.bat',
  'sync.log',
]);

// Pattern-basierte Ausschlüsse (Dateinamen)
const EXCLUDE_PATTERNS = [
  /^GITHUB_SESSION_/i,
  /^SESSION_/i,
  /_SESSION_.*\.md$/i,
  /\.pid$/,
  /\.tsbuildinfo$/,
  /\.log$/,
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
  /^Secrets\./i,
];

// Interne Scripts die nicht in die Distribution gehören
const EXCLUDED_SCRIPTS = new Set([
  'arch-council.js',
  'aws-setup-backend.sh',
  'aws-setup-frontend.sh',
  'deploy-aws.sh',
  'github-safe-push.js',
  'ki-os-permissions-hook.js',
  'setup-security-hook.ps1',
  'setup-security-hook.sh',
  'multi-agent-testplan.js',
  'qwen-build-tests.js',
  'qwen-chat.js',
  'model-benchmark.js',
  'model-compare.js',
  'test-dashscope.js',
  'test-openrouter-qwen.js',
  'setup-dashscope.js',
  'generate-blauer-elefant.js',
  'generate-gate-hashes.js',
  'reset-admin-password.js',
  'build-tests.js',
  'qa-preflight.js',
  'smoke.js',
  'full-regression.js',
  'optimize-install.bat',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function log(msg) { console.log(msg); }

function shouldExclude(relPath, name) {
  if (ALWAYS_EXCLUDE.has(relPath) || ALWAYS_EXCLUDE.has(name)) return true;
  if (EXCLUDE_PATTERNS.some(p => p.test(name))) return true;
  if (relPath.startsWith('scripts/') && EXCLUDED_SCRIPTS.has(name)) return true;
  // Interne Scripts nach Präfix
  const internalPrefixes = [
    'scripts/buch-', 'scripts/export-buch-', 'scripts/final-review-',
    'scripts/finale-', 'scripts/update-buch-', 'scripts/ueberarbeite-',
    'scripts/entferne-', 'scripts/stil-', 'scripts/full-stack-smoke-',
    'scripts/full-regression', 'scripts/release-gate-', 'scripts/api-route-proof-',
    'scripts/archive-legacy-', 'scripts/run-r30-', 'scripts/generate-blauer-',
    'scripts/generate-gate-', 'scripts/release-v',
    'scripts/updates-server/', 'scripts/status-page/',
  ];
  if (internalPrefixes.some(p => relPath.startsWith(p))) return true;
  return false;
}

function copyRecursive(src, dest, relBase = '') {
  const stat = fs.statSync(src);
  const name = path.basename(src);
  const relPath = relBase ? relBase + '/' + name : name;

  if (shouldExclude(relPath, name)) {
    log(`  SKIP  ${relPath}`);
    return;
  }

  if (stat.isDirectory()) {
    if (!DRY_RUN) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry), relPath);
    }
  } else {
    if (!DRY_RUN) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

function writeEnterpriseEnv(destDir) {
  const content = [
    '# KI-OS Enterprise Edition — automatisch generiert',
    '# Diese Datei NICHT in Git einchecken',
    '',
    'KI_OS_EDITION=enterprise',
    'NODE_ENV=production',
    'PORT=3000',
    '',
    '# LLM Provider — mindestens einen setzen',
    '# ANTHROPIC_API_KEY=',
    '# OPENAI_API_KEY=',
    '# OPENROUTER_API_KEY=',
    '',
    '# Memory',
    'MEMORY_BACKEND=file',
    '',
    '# Enterprise Features',
    '# AWS_REGION=eu-central-1',
    '# MULTI_TENANT=true',
  ].join('\n');
  if (!DRY_RUN) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, '.env'), content, 'utf8');
  }
  log('  WRITE .env (Enterprise template)');
}

function patchPackageJson(destDir) {
  const pkgSrc = path.join(ROOT, 'package.json');
  if (!fs.existsSync(pkgSrc)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgSrc, 'utf8'));
  pkg.name    = pkg.name ? `${pkg.name}-enterprise` : 'ki-os-enterprise';
  pkg.edition = 'enterprise';
  pkg.private = true;
  delete pkg.workspaces;
  const dest = path.join(destDir, 'package.json');
  if (!DRY_RUN) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(pkg, null, 2), 'utf8');
  }
  log('  PATCH package.json → edition: enterprise');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  log('');
  log('╔══════════════════════════════════════════════════════════╗');
  log('║  KI-OS Enterprise Edition Build                          ║');
  log(`║  Ziel: ${DEST.replace(ROOT, '.')}                       ║`);
  if (DRY_RUN) {
  log('║  MODE: DRY RUN — keine Dateien werden geschrieben        ║');
  }
  log('╚══════════════════════════════════════════════════════════╝');
  log('');

  // Clean destination
  if (!DRY_RUN && fs.existsSync(DEST)) {
    fs.rmSync(DEST, { recursive: true, force: true });
    log('  CLEAN dist/enterprise/');
  }

  // Copy everything from ROOT (except excluded)
  log('');
  log('▶ Kopiere Enterprise-Gesamtwerk...');
  const entries = fs.readdirSync(ROOT);
  for (const entry of entries) {
    if (shouldExclude(entry, entry)) {
      log(`  SKIP  ${entry}`);
      continue;
    }
    copyRecursive(path.join(ROOT, entry), path.join(DEST, entry), '');
  }

  // Write enterprise .env template
  log('');
  log('▶ Schreibe Enterprise-Konfiguration...');
  writeEnterpriseEnv(DEST);
  patchPackageJson(DEST);

  // Copy .env.example (reference for all keys)
  const envExample = path.join(ROOT, '.env.example');
  if (fs.existsSync(envExample) && !DRY_RUN) {
    fs.copyFileSync(envExample, path.join(DEST, '.env.example'));
  }
  log('  COPY  .env.example');

  log('');
  if (DRY_RUN) {
    log('✓ Dry-Run abgeschlossen — keine Dateien geschrieben.');
  } else {
    log(`✓ Enterprise-Build fertig: ${DEST}`);
    log('');
    log('  Starten: npm start  → http://localhost:3000');
    log('  Distribution: dist/enterprise/ zippen und verteilen.');
    log('');
  }
  log('');
}

main();

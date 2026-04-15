#!/usr/bin/env node
/**
 * KI-OS Security Guard
 * ════════════════════════════════════════════════════════════════════════════
 * Verhindert, dass interne/sensitive Daten auf GitHub landen.
 *
 * Prüft auf:
 *   1. API-Keys & Secrets (Anthropic, OpenAI, OpenRouter, AWS, Google, ...)
 *   2. Interne Zugangsdaten (FTP, Dogado, lokale Pfade)
 *   3. Verbotene Dateien (.github/, .gitignore, CLAUDE.md, *.pem, ...)
 *   4. Claude/Anthropic-Contributor-Leak (Co-Authored-By: Claude Sonnet)
 *   5. Enterprise-Code & Enterprise-Imports
 *
 * Modi:
 *   --staged   → nur staged Files prüfen (pre-commit Hook)
 *   --all      → alle tracked Files prüfen (pre-push Hook)
 *   --msg FILE → Commit-Message-Datei prüfen (commit-msg Hook)
 *
 * Exit 0 = alles OK  |  Exit 1 = BLOCKED
 *
 * Co-Authored-By: Kimba <kimba@ki-os.org>
 */

'use strict';

const { execSync }                     = require('node:child_process');
const { readFileSync, existsSync }     = require('node:fs');
const { resolve, extname, basename }   = require('node:path');

const ROOT = resolve(__dirname, '..');
const MODE = process.argv[2] || '--all';
const MSG_FILE = process.argv[3];        // nur bei --msg

// ═══════════════════════════════════════════════════════════════════════════
// 1. SECRETS — blockiert überall (auch in Docs/Stubs)
// ═══════════════════════════════════════════════════════════════════════════

const SECRETS = [
  { label: 'Anthropic API Key',    re: /sk-ant-[A-Za-z0-9\-]{20,}/ },
  { label: 'OpenAI API Key',       re: /sk-[A-Za-z0-9]{40,}/ },
  { label: 'OpenRouter API Key',   re: /sk-or-v1-[A-Za-z0-9]{32,}/ },
  { label: 'Google API Key',       re: /AIza[0-9A-Za-z\-_]{35}/ },
  { label: 'AWS Access Key',       re: /AKIA[0-9A-Z]{16}/ },
  { label: 'AWS Secret (pattern)', re: /aws[_\-]?secret[_\-]?access[_\-]?key\s*[:=]\s*[A-Za-z0-9\/+]{40}/i },
  { label: 'DashScope API Key',    re: /sk-[a-f0-9]{32,}/ },
  { label: 'Private Key Header',   re: /-----BEGIN\s+(RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'FTP Host (Dogado)',    re: /web301\.dogado\.net/ },
  { label: 'FTP Credentials',     re: /--user\s+['"]?kios:/i },
  { label: 'Internal User Path',  re: /C:\\Users\\is\\KI-OS/i },
  { label: 'Internal User Path',  re: /\/c\/Users\/is\/KI-OS/i },
  { label: 'Internal User Path',  re: /\/Users\/is\/KI-OS/i },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. VERBOTENE DATEIEN — dürfen NIEMALS ins Repo
// ═══════════════════════════════════════════════════════════════════════════

const FORBIDDEN_PATHS = [
  { label: 'GitHub-interne Dateien (.github/)',    re: /^\.github[\\/]/ },
  { label: 'Git-Ignore-Datei (.gitignore)',        re: /^\.gitignore$/ },
  { label: 'Claude-Arbeitsregeln (CLAUDE.md)',     re: /^CLAUDE\.md$/ },
  { label: 'Claude Code Config (.claude/)',        re: /^\.claude[\\/]/ },
  { label: 'FTP-Credentials (.ki-os-ftp.env)',     re: /^\.ki-os-ftp\.env$/ },
  { label: 'KI-OS Runtime State (.ki-os-*.json)', re: /^\.ki-os-.*\.(json|ndjson)$/ },
  { label: 'KI-OS Version File (.ki-os-version)', re: /^\.ki-os-version$/ },
  { label: 'Test Artifacts (.test-*.json)',        re: /^\.test-.*\.json$/ },
  { label: 'Temp AgentMesh Files (.tmp-agentmesh)',re: /^\.tmp-agentmesh-/ },
  { label: 'Zertifikat / Private Key (*.pem)',     re: /\.pem$/ },
  { label: 'Private Key Datei (*.key)',            re: /\.key$/ },
  { label: 'PKCS12 Zertifikat (*.pfx)',            re: /\.pfx$/ },
  { label: 'Enterprise lokal Pfad',               re: /enterprise[\\/]/i },
  { label: 'Env-Local Datei (*.env.local)',        re: /\.env\.local$/ },
  { label: 'Env-Datei mit Secrets (.env)',         re: /^\.env$/ },
  { label: 'Buch-Ordner (unveröffentlicht)',       re: /^buch[\\/]/i },
  { label: 'Archiv-Ordner (_archive/)',            re: /^_archive[\\/]/ },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. ENTERPRISE-CODE — in Non-Stub Codedateien verboten
// ═══════════════════════════════════════════════════════════════════════════

const ENTERPRISE_CODE = [
  { label: 'Enterprise-Klasse (RetailBrain)',         re: /class\s+RetailBrain\b/ },
  { label: 'Enterprise-Klasse (PackMarketplace)',     re: /class\s+PackMarketplace\b/ },
  { label: 'Enterprise-Klasse (FederatedOutcomeNet)', re: /class\s+FederatedOutcomeNetwork\b/ },
  { label: 'Enterprise-Instanz',                     re: /new\s+(RetailBrain|PackMarketplace|FederatedOutcomeNetwork)\s*\(/ },
  { label: 'Enterprise-Import (require)',             re: /require\(['"]\.\.[./]*enterprise\/(?!stub)/ },
  { label: 'Enterprise-Import (ES module)',           re: /from\s+['"]\.[./]*\/enterprise\/(?!stub)/ },
  { label: 'Enterprise-Connector (Agentforce)',       re: /agentforce\.connect/i },
  { label: 'Enterprise-Connector (SAP Joule)',        re: /sapJoule\.invoke/i },
  { label: 'Enterprise-Feature (HeyGen)',             re: /heygen\.(create|avatar|session)/i },
  { label: 'Enterprise-Feature (PKI)',                re: /pki\.(sign|verify|issue)/i },
  { label: 'Multi-Tenant (tenant_id direkt)',         re: /tenant_id\s*[:=]\s*['"][^'"]{5,}['"]/ },
  { label: 'Federation (FederatedOutcome direkt)',    re: /FederatedOutcome\s*{/ },
  { label: 'DAG-Engine (Enterprise)',                 re: /require\(['"]\.\.[./]*dag\/engine/ },
  { label: 'AWS Deployment (Enterprise)',             re: /require\(['"]\.\.[./]*aws\// },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. CO-AUTHOR LEAK — Claude Sonnet darf nicht als Co-Author erscheinen
// ═══════════════════════════════════════════════════════════════════════════

const COAUTHOR_LEAKS = [
  { label: 'Claude Sonnet als Co-Author',  re: /Co-Authored-By:.*Claude Sonnet/i },
  { label: 'Anthropic noreply als Co-Author', re: /Co-Authored-By:.*noreply@anthropic\.com/i },
];

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.gz', '.7z', '.tar',
  '.pdf', '.lock', '.exe', '.bin',
]);

const CODE_EXT = new Set(['.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx']);

function isStub(content) {
  return content.includes('_communityOnly') || content.includes('enterpriseOnly');
}

function isDoc(relPath) {
  const ext = extname(relPath).toLowerCase();
  const name = basename(relPath);
  return ['.md', '.txt', '.rst'].includes(ext) ||
         ['LICENSE', 'LICENSE-AGPL', 'LICENSE-APACHE'].includes(name);
}

function shouldSkip(relPath) {
  const ext = extname(relPath).toLowerCase();
  if (SKIP_EXT.has(ext)) return true;
  const n = relPath.replace(/\\/g, '/');
  return /node_modules/.test(n) ||
         /\.git\//.test(n) ||
         /[/\\]\.next[/\\]/.test(n) ||
         /[/\\]dist[/\\]/.test(n) ||
         /security-guard\.js$/.test(n) ||    // nicht sich selbst prüfen
         /check-community-leaks\.js$/.test(n);
}

function getFiles(mode) {
  try {
    if (mode === '--staged') {
      return execSync('git diff --cached --name-only --diff-filter=ACM', { cwd: ROOT, encoding: 'utf8' })
        .trim().split('\n').filter(Boolean);
    } else {
      const staged  = execSync('git diff --cached --name-only --diff-filter=ACM', { cwd: ROOT, encoding: 'utf8' }).trim();
      const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).trim();
      return [...new Set([...staged.split('\n'), ...tracked.split('\n')])].filter(Boolean);
    }
  } catch {
    return [];
  }
}

function fail(label, file, line, code) {
  console.error(`  ✗ [${label}]`);
  if (file) console.error(`    Datei : ${file}`);
  if (line != null) console.error(`    Zeile : ${line}`);
  if (code) console.error(`    Code  : ${String(code).trim().slice(0, 120)}`);
  console.error('');
}

// ═══════════════════════════════════════════════════════════════════════════
// MODUS: --msg  →  Commit-Message prüfen
// ═══════════════════════════════════════════════════════════════════════════

function checkCommitMessage() {
  if (!MSG_FILE || !existsSync(MSG_FILE)) {
    console.log('⚠️  Security-Guard: Keine Commit-Message-Datei gefunden — übersprungen.');
    process.exit(0);
  }

  const msg = readFileSync(MSG_FILE, 'utf8');
  let blocked = false;

  for (const { label, re } of COAUTHOR_LEAKS) {
    if (re.test(msg)) {
      console.error('');
      console.error('🔴 KI-OS Security Guard — COMMIT GEBLOCKT');
      console.error('══════════════════════════════════════════════');
      fail(label, MSG_FILE, null, null);
      console.error('   Lösung: Co-Authored-By muss lauten:');
      console.error('   Co-Authored-By: Kimba <kimba@ki-os.org>');
      blocked = true;
    }
  }

  if (blocked) {
    console.error('══════════════════════════════════════════════');
    process.exit(1);
  }

  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════
// HAUPT-SCAN  →  --staged oder --all
// ═══════════════════════════════════════════════════════════════════════════

function scan() {
  const files = getFiles(MODE);
  let leaks = 0;
  const header = MODE === '--staged'
    ? '🔍 KI-OS Security Guard — Prüfe staged Dateien...'
    : '🔍 KI-OS Security Guard — Prüfe alle tracked Dateien...';

  console.log(header);
  console.log('');

  // ── 2. Verbotene Dateipfade ──────────────────────────────────────────────
  for (const relPath of files) {
    const norm = relPath.replace(/\\/g, '/');
    for (const { label, re } of FORBIDDEN_PATHS) {
      if (re.test(norm) || re.test(basename(norm))) {
        fail(`VERBOTENE DATEI: ${label}`, relPath, null, null);
        leaks++;
      }
    }
  }

  // ── 1 + 3 + 4. Dateiinhalt scannen ──────────────────────────────────────
  for (const relPath of files) {
    if (shouldSkip(relPath)) continue;

    const absPath = resolve(ROOT, relPath);
    if (!existsSync(absPath)) continue;

    let content;
    try { content = readFileSync(absPath, 'utf8'); } catch { continue; }

    const stub  = isStub(content);
    const doc   = isDoc(relPath);
    const code  = CODE_EXT.has(extname(relPath).toLowerCase());
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];

      // Secrets — immer prüfen
      for (const { label, re } of SECRETS) {
        if (re.test(ln)) {
          fail(`SECRET: ${label}`, relPath, i + 1, ln);
          leaks++;
        }
      }

      // Co-Author Leaks — immer prüfen
      for (const { label, re } of COAUTHOR_LEAKS) {
        if (re.test(ln)) {
          fail(`CO-AUTHOR LEAK: ${label}`, relPath, i + 1, ln);
          leaks++;
        }
      }

      // Enterprise-Code — nur in Non-Stub-Codedateien
      if (!stub && !doc && code) {
        for (const { label, re } of ENTERPRISE_CODE) {
          if (re.test(ln)) {
            fail(`ENTERPRISE LEAK: ${label}`, relPath, i + 1, ln);
            leaks++;
          }
        }
      }
    }
  }

  // ── Ergebnis ─────────────────────────────────────────────────────────────
  if (leaks > 0) {
    console.error('══════════════════════════════════════════════════════════');
    console.error(`🔴 SECURITY GUARD — ${leaks} PROBLEM(E) GEFUNDEN — PUSH GEBLOCKT`);
    console.error('══════════════════════════════════════════════════════════');
    console.error('');
    console.error('   Regeln:');
    console.error('   • Keine API-Keys oder Credentials committen');
    console.error('   • Keine .github/, .gitignore, CLAUDE.md, *.pem ins Repo');
    console.error('   • Keine Enterprise-Features im Community-Code');
    console.error('   • Co-Author immer: Kimba <kimba@ki-os.org>');
    console.error('');
    process.exit(1);
  }

  console.log(`✅ Security Guard: Alles sauber — ${files.length} Dateien geprüft.`);
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Entry Point
// ═══════════════════════════════════════════════════════════════════════════

if (MODE === '--msg') {
  checkCommitMessage();
} else {
  scan();
}

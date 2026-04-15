#!/usr/bin/env node
/**
 * KI-OS Community Edition — Enterprise Leak Detector
 * Scans all tracked files for enterprise-only patterns.
 * Exit 0 = clean, Exit 1 = leak found.
 *
 * Rules:
 *  - Files containing _communityOnly or enterpriseOnly() are community stubs → skip feature checks
 *  - Docs (.md) and LICENSE are exempt from feature/path checks → only secrets are checked
 *  - API keys, AWS keys, local enterprise paths are blocked everywhere
 */

'use strict';

const { execSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, extname, basename } = require('node:path');

const ROOT = resolve(__dirname, '..');

// ─── Patterns: blocked EVERYWHERE (even in stubs and docs) ───────────────────

const SECRETS = [
  { pattern: /sk-ant-[A-Za-z0-9\-]{20,}/,    label: 'Anthropic API key' },
  { pattern: /sk-[A-Za-z0-9]{40,}/,           label: 'OpenAI API key' },
  { pattern: /AKIA[0-9A-Z]{16}/,              label: 'AWS Access Key' },
  { pattern: /C:\\Users\\is\\KI-OS\\enterprise/i, label: 'Enterprise local path' },
];

// ─── Patterns: blocked in NON-stub code files only ───────────────────────────
// (stubs are exempt because they exist specifically to name enterprise features)

const ENTERPRISE_CODE = [
  { pattern: /class\s+(RetailBrain|PackMarketplace|FederatedOutcomeNetwork)\b/, label: 'Enterprise class implementation' },
  { pattern: /new\s+(RetailBrain|PackMarketplace|FederatedOutcomeNetwork)\s*\(/, label: 'Enterprise class instantiation' },
  { pattern: /require\(['"]\.\.[./]*enterprise\/(?!stub)/,                       label: 'Enterprise module require()' },
  { pattern: /from\s+['"]\.[./]*\/enterprise\/(?!stub)/,                         label: 'Enterprise ES import' },
  { pattern: /agentforce\.connect|sapJoule\.invoke/i,                           label: 'Enterprise connector call' },
];

// ─── Files / dirs to skip entirely ───────────────────────────────────────────

const SKIP_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz', '.pdf', '.lock']);
const SKIP_PATHS = [
  /node_modules/,
  /\.git[/\\]/,
  /[/\\]dist[/\\]/,
  /\.next[/\\]/,
  /\.turbo[/\\]/,
  /check-community-leaks\.js$/,  // skip self
];

// Docs/License: only check for secrets, not enterprise naming
const DOC_EXTENSIONS = new Set(['.md', '.txt', '.rst']);
const DOC_FILES = new Set(['LICENSE', 'LICENSE-AGPL', 'LICENSE-APACHE']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isStubFile(content) {
  return content.includes('_communityOnly') || content.includes('enterpriseOnly');
}

function isDocFile(relPath) {
  const name = basename(relPath);
  return DOC_EXTENSIONS.has(extname(relPath).toLowerCase()) || DOC_FILES.has(name);
}

function getTrackedFiles() {
  try {
    const staged  = execSync('git diff --cached --name-only --diff-filter=ACM', { cwd: ROOT, encoding: 'utf8' }).trim();
    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).trim();
    const all = new Set([...staged.split('\n'), ...tracked.split('\n')].filter(Boolean));
    return [...all];
  } catch {
    return [];
  }
}

function shouldSkip(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return true;
  const normalized = filePath.replace(/\\/g, '/');
  return SKIP_PATHS.some(re => re.test(normalized));
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

const files = getTrackedFiles();
let foundLeaks = false;

for (const relPath of files) {
  if (shouldSkip(relPath)) continue;

  const absPath = resolve(ROOT, relPath);
  if (!existsSync(absPath)) continue;

  let content;
  try {
    content = readFileSync(absPath, 'utf8');
  } catch {
    continue;
  }

  const isStub = isStubFile(content);
  const isDoc  = isDocFile(relPath);
  const lines  = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Always check for real secrets
    for (const { pattern, label } of SECRETS) {
      if (pattern.test(line)) {
        console.error(`  LEAK [${label}]`);
        console.error(`    File : ${relPath}`);
        console.error(`    Line : ${i + 1}`);
        console.error(`    Code : ${line.trim().slice(0, 120)}`);
        console.error('');
        foundLeaks = true;
      }
    }

    // Enterprise code patterns: skip stubs and docs
    if (!isStub && !isDoc) {
      for (const { pattern, label } of ENTERPRISE_CODE) {
        if (pattern.test(line)) {
          console.error(`  LEAK [${label}]`);
          console.error(`    File : ${relPath}`);
          console.error(`    Line : ${i + 1}`);
          console.error(`    Code : ${line.trim().slice(0, 120)}`);
          console.error('');
          foundLeaks = true;
        }
      }
    }
  }
}

if (foundLeaks) {
  process.exit(1);
} else {
  console.log('  No enterprise leaks found.');
  process.exit(0);
}

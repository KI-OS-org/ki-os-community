/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc German Shepherd — Statische Security-Analyse für KI-OS Codebase

'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['node_modules', '.git', '.tmp', 'dist', 'build', 'coverage', 'DEMO', '__tests__', 'tests', '.claude', 'PC', 'Archiv', 'output', 'screenshots']);
const SKIP_FILES = new Set(['security-scanner.service.js', 'swarm-memory-seed.js']); // selbst-scan + seed-daten false-positive
const SKIP_FILE_PATTERNS = ['.test.', '.spec.', '-test.', '-spec.']; // Test-Dateien ausschließen
const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.tsx']);

const RULES = [
  { id: 'S001', severity: 'HIGH',   name: 'shell-injection',
    pattern: /execSync?\s*\(\s*`[^`]*\$\{(?:req|body|params|query)/,
    desc: 'User-Input direkt in Shell-Befehl — Command Injection Risiko' },
  { id: 'S002', severity: 'HIGH',   name: 'sql-injection',
    pattern: /(?:query|run|all|get)\s*\(\s*[`'"][^`'"]*\$\{(?:req|body|params)/,
    desc: 'User-Input in SQL-Query — SQL Injection Risiko' },
  { id: 'S003', severity: 'HIGH',   name: 'hardcoded-secret',
    pattern: /(?:secret|password|api_?key|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i,
    desc: 'Mögliches hardcoded Secret im Code' },
  { id: 'S004', severity: 'HIGH',   name: 'eval-usage',
    pattern: /\beval\s*\(/,
    desc: 'eval() ist gefährlich — Code-Injection möglich' },
  { id: 'S005', severity: 'HIGH',   name: 'path-traversal',
    pattern: /(?:readFile|readFileSync|createReadStream)\s*\([^)]*(?:req\.|body\.|params\.|query\.)/,
    desc: 'User-Input in Dateipfad — Path Traversal möglich' },
  { id: 'S006', severity: 'MEDIUM', name: 'cors-wildcard',
    pattern: /origin\s*:\s*['"]?\*['"]?/,
    desc: 'CORS Wildcard (*) erlaubt alle Origins' },
  { id: 'S007', severity: 'MEDIUM', name: 'jwt-no-expiry',
    // Erkennt jwt.sign mit genau 2 Argumenten (kein options-Objekt, kein TTL-String)
    pattern: /\b(?:jwt|JWT)\.sign\s*\(\s*(?:\{[^}]*\}|[^,]+)\s*,\s*[^,)]+\s*\)\s*[;,]/,
    desc: 'JWT ohne expiresIn — Token läuft nie ab' },
  { id: 'S008', severity: 'MEDIUM', name: 'missing-rate-limit',
    // Nur echte Auth-Routes ohne sichtbaren Limiter auf derselben Zeile
    pattern: /router\.(post|put|delete)\s*\(\s*['"][^'"]*(?:login|reset)[^'"]*['"],\s*(?!.*[Ll]imiter)async/i,
    desc: 'Auth-Route ohne sichtbares Rate-Limiting' },
  { id: 'S009', severity: 'LOW',    name: 'http-external',
    pattern: /['"]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/,
    desc: 'HTTP (nicht HTTPS) für externe URL' },
  { id: 'S010', severity: 'LOW',    name: 'console-log-secret',
    pattern: /console\.(?:log|info|warn|error)\s*\([^)]*(?:password|secret|token|key)[^)]*\)/i,
    desc: 'Mögliches Secret in console.log' },
  { id: 'S011', severity: 'HIGH',   name: 'license-bypass',
    pattern: /(?:licen[sc]e(?:Valid|Check|Active|Status)|isActivated|checkLicense|license-bypass-pattern)\s*(?:=|:)\s*(?:true|null|\(\)\s*=>\s*(?:true|\{[^}]*valid\s*:\s*true))/i,
    desc: 'Möglicher Lizenz-Bypass — Edition Guard Lizenzprüfung umgangen' },
  { id: 'S012', severity: 'HIGH',   name: 'license-override',
    pattern: /require\(['"'][^'"]*licen[sc]e[^'"]*['"]\)(?:\.\w+)?\s*=\s*|Object\.defineProperty\([^)]*licen[sc]e/i,
    desc: 'Monkey-Patch einer Lizenz-Funktion erkannt' },
];

function scanFile(filePath) {
  const findings = [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          const match = line.match(rule.pattern);
          const matchText = match ? match[0] : line;
          findings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            file: filePath,
            line: i + 1,
            match: matchText.length > 80 ? matchText.substring(0, 77) + '...' : matchText,
            description: rule.desc,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning file ${filePath}: ${error.message}`);
    return [];
  }
  return findings;
}

function scanDirectory(dirPath, opts = {}) {
  const allFindings = [];
  const maxFindings = opts.maxFindings || 500;

  function walk(currentPath) {
    if (allFindings.length >= maxFindings) {
      return;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (allFindings.length >= maxFindings) {
        break;
      }

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const isTestFile = SKIP_FILE_PATTERNS.some(p => entry.name.includes(p));
        if (SCAN_EXTENSIONS.has(ext) && !SKIP_FILES.has(entry.name) && !isTestFile) {
          const fileFindings = scanFile(fullPath);
          allFindings.push(...fileFindings);
          if (allFindings.length >= maxFindings) {
            break;
          }
        }
      }
    }
  }

  walk(dirPath);
  return allFindings.slice(0, maxFindings);
}

function groupBySeverity(findings) {
  const grouped = {
    HIGH: [],
    MEDIUM: [],
    LOW: [],
  };

  for (const finding of findings) {
    if (grouped[finding.severity]) {
      grouped[finding.severity].push(finding);
    }
  }
  return grouped;
}

module.exports = {
  RULES,
  scanFile,
  scanDirectory,
  groupBySeverity,
};

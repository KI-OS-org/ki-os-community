/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc German Shepherd für Claws — Statistische Sicherheitsanalyse für Claw Skills

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const securityScanner = require('../security/security-scanner.service.js');
const { parseClawDirectory } = require('./claw.parser.js');

const SKIP_DIRS = new Set(['node_modules', '.git', '.tmp', 'dist', 'build', 'coverage', 'DEMO', '__tests__', 'tests', '.claude', 'PC', 'Archiv', 'output', 'screenshots']);
const SKIP_FILES = new Set(['security-scanner.service.js', 'swarm-memory-seed.js']); // selbst-scan + seed-daten false-positive
const SKIP_FILE_PATTERNS = ['.test.', '.spec.', '-test.', '-spec.']; // Test-Dateien ausschließen
const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.tsx', '.py', '.sh', '.cjs', '.jsx']);

const CLAWHAVOC_SIGNATURES = [
  {
    id: 'CH001',
    severity: 'CRITICAL',
    name: 'env-exfiltration',
    pattern: /(?:fetch|axios|http|https|XMLHttpRequest)\s*\(.*process\.env/i,
    desc: 'Mögliche Exfiltration von Umgebungsvariablen an externe URL'
  },
  {
    id: 'CH002',
    severity: 'CRITICAL',
    name: 'reverse-shell',
    pattern: /child_process.*(?:nc |ncat |\/bin\/sh|\/bin\/bash).*-e/i,
    desc: 'Mögliche Reverse-Shell-Initialisierung'
  },
  {
    id: 'CH003',
    severity: 'CRITICAL',
    name: 'obfuscated-code',
    pattern: /eval\s*\(\s*(?:atob|Buffer\.from)\s*\(/i,
    desc: 'Obfuskierte Code-Exekution mit eval und Base64'
  },
  {
    id: 'CH004',
    severity: 'CRITICAL',
    name: 'crypto-miner',
    pattern: /stratum\+tcp:\/\/|pool\.miningpoolhub\.com|us\.pool\.miningpoolhub\.com|eu\.pool\.miningpoolhub\.com/i,
    desc: 'Mögliche Crypto-Mining-Pool-Adresse'
  },
  {
    id: 'CH005',
    severity: 'HIGH',
    name: 'persistence-mechanism',
    pattern: /(~\/\.(?:bashrc|zshrc)|crontab|LaunchAgents|\.plist)/i,
    desc: 'Mögliche Persistenzmechanismen (z.B. ~/.bashrc, crontab)'
  },
  {
    id: 'CH006',
    severity: 'CRITICAL',
    name: 'credential-theft',
    pattern: /(?:\.ssh\/id_rsa|\.aws\/credentials|\.npmrc|\/Library\/Application Support\/Google\/Chrome\/Default\/Cookies)/i,
    desc: 'Mögliche Zugriffe auf sensible Credentials'
  },
  {
    id: 'CH007',
    severity: 'HIGH',
    name: 'self-replication',
    pattern: /(?:copyFile|writeFileSync|cp|rsync).*node_modules|\.\/skills/i,
    desc: 'Mögliche Selbst-Replikation in andere Skill-Verzeichnisse'
  },
  {
    id: 'CH008',
    severity: 'MEDIUM',
    name: 'silent-dns-exfil',
    pattern: /(?:dns\.resolve|dig|nslookup)[^\n]{0,200}?\.[^\n]{0,200}?\./i,
    desc: 'Stille Netzwerk-Exfiltration über DNS'
  }
];

const PERMISSION_RISK = {
  'filesystem:read': 'medium',
  'filesystem:write': 'high',
  'network:fetch': 'high',
  'shell:exec': 'critical',
  'env:read': 'medium',
  'credentials:access': 'critical'
};

const AMPEL = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red'
};

function scanClaw(clawDirPath) {
  let skill;
  try {
    skill = parseClawDirectory(clawDirPath);
  } catch (error) {
    return {
      ampel: AMPEL.RED,
      reason: 'Manifest fehlt oder ist ungültig',
      error: error.message,
      findings: [],
      clawHavocMatches: [],
      permissionRisk: null
    };
  }

  // Generische Findings via German Shepherd
  const findings = securityScanner.scanDirectory(clawDirPath);

  // Claw-Havoc Signaturen scannen
  const clawHavocMatches = [];
  
  // Symlink-Zyklen-Schutz
  const visitedRealPaths = new Set();

  // Berechne resolvedBase einmalig zu Beginn mit fs.realpathSync für korrekte Escape-Erkennung
  let resolvedBase;
  try {
    resolvedBase = fs.realpathSync(clawDirPath);
  } catch (err) {
    // Falls fs.realpathSync fehlschlägt (z.B. clawDirPath existiert nicht), 
    // verwenden wir den bereits vorhandenen manifest-error-Pfad
    return {
      ampel: AMPEL.RED,
      reason: 'Manifest fehlt oder ist ungültig',
      error: err.message,
      findings: [],
      clawHavocMatches: [],
      permissionRisk: null
    };
  }

  function walk(currentPath) {
    const resolvedCurrentPath = fs.realpathSync(currentPath);
    
    // Prüfe auf Zyklus
    if (visitedRealPaths.has(resolvedCurrentPath)) {
      clawHavocMatches.push({
        ruleId: 'CH-CYCLE',
        ruleName: 'symlink-cycle',
        severity: 'MEDIUM',
        file: currentPath,
        line: 0,
        match: resolvedCurrentPath,
        description: 'Symlink-Zyklus erkannt — Verzeichnis wurde bereits besucht'
      });
      return;
    }

    // Markiere als besucht
    visitedRealPaths.add(resolvedCurrentPath);

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          const resolvedTarget = fs.realpathSync(fullPath);
          // Verwende die einmalig berechnete resolvedBase für den Escape-Vergleich
          if (!(resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + path.sep))) {
            // Symlink zeigt außerhalb des Claw-Verzeichnisses
            clawHavocMatches.push({
              ruleId: 'CH-SYM',
              ruleName: 'symlink-escape',
              severity: 'HIGH',
              file: fullPath,
              line: 0,
              match: resolvedTarget,
              description: 'Symlink zeigt aus dem Claw-Verzeichnis heraus — nicht gescannt'
            });
          } else {
            // Symlink zeigt innerhalb — behandele wie normale Datei/Verzeichnis
            if (fs.statSync(resolvedTarget).isDirectory()) {
              walk(resolvedTarget);
            } else {
              // Behandle wie normale Datei
              scanFile(fullPath, resolvedTarget);
            }
          }
        } catch (err) {
          // Fehler beim Auflösen des Symlinks — ignorieren, da wir nur statische Analyse durchführen
        }
      } else if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const isTestFile = SKIP_FILE_PATTERNS.some(p => entry.name.includes(p));

        if (SCAN_EXTENSIONS.has(ext) && !SKIP_FILES.has(entry.name) && !isTestFile) {
          scanFile(fullPath, fullPath);
        } else if (ext === '' && !SKIP_FILES.has(entry.name) && !isTestFile) {
          // Datei ohne Extension, prüfe auf Shebang
          try {
            const fd = fs.openSync(fullPath, 'r');
            const buffer = Buffer.alloc(1024);
            const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
            fs.closeSync(fd);
            const firstLine = buffer.subarray(0, bytesRead).toString('utf8').split('\n')[0];
            if (firstLine.startsWith('#!')) {
              scanFile(fullPath, fullPath);
            }
          } catch (err) {
            // Ignorieren, da wir nur statische Analyse durchführen
          }
        }
      }
    }
  }

  function scanFile(fullPath, realPath) {
    try {
      const content = fs.readFileSync(realPath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Begrenze Länge für Regex-Tests
        if (line.length > 2000) {
          clawHavocMatches.push({
            ruleId: 'CH-LONG',
            ruleName: 'suspicious-long-line',
            severity: 'MEDIUM',
            file: fullPath,
            line: i + 1,
            match: line.substring(0, 80) + '...',
            description: 'Verdächtig lange Zeile (>2000 Zeichen) — möglicherweise verschleierter Code, nicht im Detail gescannt'
          });
          continue;
        }
        for (const sig of CLAWHAVOC_SIGNATURES) {
          if (sig.pattern.test(line)) {
            const match = line.match(sig.pattern);
            const matchText = match ? match[0] : line;
            clawHavocMatches.push({
              ruleId: sig.id,
              ruleName: sig.name,
              severity: sig.severity,
              file: fullPath,
              line: i + 1,
              match: matchText.length > 80 ? matchText.substring(0, 77) + '...' : matchText,
              description: sig.desc
            });
          }
        }
      }
    } catch (error) {
      // Ignorieren, da wir nur statische Analyse durchführen
    }
  }

  // Initialer Aufruf mit aufgelöstem Pfad
  walk(clawDirPath);

  // Permission-Risiko berechnen
  let highestPermissionRisk = 'low';
  for (const perm of skill.permissions) {
    let risk = PERMISSION_RISK[perm];
    if (!risk) {
      // Prüfe Heuristik für kritische Permission-Namen
      if (perm.toLowerCase().includes('exec') || 
          perm.toLowerCase().includes('shell') || 
          perm.toLowerCase().includes('credential') || 
          perm.toLowerCase().includes('secret')) {
        risk = 'critical';
      } else {
        risk = 'high'; // Default für unbekannte Permissions
      }
    }
    if (risk === 'critical') {
      highestPermissionRisk = 'critical';
      break;
    } else if (risk === 'high' && highestPermissionRisk !== 'critical') {
      highestPermissionRisk = 'high';
    } else if (risk === 'medium' && highestPermissionRisk === 'low') {
      highestPermissionRisk = 'medium';
    }
  }

  // Ampel-Logik
  const hasClawHavocMatch = clawHavocMatches.length > 0;
  const hasHighFinding = findings.some(f => f.severity === 'HIGH');
  const hasMediumFinding = findings.some(f => f.severity === 'MEDIUM');
  const hasCriticalPermission = highestPermissionRisk === 'critical';
  const hasHighPermission = highestPermissionRisk === 'high';

  let ampel = AMPEL.GREEN;
  let reason = 'Keine Sicherheitsbedenken';

  if (hasClawHavocMatch || hasHighFinding || hasCriticalPermission) {
    ampel = AMPEL.RED;
    reason = 'Kritische Sicherheitsrisiken identifiziert';
  } else if (hasMediumFinding || hasHighPermission || hasCriticalPermission) {
    ampel = AMPEL.YELLOW;
    reason = 'Mittleres Sicherheitsrisiko';
  }

  return {
    ampel,
    reason,
    skill,
    findings,
    clawHavocMatches,
    permissionRisk: highestPermissionRisk
  };
}

module.exports = {
  scanClaw,
  CLAWHAVOC_SIGNATURES,
  PERMISSION_RISK,
  AMPEL
};

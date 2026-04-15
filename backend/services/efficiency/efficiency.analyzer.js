/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * KI-OS — Efficiency Agent Analyzer
 * Analysiert den internen Zustand von KI-OS:
 * - Aktuelle Features aus Docs
 * - Veraltete Dependencies
 * - Offene technische Schulden
 */
'use strict';

const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');

const ROOT = process.cwd();

/**
 * Liest die aktuelle KI-OS Version
 */
function readVersion() {
  try {
    const vfile = path.join(ROOT, '.ki-os-version');
    if (fs.existsSync(vfile)) return fs.readFileSync(vfile, 'utf8').trim();
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return pkg.version || '?';
  } catch { return 'unknown'; }
}

/**
 * Liest package.json Dependencies + prüft auf outdated (npm outdated --json)
 */
function analyzeDependencies() {
  let outdated = {};
  try {
    const raw = execSync('npm outdated --json 2>/dev/null', {
      cwd: ROOT, timeout: 30000, encoding: 'utf8',
    });
    outdated = JSON.parse(raw || '{}');
  } catch (e) {
    // npm outdated gibt exit-code 1 wenn es Updates gibt — Output trotzdem vorhanden
    if (e.stdout) {
      try { outdated = JSON.parse(e.stdout); } catch { /* ignore */ }
    }
  }

  const packages = Object.entries(outdated).map(([name, info]) => ({
    name,
    current:  info.current  || '?',
    wanted:   info.wanted   || '?',
    latest:   info.latest   || '?',
    type:     info.type     || 'dependencies',
    severity: semverDistance(info.current, info.latest),
  }));

  return {
    totalOutdated: packages.length,
    critical: packages.filter(p => p.severity === 'major'),
    minor:    packages.filter(p => p.severity === 'minor'),
    patch:    packages.filter(p => p.severity === 'patch'),
    packages,
  };
}

function semverDistance(current, latest) {
  if (!current || !latest || current === latest) return 'up-to-date';
  try {
    const [cM] = current.replace(/[^0-9.]/g, '').split('.');
    const [lM] = latest.replace(/[^0-9.]/g, '').split('.');
    if (parseInt(lM) > parseInt(cM)) return 'major';
    const [, cMin] = current.replace(/[^0-9.]/g, '').split('.');
    const [, lMin] = latest.replace(/[^0-9.]/g, '').split('.');
    if (parseInt(lMin) > parseInt(cMin)) return 'minor';
    return 'patch';
  } catch { return 'unknown'; }
}

/**
 * Sammelt vorhandene KI-OS-Features aus Docs und Scripts
 */
function analyzeCurrentFeatures() {
  const features = [];
  const docsDir  = path.join(ROOT, 'docs');

  try {
    if (fs.existsSync(docsDir)) {
      const docs = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
      for (const doc of docs) {
        const content = fs.readFileSync(path.join(docsDir, doc), 'utf8');
        const firstLine = content.split('\n').find(l => l.startsWith('# '));
        if (firstLine) features.push(firstLine.replace('# ', '').trim());
      }
    }
  } catch { /* ignore */ }

  // Bekannte Service-Kategorien aus dem Codebase
  const servicesDir = path.join(ROOT, 'backend', 'services');
  const knownServices = [];
  try {
    if (fs.existsSync(servicesDir)) {
      fs.readdirSync(servicesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .forEach(d => knownServices.push(d.name));
    }
  } catch { /* ignore */ }

  return { docFeatures: features, services: knownServices };
}

/**
 * Liest die .env.example um zu sehen welche Integrationen konfiguriert sind
 */
function analyzeIntegrations() {
  const integrations = { configured: [], missing: [] };
  try {
    const envPath = path.join(ROOT, '.env.example');
    if (!fs.existsSync(envPath)) return integrations;

    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');

    // Prüfe ob Key in .env gesetzt ist (kein leerer Wert)
    const envActual = {};
    try {
      const envFile = path.join(ROOT, '.env');
      if (fs.existsSync(envFile)) {
        fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
          const [k, ...v] = line.split('=');
          if (k && v.join('=').trim()) envActual[k.trim()] = true;
        });
      }
    } catch { /* ignore */ }

    lines.forEach(line => {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (!match) return;
      const [, key, val] = match;
      if (envActual[key]) integrations.configured.push(key);
      else if (!val || val.trim() === '' || val.trim() === '""') integrations.missing.push(key);
    });
  } catch { /* ignore */ }

  return integrations;
}

/**
 * Hauptfunktion: Vollanalyse
 */
async function analyzeKiOs() {
  const version      = readVersion();
  const deps         = analyzeDependencies();
  const features     = analyzeCurrentFeatures();
  const integrations = analyzeIntegrations();

  return {
    version,
    dependencies: deps,
    features,
    integrations,
    analyzedAt: new Date().toISOString(),
  };
}

module.exports = { analyzeKiOs };

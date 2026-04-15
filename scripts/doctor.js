/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: doctor.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const envPath = path.join(root, '.env');

function parseEnv(content) {
  const out = {};
  for (const line of String(content || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

function checkModule(name) {
  try {
    require.resolve(name, { paths: [root] });
    return true;
  } catch {
    return false;
  }
}

const env = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
const wantsAws = process.argv.includes('--aws');
const providers = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY'];
const missingProviders = providers.filter(k => !(env[k] || process.env[k]));
const hasProvider = missingProviders.length < providers.length;
const major = Number(process.versions.node.split('.')[0]);
const issues = [];

if (major !== 20) issues.push(`Node ${process.versions.node} erkannt. Ziel ist Node 20.x.`);
if (!fs.existsSync(envPath)) issues.push('.env fehlt. Führe npm run setup:env aus.');
if (!hasProvider) issues.push('Kein Provider-Key gesetzt. /v1/chat benötigt mindestens einen Key.');
if (missingProviders.length) issues.push(`Multi-Provider unvollständig. Fehlend: ${missingProviders.join(', ')}`);
for (const dep of ['express', 'pdfkit', 'xlsx', 'pptxgenjs']) {
  if (!checkModule(dep)) issues.push(`Abhängigkeit fehlt oder ist nicht auflösbar: ${dep}`);
}

if (wantsAws) {
  const awsRequired = ['AWS_REGION', 'KIMBA_MEMORY_TABLE', 'KIMBA_JOBS_TABLE'];
  for (const key of awsRequired) {
    if (!env[key] && !process.env[key]) issues.push(`AWS-Variable fehlt für Lambda-Readiness: ${key}`);
  }
}

if (issues.length) {
  console.log('KI-OS Doctor: WARN');
  for (const issue of issues) console.log(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('KI-OS Doctor: OK');
  console.log(`- Node: ${process.versions.node}`);
  console.log(`- Provider-Key vorhanden: ja`);
  console.log(`- Multi-Provider vollständig: ${missingProviders.length ? 'nein' : 'ja'}`);
  console.log('- Kern-Abhängigkeiten auflösbar');
  console.log(`- AWS-Check: ${wantsAws ? 'aktiv' : 'nicht angefordert'}`);
}

/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: setup-env.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const root = process.cwd();
const envExamplePath = path.join(root, '.env.example');
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

function serializeEnv(map) {
  return Object.entries(map).map(([k, v]) => `${k}=${v ?? ''}`).join('\n') + '\n';
}

function askFactory(rl) {
  return (q) => new Promise(resolve => rl.question(q, answer => resolve(answer.trim())));
}

(async () => {
  const base = fs.existsSync(envExamplePath) ? parseEnv(fs.readFileSync(envExamplePath, 'utf8')) : {};
  const current = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
  const env = { ...base, ...current };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = askFactory(rl);

  console.log('KI-OS Pre6.5 ENV Setup');
  console.log('Leere Eingabe = bestehenden Wert beibehalten.');

  for (const [key, fallback] of [
    ['NODE_ENV', 'development'],
    ['PORT', '3000'],
    ['MEMORY_DRIVER', env.MEMORY_DRIVER || 'file'],
    ['PKI_ENABLED', env.PKI_ENABLED || 'false'],
    ['VERIFIER_FAIL_OPEN', env.VERIFIER_FAIL_OPEN || 'false']
  ]) {
    const answer = await ask(`${key} [${env[key] || fallback}]: `);
    if (answer) env[key] = answer;
    else if (!env[key]) env[key] = fallback;
  }

  console.log('\nKI-OS Multi-Provider Pflichtblock: bitte alle fünf Provider-Keys setzen.');
  for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY']) {
    const masked = env[key] ? `${env[key].slice(0, 6)}...` : '(leer)';
    const answer = await ask(`${key} [${masked}]: `);
    if (answer) env[key] = answer;
  }

  fs.writeFileSync(envPath, serializeEnv(env), 'utf8');
  rl.close();

  const hasProvider = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY'].some(k => env[k]);
  console.log(`\n.env gespeichert: ${envPath}`);
  const missingProviders = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY'].filter(k => !env[k]);
  if (!hasProvider) {
    console.warn('Warnung: Noch kein Provider-Key gesetzt. /v1/chat wird ohne Key fehlschlagen.');
    process.exitCode = 2;
  } else if (missingProviders.length) {
    console.warn(`Hinweis: Multi-Provider noch unvollständig. Fehlend: ${missingProviders.join(', ')}`);
    process.exitCode = 2;
  }
})();

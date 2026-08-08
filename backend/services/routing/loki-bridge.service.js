/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 * @file backend/services/routing/loki-bridge.service.js
 * @description Loki Bridge — KIMBA-interner Router für lokale Inferenz
 *   loki-fast  (Gemma4-31B-4bit, Port 8098, ~15 tok/s)  → Chat, Standard-Tier (aktualisiert 2026-07-03,
 *              ersetzt Qwen3-4B/8091 — Loki Fast wurde aus loki-proxy.js entfernt, siehe CURRENT_STATE)
 *   loki-pro   (Gemma4-31B-4bit, Port 8098, ~15 tok/s)  → identisch zu loki-fast (aktualisiert 2026-07-03,
 *              ersetzt Qwen3.6-27B/8090 — Loki Pro wurde aus loki-proxy.js entfernt; für "tief" siehe loki-ultra)
 *   loki-mini      (Gemma4-12B, Port 11434 Ollama)    → Ingos Mac Mini
 *   loki-mini-fast (Qwen3-4B,  Port 8096)           → Ingos Mac Mini Fast
 *   skapti         (Gemma3-12B, Port 8092, Spec.Dec.) → TheSch Mac Mini Pro
 *   skapti-fast    (Gemma3-2B,  Port 8093)           → TheSch Mac Mini Fast
 *   loki-ultra (Qwen3.5-122B-A10B-4bit, Port 8093, ~55 tok/s) → Tiefe Analyse, Reasoning
 *   loki-code  (Qwen3-Coder-30B, Port 8095, ~68 tok/s) → DSGVO-konformer lokaler Coder
 *   KIMBA      (Claude Sonnet 4.6 via OpenRouter)    → Eskalation bei Unsicherheit
 *
 *   Memory Manager: Pro (15GB) und Ultra (60GB) teilen sich den RAM-Pool.
 *   Nur eines kann gleichzeitig laufen. Der Manager schaltet automatisch um.
 */
'use strict';

const http  = require('http');
const https = require('https');
const { exec, execSync } = require('child_process');

// ── Endpoints ────────────────────────────────────────────────────────────────

const HOME = process.env.HOME || require('os').homedir();

const ENDPOINTS = {
  // 2026-07-03: loki-fast/loki-pro auf Gemma4 (Port 8098) umgebogen — die alten Ziele
  // (Qwen3-4B/8091, Qwen3.6-27B/8090) wurden aus loki-proxy.js entfernt (siehe CURRENT_STATE
  // 2026-07-02: "Loki Pro und Loki Fast komplett aus MODEL_PORTS/MODEL_PATHS entfernt").
  // Für den "tiefen"/Ultra-Tier weiterhin loki-ultra (122B) nutzen, nicht loki-pro.
  'loki-fast': {
    host: '127.0.0.1', port: 8098, timeout: 60_000,
    modelId: `${HOME}/.cache/mlx-models/hub/models--mlx-community--gemma-4-31b-it-4bit/snapshots/0d17175ead577037577f24963de2f0f5fafb72a5`,
  },
  'loki-pro': {
    host: '127.0.0.1', port: 8098, timeout: 120_000,
    modelId: `${HOME}/.cache/mlx-models/hub/models--mlx-community--gemma-4-31b-it-4bit/snapshots/0d17175ead577037577f24963de2f0f5fafb72a5`,
  },
  'loki-mini': {
    host: '192.168.178.102', port: 11434, timeout: 90_000, ollama: true, model: 'gemma4:12b',
  },
  'loki-mini-fast': {
    host: '192.168.178.102', port: 8096, timeout: 30_000,
  },
  'skapti': {
    host: '192.168.178.74',  port: 8092, timeout: 90_000, spec_decoding: true,
  },
  'skapti-fast': {
    host: '192.168.178.74',  port: 8093, timeout: 30_000,
  },
  'loki-ultra': {
    host: '127.0.0.1', port: 8093, timeout: 300_000,
    modelId: `${HOME}/.cache/mlx-models/Qwen3.5-122B-A10B-4bit`,
  },
  'loki-code': {
    host: '127.0.0.1', port: 8095, timeout: 120_000,
    modelId: `${HOME}/.cache/mlx-models/Qwen3-Coder-30B-A3B-4bit`,
  },
};

const CLOUD_ROUTES = {
  gemini: { primary:'google/gemini-2.5-flash',    backup:'deepseek/deepseek-chat',       label:'🌐 Gemini 1M' },
  grok:   { primary:'x-ai/grok-4.3',              backup:'anthropic/claude-sonnet-4-6',  label:'💡 Grok 4' },
  code:   { primary:'mistralai/codestral-2508',   backup:'mistralai/devstral-2512',      label:'⚡ Codestral' },
  review: { primary:'deepseek/deepseek-r1-0528',  backup:'google/gemini-2.5-flash',      label:'🔍 DeepSeek R1' },
  search: { primary:'perplexity/sonar-pro',       backup:'google/gemini-2.5-flash',      label:'🔎 Perplexity' },
};

const MODEL_FAILURES = {};
const COOLDOWN_MS = 60_000;
function recordFailure(modelId) { MODEL_FAILURES[modelId] = Date.now(); }
function isCoolingDown(modelId) { return (Date.now() - (MODEL_FAILURES[modelId]||0)) < COOLDOWN_MS; }

// ── Memory Manager ────────────────────────────────────────────────────────────
// Pro (15GB) und Ultra (60GB) können nicht gleichzeitig laufen.
// Der Manager schaltet automatisch um — je nach Frage-Tier.

const SCRIPTS = `${HOME}/KI-OS/scripts`;

const memoryManager = {
  active: null,   // 'pro' | 'ultra' | null — aktuell geladenes schweres Modell
  locked: false,  // switch läuft gerade
  waiters: [],    // Promises die auf Switch warten

  // Erkennt beim Start was bereits läuft
  async detectInitial() {
    const proOnline   = await isNodeOnline('loki-pro').catch(() => false);
    const ultraOnline = await isNodeOnline('loki-ultra').catch(() => false);
    if (ultraOnline) this.active = 'ultra';
    else if (proOnline) this.active = 'pro';
    else this.active = null;
  },

  // Wartet bis Port antwortet (max timeoutMs)
  async waitForPort(host, port, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const ok = await httpGet(host, port, '/v1/models', 3000);
        if (ok >= 200 && ok < 300) return true;
      } catch { /* noch nicht bereit */ }
      await new Promise(r => setTimeout(r, 3000));
    }
    return false;
  },

  async ensureModel(model) {
    if (this.active === model) return true;

    // Warten wenn gerade umgeschaltet wird
    if (this.locked) {
      await new Promise(r => this.waiters.push(r));
      return this.active === model;
    }

    this.locked = true;
    console.log(`[MemoryManager] Wechsel: ${this.active || 'none'} → ${model}`);

    try {
      // Altes schweres Modell stoppen
      if (this.active === 'ultra') {
        try { execSync(`${SCRIPTS}/loki-ultra-server.sh stop`, { timeout: 10_000 }); } catch {}
        // Kurz warten bis Port frei
        await new Promise(r => setTimeout(r, 2000));
      } else if (this.active === 'pro') {
        // 2026-07-03: loki-server.sh (Qwen3.6-27B/8090) wurde aus dem aktiven Loki-Stack
        // entfernt (siehe CURRENT_STATE) — "pro" läuft jetzt über loki-gemma4-server.sh (8098).
        try { execSync(`${SCRIPTS}/loki-gemma4-server.sh stop`, { timeout: 10_000 }); } catch {}
        await new Promise(r => setTimeout(r, 2000));
      }

      // Neues Modell starten
      if (model === 'ultra') {
        exec(`${SCRIPTS}/loki-ultra-server.sh`);
        console.log('[MemoryManager] Ultra-Server gestartet — warte auf Ready (max 3min)...');
        const ready = await this.waitForPort('127.0.0.1', 8093, 180_000);
        if (ready) { this.active = 'ultra'; return true; }
        console.warn('[MemoryManager] Ultra-Server Timeout — bleibe bei Pro');
        exec(`${SCRIPTS}/loki-gemma4-server.sh`);
        await this.waitForPort('127.0.0.1', 8098, 60_000);
        this.active = 'pro';
        return false;
      } else {
        exec(`${SCRIPTS}/loki-gemma4-server.sh`);
        console.log('[MemoryManager] Pro-Server (Gemma4) gestartet — warte auf Ready (max 60s)...');
        const ready = await this.waitForPort('127.0.0.1', 8098, 60_000);
        if (ready) { this.active = 'pro'; return true; }
        this.active = null;
        return false;
      }
    } catch (e) {
      console.error('[MemoryManager] Fehler beim Switch:', e.message);
      this.active = null;
      return false;
    } finally {
      this.locked = false;
      this.waiters.forEach(r => r());
      this.waiters = [];
    }
  },
};

// ── System-Prompts ────────────────────────────────────────────────────────────

// Instanzspezifische, generierte Wissensdatenbank (data/ ist gitignored) — existiert nur auf
// Ingos eigenen Maschinen, nicht in einer generischen Distribution. Fallback statt Absturz.
let LOKI_KNOWLEDGE = '';
let LOKI_TOOLS = [];
let executeTool = async () => ({ error: 'loki_tools_not_available' });
try {
  ({ LOKI_KNOWLEDGE } = require('../../../data/loki-knowledge-base'));
  ({ LOKI_TOOLS, executeTool } = require('../../../data/loki-tools'));
} catch {}

const PROMPTS = {
  fast: `Du bist Loki, der KI-OS Assistent. Antworte direkt, präzise und hilfreich auf Deutsch. Gib konkrete Empfehlungen — keine allgemeinen Aussagen.\n${LOKI_KNOWLEDGE}`,
  deep: `Du bist Loki Deep — KI-OS Architekt (Qwen3.6-27B-4bit, kios-v2 LoRA). Antworte präzise auf Deutsch. Kein Code schreiben — delegiere an OpenRouter.\n${LOKI_KNOWLEDGE}`,
  ultra: `Du bist Loki Ultra — der leistungsstärkste lokale KI-Assistent von KI-OS (Qwen3.5-122B, 4-bit, Port 8093, ~28 tok/s).

Deine Stärken: tiefe Analyse, Reasoning über mehrere Schritte, komplexe technische und strategische Fragen, lange strukturierte Antworten.

Verhaltensprinzipien:
- Antworte immer auf Deutsch, strukturiert und vollständig
- Denke Schritt für Schritt — zeige deine Überlegung wenn sie hilft
- Bei komplexen Fragen: erst analysieren, dann antworten
- Gib konkrete, umsetzbare Empfehlungen statt vager Aussagen
- Bei Unsicherheit: klar benennen was sicher und was unsicher ist
- Code-Anfragen: kurze Beispiele sind ok, komplexe Implementierungen an OpenRouter delegieren

${LOKI_KNOWLEDGE}`,
};

// ── Routing-Klassifikation ────────────────────────────────────────────────────

const SEARCH_KEYWORDS = ['aktuell','heute','news','suche','recherche','websuche','google','internet'];
const CODE_KEYWORDS   = ['code','implementiere','funktion','bug','refactor','typescript','python','javascript'];
const REVIEW_KEYWORDS = ['review','prüfe','teste','qualität','sicherheit','audit'];
const GROK_KEYWORDS   = ['strategie','business','markt','wettbewerb','pitch','investor','umsatz'];
const GEMINI_KEYWORDS = ['dokument','pdf','zusammenfassung','lese','seiten','buch','jahresbericht'];
const DEEP_KEYWORDS = [
  'ki-os', 'kimba', 'loki', 'sprint', 'architektur', 'kernel', 'adapter', 'kios',
  'openrouter', 'delegation', 'swarm', 'memory', 'training', 'lora',
  'sicherheitsgate', 'pki', 'mcp', 'node-registry', 'versioning', 'deployment',
  'hardware', 'empfehle', 'empfehlung', 'empfehlen', 'vram', 'gpu', 'grafikkarte',
  'ram', 'upgrade', 'aufrüsten', 'erkläre', 'erklär', 'vergleiche', 'unterschied',
  'analyse', 'warum', 'wie funktioniert', 'benchmark', 'performanz', 'optimiere',
  'modell', 'parameter', 'quantisierung', 'context', 'kontext', 'token',
  'strategie', 'konzept', 'plan', 'design', 'architektur', 'infrastruktur',
];

const ULTRA_KEYWORDS = [
  'erkläre detailliert', 'erkläre genau', 'tiefe analyse', 'analysiere gründlich',
  'philosophisch', 'beweise', 'beweisen', 'widerlege', 'ethik', 'ethisch',
  'komplexe frage', 'schwierige frage', 'kompliziert', 'nuanciert',
  'vor- und nachteile', 'abwägung', 'dilemma', 'langfristig', 'zukunft der ki',
  'agi', 'superintelligenz', 'bewusstsein', 'sentience',
];

const VISION_KEYWORDS = [
  'bild', 'foto', 'image', 'screenshot', 'schau dir an', 'schau auf',
  'was siehst du', 'analysiere das bild', 'was ist auf dem bild', 'zeig mir',
  'pixel', 'grafik', 'abbildung',
];

function classify(prompt, dsgvo = false) {
  const p = (prompt || '').toLowerCase();
  if (SEARCH_KEYWORDS.some(kw => p.includes(kw))) return dsgvo ? 'fast' : 'search';
  if (REVIEW_KEYWORDS.some(kw => p.includes(kw))) return dsgvo ? 'deep' : 'review';
  if (CODE_KEYWORDS.some(kw => p.includes(kw))) return 'code-local';
  if (GROK_KEYWORDS.some(kw => p.includes(kw))) return dsgvo ? 'deep' : 'grok';
  if (GEMINI_KEYWORDS.some(kw => p.includes(kw))) return dsgvo ? 'deep' : 'gemini';
  // Ultra nur bei komplexen langen Fragen (>200Z) — kurze Fragen mit Ultra-Keyword → deep
  // verhindert Over-Thinking (150s+) bei kurzen Formaten wie "erkläre detailliert X" (3 Wörter)
  if (ULTRA_KEYWORDS.some(kw => p.includes(kw))) return p.length > 200 ? 'ultra' : 'deep';
  if (DEEP_KEYWORDS.some(kw => p.includes(kw))) return 'deep';
  if (VISION_KEYWORDS.some(kw => p.includes(kw))) return 'vision';
  return 'fast';
}

// ── HTTP Helper ───────────────────────────────────────────────────────────────

function httpPost(host, port, path, body, timeout) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: host, port, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout,
      },
      (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error(`JSON: ${data.slice(0, 120)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(payload);
    req.end();
  });
}

function httpGet(host, port, path, timeout) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: host, port, path, method: 'GET', timeout: timeout || 2500 },
      (res) => { resolve(res.statusCode); }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ── Verfügbarkeit ─────────────────────────────────────────────────────────────

async function isNodeOnline(nodeId) {
  const ep = ENDPOINTS[nodeId];
  if (!ep) return false;
  try {
    const code = await httpGet(ep.host, ep.port, ep.ollama ? '/api/tags' : '/v1/models');
    return code >= 200 && code < 300;
  } catch { return false; }
}

// ── Context-Kompression ───────────────────────────────────────────────────────

async function compressMessages(messages, maxMessages = 20) {
  if (messages.length <= maxMessages) {
    return messages;
  }

  try {
    // System-Message behalten, letzte 10 Nachrichten behalten
    const systemMessage = messages[0];
    const recentMessages = messages.slice(-10);
    const oldMessages = messages.slice(1, -10);

    // Zusammenfassung der alten Nachrichten erstellen
    const summaryPrompt = oldMessages.map(m => `${m.role}: ${m.content}`).join('\n');

    const summaryResponse = await httpPost(
      ENDPOINTS['loki-fast'].host, ENDPOINTS['loki-fast'].port, '/v1/chat/completions',
      {
        model: ENDPOINTS['loki-fast'].modelId,
        messages: [
          { role: 'system', content: 'Erstelle eine prägnante Zusammenfassung des Gesprächsverlaufs auf Deutsch. Maximal 200 Wörter.' },
          { role: 'user', content: summaryPrompt }
        ],
        max_tokens: 200,
        temperature: 0.3,
        stream: false
      },
      30_000
    );

    const summary = summaryResponse?.choices?.[0]?.message?.content || '';

    // Zusammenfassung in Swarm Memory speichern
    try {
      await httpPost('127.0.0.1', 3004, '/api/swarm/store', {
        key: `conversation_summary_${Date.now()}`,
        value: summary,
        ttl: 86400 // 24 Stunden
      }, 5_000);
    } catch {
      // Speichern fehlgeschlagen, aber wir fahren fort
    }

    // Komprimierte Nachricht erstellen
    const compressedMessage = {
      role: 'assistant',
      content: `📋 [Gesprächs-Zusammenfassung gespeichert]\n${summary}`
    };

    return [systemMessage, compressedMessage, ...recentMessages];
  } catch {
    // Bei Fehlern die ursprünglichen Nachrichten zurückgeben
    return messages;
  }
}

// ── Inferenz: OpenAI-kompatibel (loki-fast + loki-pro) ───────────────────────

async function callOpenAI(nodeId, messages, options) {
  const ep = ENDPOINTS[nodeId];
  const isUltra = nodeId === 'loki-ultra';
  // Adaptives Thinking-Budget: kurze Prompts (<80Z) → 3000, lange → 8000
  // Verhindert Over-Thinking bei einfachen Fragen (17k Reasoning für Triviales)
  const promptLen = (messages.at(-1)?.content || '').length;
  const ultraTokens = promptLen < 80 ? 3000 : promptLen < 300 ? 5000 : 8000;
  const maxTok = options.maxTokens || (isUltra ? ultraTokens : 800);
  const data = await httpPost(ep.host, ep.port, '/v1/chat/completions', {
    model:    ep.modelId || nodeId,
    messages,
    max_tokens:  maxTok,
    temperature: options.temperature ?? (isUltra ? 0.6 : 0.3),
    stream: false,
    chat_template_kwargs: { enable_thinking: isUltra },
  }, ep.timeout);
  const msg = data?.choices?.[0]?.message;
  // MLX-LM Thinking: finale Antwort in content, Reasoning in reasoning-Feld
  const text = msg?.content || msg?.reasoning || '';
  return {
    text,
    model:  data?.model || nodeId,
    tokens: data?.usage || null,
  };
}

// ── Inferenz: Ollama (loki-mini Mac Mini) ────────────────────────────────────

async function callOllama(nodeId, messages, options) {
  const ep = ENDPOINTS[nodeId];
  const system  = messages.find(m => m.role === 'system')?.content || PROMPTS.fast;
  const userMsg = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n');
  const data = await httpPost(ep.host, ep.port, '/api/generate', {
    model: 'gemma4:12b', prompt: userMsg, system, stream: false,
    options: { temperature: options.temperature ?? 0.3 },
  }, ep.timeout);
  return { text: data?.response || '', model: data?.model || 'gemma4:12b', tokens: null };
}

// ── Eskalation → KIMBA (Claude Sonnet 4.6 via OpenRouter) ────────────────────

const ESCALATION_TRIGGERS = [
  'weiß ich nicht', 'bin ich nicht sicher', 'keine information',
  'kann ich nicht beantworten', 'nicht in meinem wissen',
  'bitte frage kimba', 'bitte kimba fragen', 'details bei kimba',
  'escalate', 'zu komplex', 'nicht sicher ob',
];

function needsEscalation(text) {
  const t = (text || '').toLowerCase();
  return ESCALATION_TRIGGERS.some(trigger => t.includes(trigger));
}

async function callOpenRouterModel(modelId, messages, options = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const payload = JSON.stringify({
    model: modelId,
    messages,
    max_tokens: options.maxTokens || 1200,
    temperature: options.temperature ?? 0.3,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://ki-os.org',
        'X-Title': 'KI-OS Loki Bridge',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 60_000,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const d = JSON.parse(data);
          resolve({
            text:   d?.choices?.[0]?.message?.content || '',
            model:  d?.model || modelId,
            tokens: d?.usage || null,
          });
        } catch {
          recordFailure(modelId);
          resolve(null);
        }
      });
    });
    req.on('error', () => { recordFailure(modelId); resolve(null); });
    req.on('timeout', () => { req.destroy(); recordFailure(modelId); resolve(null); });
    req.write(payload);
    req.end();
  });
}

async function callCloudTier(tier, messages, options = {}) {
  const route = CLOUD_ROUTES[tier];
  if (!route) return null;

  let primaryRes = null;
  if (!isCoolingDown(route.primary)) {
    primaryRes = await callOpenRouterModel(route.primary, messages, options);
    if (!primaryRes) recordFailure(route.primary);
  }

  if (primaryRes?.text) return { ...primaryRes, model: primaryRes.model || route.primary, tier, label: route.label };

  let backupRes = null;
  if (!isCoolingDown(route.backup)) {
    backupRes = await callOpenRouterModel(route.backup, messages, options);
    if (!backupRes) recordFailure(route.backup);
  }

  if (backupRes?.text) return { ...backupRes, model: backupRes.model || route.backup, tier, label: route.label };

  return null;
}

async function callKIMBA(messages, options = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const payload = JSON.stringify({
    model: 'anthropic/claude-sonnet-4.6',
    messages,
    max_tokens: options.maxTokens || 1200,
    temperature: 0.3,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://ki-os.org',
        'X-Title': 'KI-OS Loki Bridge',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 60_000,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const d = JSON.parse(data);
          resolve({
            text:   d?.choices?.[0]?.message?.content || '',
            model:  'claude-sonnet-4.6',
            tokens: d?.usage || null,
          });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

// ── Tool-Call-Loop (Qwen3 Function Calling) ───────────────────────────────────

async function callOpenAIWithTools(nodeId, messages, options) {
  const ep = ENDPOINTS[nodeId];
  let loopMessages = [...messages];
  const toolsUsed = [];

  for (let i = 0; i < 3; i++) {
    const data = await httpPost(ep.host, ep.port, '/v1/chat/completions', {
      model:    ep.modelId || nodeId,
      messages: loopMessages,
      max_tokens:  options.maxTokens || 800,
      temperature: options.temperature ?? 0.3,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
      tools: LOKI_TOOLS,
      tool_choice: 'auto',
    }, ep.timeout);

    const choice = data?.choices?.[0];
    const msg    = choice?.message || {};

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        text:   msg.content || '',
        model:  data?.model || nodeId,
        tokens: data?.usage || null,
        toolsUsed,
      };
    }

    // Tool-Calls ausführen
    loopMessages.push(msg);
    for (const tc of msg.tool_calls) {
      toolsUsed.push(tc.function.name);
      let args = {};
      try { args = JSON.parse(tc.function.arguments); } catch {}
      const result = await executeTool(tc.function.name, args);
      loopMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Letzte Runde ohne Tools für finale Antwort
  const final = await httpPost(ep.host, ep.port, '/v1/chat/completions', {
    model: ep.modelId || nodeId,
    messages: loopMessages,
    max_tokens: options.maxTokens || 800,
    temperature: options.temperature ?? 0.3,
    stream: false,
    chat_template_kwargs: { enable_thinking: false },
  }, ep.timeout);

  return {
    text:   final?.choices?.[0]?.message?.content || '',
    model:  final?.model || nodeId,
    tokens: final?.usage || null,
    toolsUsed,
  };
}

// ── Hilfsfunktion für Quality-Gate ─────────────────────────────────────────────

const WEAK_RESPONSE_PHRASES = [
  'delegiere ich an openrouter',
  'verwende ich loki',
  'nutze ich loki',
  'bin ich loki',
  'für code-generierung',
  'ich bin nicht sicher',
  'ich weiß nicht',
];

function isWeakResponse(text) {
  if (!text || text.trim().split(/\s+/).length < 40) return true; // unter 40 Wörter = zu kurz
  const t = text.toLowerCase();
  const weakCount = WEAK_RESPONSE_PHRASES.filter(p => t.includes(p)).length;
  return weakCount >= 2; // 2+ Boilerplate-Phrasen = schwache Antwort
}

// ── Session Brain — persistenter Kontext zwischen Chat-Neustarts ─────────────

function loadSessionBrain() {
  const fs = require('fs');
  const sessionPath = `${HOME}/KI-OS/.session/current.json`;
  try {
    const stats = fs.statSync(sessionPath);
    if ((Date.now() - stats.mtimeMs) > 12 * 60 * 60 * 1000) return null; // >12h abgelaufen
    const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    const fragen = Array.isArray(data.offene_fragen) ? data.offene_fragen.join(', ') : '';
    const schritte = Array.isArray(data.naechste_schritte) ? data.naechste_schritte.join(', ') : '';
    return `[Session Brain]\nProjekt: ${data.aktives_projekt}\nKontext: ${data.kontext_summary}${fragen ? '\nOffene Fragen: ' + fragen : ''}${schritte ? '\nNächste Schritte: ' + schritte : ''}`;
  } catch { return null; }
}

async function updateSessionBrain(conversationText) {
  const fs = require('fs');
  const sessionDir = `${HOME}/KI-OS/.session`;
  const currentPath = `${sessionDir}/current.json`;
  const tmpPath = `${sessionDir}/current.json.tmp`;
  const historyPath = `${sessionDir}/history.jsonl`;
  try {
    const msgs = [
      { role: 'system', content: 'Du extrahierst strukturierte Session-Daten aus einem KI-OS Gespräch. Antworte NUR mit validem JSON, kein Text davor oder danach.' },
      { role: 'user',   content: `Extrahiere aus diesem Gespräch:\n${conversationText.slice(0, 600)}\n\nAntworte mit JSON: { "aktives_projekt": string, "kontext_summary": string (1 Satz max 120Z), "offene_fragen": string[], "zuletzt_bearbeitet": string[], "naechste_schritte": string[] }` },
    ];
    const res = await callOpenAI('loki-fast', msgs, { maxTokens: 300, temperature: 0.1 });
    // MLX-LM gibt manchmal ```json...``` zurück — Strip vor Parse
    const cleaned = (res.text || '').replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
    const data = JSON.parse(cleaned);
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify({ ...data, updated: new Date().toISOString() }, null, 2));
    fs.renameSync(tmpPath, currentPath);
    fs.appendFileSync(historyPath, JSON.stringify({ timestamp: new Date().toISOString(), ...data }) + '\n');
  } catch { /* silent — Session Brain ist optional, nie user-sichtbar */ }
}

function injectSessionBrain(messages) {
  // Nur beim ersten Message einer neuen Konversation (system + 1 user = genau 2)
  if (messages.length === 2 && messages[0].role === 'system') {
    const ctx = loadSessionBrain();
    if (ctx) {
      // Nicht mutieren — neues Objekt erstellen
      messages = [{ ...messages[0], content: messages[0].content + '\n\n' + ctx }, ...messages.slice(1)];
    }
  }
  return messages;
}

// ── Executive Planner — Tool-Calls VOR dem LLM-Call ─────────────────────────

// Lädt bis zu 3 relevante Swarm-Memory-Einträge als Kontext-String
async function fetchMemoryForPlanner(query) {
  try {
    const result = await httpPost('127.0.0.1', 3004, '/api/swarm/search', { query, k: 3 }, 5000);
    if (!result || !result.results || result.results.length === 0) return null;
    return result.results.slice(0, 3).map(r => `Erinnerung: ${r.text} (Relevanz: ${r.score})`).join('\n');
  } catch { return null; }
}

// Holt aktuelle Web-Fakten via Perplexity (max 3 Sätze)
async function fetchWebForPlanner(query) {
  try {
    const result = await callOpenRouterModel('perplexity/sonar-pro',
      [{ role: 'user', content: `Kurze aktuelle Fakten (max 3 Sätze, kein Reasoning): ${query}` }],
      { maxTokens: 400, temperature: 0.1 });
    return result?.text || null;
  } catch { return null; }
}

// Analysiert den Prompt vor dem LLM-Call und baut Kontext-String aus parallelen Tool-Calls
async function executivePlan(prompt) {
  const p = prompt.toLowerCase();
  const needsMemory = /erinner|weißt du|kennst du|was war|letzte[sn]?|letztes mal|unser|ki-os|kimba|loki|sprint|training|adapter|kios|kios-v|session/.test(p);
  const needsWeb    = /aktuell|heute |gerade |neueste|neue[sn]?|news|release|version|preis|kosten|wann|announcement|launched/.test(p) && prompt.length < 300;

  if (!needsMemory && !needsWeb) return { plannerContext: '', used: { memory: false, web: false } };

  const [memory, web] = await Promise.all([
    needsMemory ? fetchMemoryForPlanner(prompt.slice(0, 150)).catch(() => null) : Promise.resolve(null),
    needsWeb    ? fetchWebForPlanner(prompt.slice(0, 200)).catch(() => null)    : Promise.resolve(null),
  ]);

  const parts = [];
  if (memory) parts.push('[Kontext aus Memory]\n' + memory);
  if (web)    parts.push('[Aktuelle Web-Infos]\n' + web);

  return { plannerContext: parts.join('\n\n'), used: { memory: !!memory, web: !!web } };
}

// ── Haupt-Funktion für KIMBA ──────────────────────────────────────────────────

async function generate(options = {}) {
  const t0     = Date.now();
  const prompt = options.prompt || options.text || '';
  const tier   = options.tier || classify(prompt, options.dsgvo || false);

  // Executive Planner: Memory + Web parallel vorab laden (graceful degradation bei Fehler)
  const { plannerContext, used: plannerUsed } = options.noPlanner
    ? { plannerContext: '', used: { memory: false, web: false } }
    : await executivePlan(prompt).catch(() => ({ plannerContext: '', used: { memory: false, web: false } }));

  const baseSystem = options.system || PROMPTS[tier] || PROMPTS.fast;
  const system = plannerContext ? `${baseSystem}\n\n${plannerContext}` : baseSystem;

  // Context-Kompression für Multi-Turn-Konversationen
  let messages;
  if (options.messages && Array.isArray(options.messages)) {
    messages = await compressMessages(options.messages);
    // Planner-Kontext in die System-Message einbauen wenn Multi-Turn
    if (plannerContext && messages[0]?.role === 'system') {
      messages[0] = { ...messages[0], content: messages[0].content + '\n\n' + plannerContext };
    }
  } else {
    messages = [
      { role: 'system', content: system },
      { role: 'user',   content: prompt },
    ];
  }

  // Session Brain: Kontext aus letzter Sitzung beim ersten Message einbauen
  messages = injectSessionBrain(messages);

  if (CLOUD_ROUTES[tier]) {
    const cloudRes = await callCloudTier(tier, messages, options);
    if (cloudRes?.text) {
      return { ...cloudRes, node: 'openrouter', latencyMs: Date.now() - t0 };
    }
  }

  // Ultra-Tier: 122B für komplexe Reasoning-Tasks (Memory Manager schaltet Pro→Ultra um)
  if (tier === 'ultra') {
    const switched = await memoryManager.ensureModel('ultra');
    if (switched && await isNodeOnline('loki-ultra')) {
      try {
        const res = await callOpenAI('loki-ultra', messages, options);
        if (res?.text) return { ...res, node: 'loki-ultra', tier: 'ultra', latencyMs: Date.now() - t0 };
      } catch { /* fallback zu deep */ }
    }
    // Fallback: loki-pro (Memory Manager schaltet Ultra→Pro zurück wenn nötig)
    await memoryManager.ensureModel('pro');
    if (await isNodeOnline('loki-pro')) {
      try {
        const res = await callOpenAI('loki-pro', messages, options);
        if (res?.text) return { ...res, node: 'loki-pro', tier: 'ultra-fallback', latencyMs: Date.now() - t0 };
      } catch { /* weiter */ }
    }
    // Alles offline → normaler Fast-Fallback weiter unten
  }

  // Code-Local-Tier: DSGVO-konformer lokaler Coder (Qwen3-Coder-30B)
  if (tier === 'code-local' || tier === 'code') {
    // Versuche zuerst loki-code (Qwen3-Coder-30B, DSGVO-konform)
    if (await isNodeOnline('loki-code')) {
      try {
        const res = await callOpenAI('loki-code', messages, options);
        if (res?.text) return { ...res, node: 'loki-code', tier: 'code-local', latencyMs: Date.now() - t0 };
      } catch { /* fallback */ }
    }
    // Fallback: Cloud Codestral (nur wenn nicht DSGVO-Modus)
    if (!options.dsgvo && CLOUD_ROUTES['code']) {
      const cloudRes = await callCloudTier('code', messages, options);
      if (cloudRes?.text) return { ...cloudRes, node: 'openrouter', tier: 'code-cloud', latencyMs: Date.now() - t0 };
    }
    // DSGVO-Fallback: loki-ultra lokal
    if (await isNodeOnline('loki-ultra')) {
      try {
        const res = await callOpenAI('loki-ultra', messages, options);
        if (res?.text) return { ...res, node: 'loki-ultra', tier: 'code-ultra-fallback', latencyMs: Date.now() - t0 };
      } catch { /* weiter */ }
    }
  }

  // Vision-Tier: direkt zu loki-mini (Gemma3-12b multimodal) oder vision_analyze Tool
  if (tier === 'vision') {
    // Versuche loki-mini (192.168.178.102 — Mac Mini mit Gemma4:12b, Ollama)
    if (await isNodeOnline('loki-mini')) {
      try {
        const res = await callOllama('loki-mini', messages, options);
        if (res?.text) return { ...res, node: 'loki-mini', tier: 'vision', latencyMs: Date.now() - t0 };
      } catch { /* fallback */ }
    }
    // Fallback: loki-pro mit vision_analyze Tool (ruft 127.0.0.1:11434 gemma3:27b)
    if (await isNodeOnline('loki-pro')) {
      try {
        const res = await callOpenAIWithTools('loki-pro', messages, { ...options, useTools: true });
        if (res?.text) return { ...res, node: 'loki-pro', tier: 'vision', latencyMs: Date.now() - t0 };
      } catch { /* fallback */ }
    }
    // Letzter Fallback: loki-fast mit Tools
    if (await isNodeOnline('loki-fast')) {
      const res = await callOpenAIWithTools('loki-fast', messages, { ...options, useTools: true });
      if (res?.text) return { ...res, node: 'loki-fast', tier: 'vision', latencyMs: Date.now() - t0 };
    }
    // Alles offline → normaler Fast-Fallback weiter unten
  }

  // Reihenfolge: deep → 27B zuerst (Memory Manager stellt Pro sicher)
  if (tier === 'deep') await memoryManager.ensureModel('pro');

  const order = tier === 'deep'
    ? ['loki-pro', 'loki-fast', 'loki-mini']
    : ['loki-fast', 'loki-pro', 'loki-mini'];

  let lastResult = null;

  for (const nodeId of order) {
    if (!(await isNodeOnline(nodeId))) continue;
    try {
      const ep  = ENDPOINTS[nodeId];
      const res = ep.ollama
        ? await callOllama(nodeId, messages, options)
        : options.useTools
          ? await callOpenAIWithTools(nodeId, messages, options)
          : await callOpenAI(nodeId, messages, options);

      // Quality-Gate: loki-fast Antwort zu schwach → loki-pro aufrufen
      if (nodeId === 'loki-fast' && isWeakResponse(res.text)) {
        const proOnline = await isNodeOnline('loki-pro');
        if (proOnline) {
          try {
            const proRes = options.useTools
              ? await callOpenAIWithTools('loki-pro', messages, options)
              : await callOpenAI('loki-pro', messages, options);
            if (proRes?.text && !isWeakResponse(proRes.text)) {
              lastResult = { ...proRes, node: 'loki-pro', tier: 'deep-upgraded', latencyMs: Date.now() - t0 };
              return lastResult;
            }
          } catch { /* loki-pro nicht erreichbar, weiter mit fast-Ergebnis */ }
        }
      }

      lastResult = { ...res, node: nodeId, tier, latencyMs: Date.now() - t0 };

      // Eskalations-Check: Loki unsicher → KIMBA (Claude) fragen
      if (!options.noEscalate && needsEscalation(res.text)) {
        const escalated = await callKIMBA([
          { role: 'system', content: 'Du bist KIMBA. Beantworte die Frage auf Deutsch, präzise und vollständig.' },
          { role: 'user', content: prompt },
        ], options);
        if (escalated?.text) {
          if (!options.noPlanner) updateSessionBrain(`Nutzer: ${prompt.slice(0, 200)}\nLoki: ${escalated.text.slice(0, 400)}`);
          return {
            ...escalated,
            node: 'kimba-escalated',
            tier: 'escalated',
            localNode: nodeId,
            latencyMs: Date.now() - t0,
            escalated: true,
          };
        }
      }

      if (!options.noPlanner) updateSessionBrain(`Nutzer: ${prompt.slice(0, 200)}\nLoki: ${res.text.slice(0, 400)}`);
      return lastResult;
    } catch { /* try next */ }
  }

  // Alle lokalen Nodes offline → direkt KIMBA
  if (!options.noEscalate) {
    const fallback = await callKIMBA(messages, options);
    if (fallback?.text) {
      return { ...fallback, node: 'kimba-fallback', tier: 'escalated', latencyMs: Date.now() - t0, escalated: true };
    }
  }

  return { error: 'ALL_NODES_OFFLINE', node: null, tier, latencyMs: Date.now() - t0 };
}

// ── Status für KIMBA Dashboard ────────────────────────────────────────────────

async function getStatus() {
  const results = await Promise.all(
    Object.keys(ENDPOINTS).map(async id => [id, await isNodeOnline(id)])
  );
  const orKey = !!process.env.OPENROUTER_API_KEY;
  return { ...Object.fromEntries(results), 'kimba-escalation': orKey };
}

// Memory Manager beim Start initialisieren (non-blocking)
memoryManager.detectInitial().then(() => {
  console.log(`[MemoryManager] Init — aktives schweres Modell: ${memoryManager.active || 'keines'}`);
}).catch(() => {});

module.exports = { generate, getStatus, classify, needsEscalation, isWeakResponse, callOpenAIWithTools, isAvailable: () => true, callCloudTier, CLOUD_ROUTES, compressMessages, memoryManager, executivePlan, loadSessionBrain, updateSessionBrain, injectSessionBrain };

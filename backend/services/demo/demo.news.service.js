/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: demo.news.service.js
 * Demo News Service — KI-OS Service
 * @license AGPL-3.0-only
 */
'use strict';

/**
 * KI-OS Community Edition — AI News Starter Agent
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 *
 * Holt täglich AI-News aus 3 Portalen und fasst sie auf Deutsch zusammen.
 * Läuft ohne API-Key (Headlines) oder mit Key (LLM-Zusammenfassung).
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const STATE_FILE = path.join(process.cwd(), '.ki-os-starter.json');

const NEWS_SOURCES = [
  {
    name: 'TechCrunch AI',
    url:  'https://techcrunch.com/category/artificial-intelligence/feed/',
    color: '#0ea5e9',
  },
  {
    name: 'The Verge AI',
    url:  'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    color: '#8b5cf6',
  },
  {
    name: 'MIT Technology Review',
    url:  'https://www.technologyreview.com/feed/',
    color: '#10b981',
  },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { active: true, lastDigest: null, lastRun: null };
  }
}

function saveState(state) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8'); } catch {}
}

// ---------------------------------------------------------------------------
// RSS Fetch
// ---------------------------------------------------------------------------
function fetchUrl(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'KI-OS-Community/1.0 NewsBot (ki-os.org)' },
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout nach ' + timeoutMs + 'ms')); });
  });
}

// ---------------------------------------------------------------------------
// RSS Parser (keine externe Abhängigkeit)
// ---------------------------------------------------------------------------
function extractTag(xml, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`).exec(xml);
  if (cdata) return cdata[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(xml);
  return plain ? plain[1].trim() : '';
}

function stripHtml(str) {
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ').trim();
}

function isToday(dateStr) {
  if (!dateStr) return true; // Im Zweifel behalten
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const today = new Date();
  return d.getFullYear() === today.getFullYear()
      && d.getMonth()    === today.getMonth()
      && d.getDate()     === today.getDate();
}

function parseRSS(xml, maxItems = 5) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems * 3) {
    const block = match[1];
    const title   = stripHtml(extractTag(block, 'title'));
    const link    = extractTag(block, 'link').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
                  || (/<link\s[^>]*href="([^"]*)"/.exec(block) || [])[1] || '';
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
    const desc    = stripHtml(extractTag(block, 'description')).substring(0, 250);

    if (!title || title.length < 5) continue;

    items.push({ title, link, pubDate, description: desc });
  }
  // Bevorzuge heutige, nimm sonst die neuesten
  const todayItems = items.filter(i => isToday(i.pubDate));
  return (todayItems.length >= 2 ? todayItems : items).slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// News abrufen
// ---------------------------------------------------------------------------
async function fetchAllNews() {
  const results = await Promise.allSettled(
    NEWS_SOURCES.map(async (src) => {
      const xml   = await fetchUrl(src.url);
      const items = parseRSS(xml);
      return { source: src.name, color: src.color, items, error: null };
    })
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { source: NEWS_SOURCES[i].name, color: NEWS_SOURCES[i].color, items: [], error: r.reason?.message || 'Fehler' };
  });
}

// ---------------------------------------------------------------------------
// LLM Zusammenfassung (optional — nur wenn Provider konfiguriert)
// ---------------------------------------------------------------------------
async function summarizeWithLLM(items) {
  try {
    const { handleChat } = require('../chat.controller');
    const headlines = items
      .map(i => `- ${i.title} (${i.source})`)
      .join('\n');

    const result = await handleChat({
      input_text: `Du bist ein freundlicher KI-Nachrichtenredakteur. Fasse diese heutigen AI-News in 4-6 Sätzen auf Deutsch zusammen. Erwähne die wichtigsten Themen und Trends. Halte den Ton informativ und verständlich.\n\nAktuelle Meldungen:\n${headlines}`,
      model:      'fast',
      stream:     false,
    }, { userId: 'system', role: 'admin', tenantId: 'default' });

    if (result.success && result.response) return result.response;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Haupt-API
// ---------------------------------------------------------------------------
async function runDigest() {
  const state = loadState();

  const sourcesData = await fetchAllNews();
  const allItems    = sourcesData.flatMap(s => s.items.map(i => ({ ...i, source: s.source })));
  const summary     = allItems.length > 0 ? await summarizeWithLLM(allItems) : null;

  const digest = {
    createdAt:     new Date().toISOString(),
    sources:       sourcesData,
    totalArticles: allItems.length,
    summary,
    hasLLM:        !!summary,
  };

  state.lastDigest = digest;
  state.lastRun    = digest.createdAt;
  saveState(state);

  return { success: true, digest };
}

function getStatus() {
  return loadState();
}

function dismissStarter() {
  const state  = loadState();
  state.active = false;
  saveState(state);
  return { success: true };
}

// ---------------------------------------------------------------------------
// HTTP-Request-Handler (für core/app.community.js)
// ---------------------------------------------------------------------------
async function handleStarterRequest(path, method) {
  if (path === '/starter/status' && method === 'GET') {
    return { statusCode: 200, body: getStatus() };
  }
  if (path === '/starter/news/run' && method === 'POST') {
    const result = await runDigest();
    return { statusCode: 200, body: result };
  }
  if (path === '/starter/dismiss' && method === 'DELETE') {
    return { statusCode: 200, body: dismissStarter() };
  }
  return { statusCode: 404, body: { error: 'not_found' } };
}

module.exports = { handleStarterRequest, runDigest, getStatus, dismissStarter, NEWS_SOURCES };

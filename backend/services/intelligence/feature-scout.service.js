/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const fs = require('fs');
const path = require('path');

const SIGNALS_PATH = path.join(process.cwd(), '.ki-os-feature-signals.ndjson');
const SOURCES = [
  'https://openrouter.ai/api/v1/models',
  // 'https://www.anthropic.com/news'
  // 'https://openai.com/news'
  // 'https://github.com/trending'
];

function parseNdjsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return [];
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeFeature(model) {
  const id = String(model?.id || '');
  const description = String(model?.description || '');

  return {
    id,
    name: String(model?.name || id || 'Unknown Model'),
    description,
    provider: String(id.split('/')[0] || 'openrouter').toLowerCase(),
    contextLength: Number(model?.context_length || 0),
    pricePerToken: Number(model?.pricing?.prompt || 0),
    source: 'openrouter'
  };
}

async function scanFeatures() {
  try {
    const response = await fetch(SOURCES[0], {
      headers: { accept: 'application/json' }
    });

    if (!response.ok) return [];

    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : [];

    return models
      .map(normalizeFeature)
      .filter((feature) => feature.description.length > 20);
  } catch {
    console.warn('[FeatureScout] API nicht erreichbar');
    return [];
  }
}

function getSignals() {
  return parseNdjsonFile(SIGNALS_PATH);
}

function saveSignal(feature) {
  fs.appendFileSync(SIGNALS_PATH, `${JSON.stringify(feature)}\n`, 'utf8');
}

module.exports = { SOURCES, scanFeatures, getSignals, saveSignal };

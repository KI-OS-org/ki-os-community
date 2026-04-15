/**
 * @file    ghost.vision.service.js
 * @desc    Ghost Vision Phase 1 — Screenshot-Verifikation für Ghost Control Steps.
 *          Prüft via LLM Vision ob ein Ghost-Step korrekt ausgeführt wurde.
 *          Nutzt Claude claude-sonnet-4-6 (Vision) oder GPT-4o via OpenRouter als Fallback.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

const logger = require('../core/logger.service');

// ─── Konfiguration ────────────────────────────────────────────────────────────

const VISION_MODEL_ANTHROPIC  = process.env.GHOST_VISION_MODEL_ANTHROPIC  || 'claude-sonnet-4-6';
const VISION_MODEL_OPENROUTER = process.env.GHOST_VISION_MODEL_OPENROUTER || 'openai/gpt-4o';
const VISION_TIMEOUT_MS       = Number(process.env.GHOST_VISION_TIMEOUT_MS || 25000);
const MAX_IMAGE_BYTES         = 5 * 1024 * 1024; // 5 MB

// ─── Prompt ───────────────────────────────────────────────────────────────────

const VISION_SYSTEM_PROMPT = `Du bist KIMBA, die Ghost Control Verifikations-KI von KI-OS.
Du analysierst Screenshots des KI-OS Frontends und prüfst ob ein bestimmter Step
korrekt ausgeführt wurde.

Antworte NUR als JSON (kein Markdown):
{
  "verified": true|false,
  "confidence": 0.0-1.0,
  "description": "<1-2 Sätze was du siehst und ob der Step ausgeführt wurde>",
  "hint": "<optional: was fehlt oder was der User stattdessen sieht>"
}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripMarkdown(text) {
  return String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseVisionResponse(text) {
  const cleaned = stripMarkdown(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]+\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Vision LLM returned invalid JSON');
  }
}

/**
 * Validiert und normalisiert ein Base64-Bild.
 * Akzeptiert: reines Base64 oder Data-URL (data:image/png;base64,...)
 *
 * @param {string} imageData
 * @returns {{ base64: string, mediaType: string }}
 */
function normalizeImage(imageData) {
  if (!imageData || typeof imageData !== 'string') {
    throw new Error('imageData ist erforderlich (Base64-String oder Data-URL)');
  }

  let base64 = imageData;
  let mediaType = 'image/png';

  // Data-URL parsen
  const dataUrlMatch = imageData.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    mediaType = dataUrlMatch[1].toLowerCase();
    base64    = dataUrlMatch[2];
  }

  // Unterstützte Typen
  const SUPPORTED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!SUPPORTED.includes(mediaType)) {
    throw new Error(`Nicht unterstützter Bildtyp: ${mediaType}. Erlaubt: ${SUPPORTED.join(', ')}`);
  }

  // Größen-Check
  const byteSize = Math.ceil((base64.length * 3) / 4);
  if (byteSize > MAX_IMAGE_BYTES) {
    throw new Error(`Bild zu groß: ${Math.round(byteSize / 1024)}KB. Maximum: ${MAX_IMAGE_BYTES / 1024}KB`);
  }

  return { base64, mediaType };
}

// ─── LLM Vision Calls ─────────────────────────────────────────────────────────

async function callAnthropicVision(base64, mediaType, stepDescription) {
  const Anthropic = require('../providers/anthropic.provider');

  const userMessage = {
    role: 'user',
    content: [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 }
      },
      {
        type: 'text',
        text: `Ghost Control Step der geprüft werden soll: "${stepDescription}"\n\nIst dieser Step auf dem Screenshot korrekt ausgeführt worden? Antworte als JSON.`
      }
    ]
  };

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Vision timeout after ${VISION_TIMEOUT_MS}ms`)), VISION_TIMEOUT_MS)
  );

  const call = Anthropic.chat({
    model:      VISION_MODEL_ANTHROPIC,
    messages:   [userMessage],
    system:     VISION_SYSTEM_PROMPT,
    max_tokens: 512,
    temperature: 0.1
  });

  const res = await Promise.race([call, timeout]);
  return res.text || res.reply || '';
}

async function callOpenRouterVision(base64, mediaType, stepDescription) {
  const OpenRouter = require('../providers/openrouter.provider');

  const dataUrl = `data:${mediaType};base64,${base64}`;

  const messages = [
    { role: 'system', content: VISION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        {
          type: 'text',
          text: `Ghost Control Step der geprüft werden soll: "${stepDescription}"\n\nIst dieser Step auf dem Screenshot korrekt ausgeführt worden? Antworte als JSON.`
        }
      ]
    }
  ];

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Vision timeout after ${VISION_TIMEOUT_MS}ms`)), VISION_TIMEOUT_MS)
  );

  const call = OpenRouter.chat({
    model:       VISION_MODEL_OPENROUTER,
    messages,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  const res = await Promise.race([call, timeout]);
  return res.text || res.reply || '';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Verifiziert einen Ghost Control Step anhand eines Screenshots.
 *
 * @param {string} imageData       - Base64-String oder Data-URL (PNG/JPEG/WebP)
 * @param {string} stepDescription - Beschreibung des ausgeführten Steps (callout text)
 * @param {object} [options]
 * @param {string} [options.stepType]  - Step-Typ (click, fill, navigate, ...)
 * @param {string} [options.target]    - data-ghost Selektor oder Route
 * @returns {Promise<{
 *   verified: boolean,
 *   confidence: number,
 *   description: string,
 *   hint?: string,
 *   provider: string
 * }>}
 */
async function verifyStep(imageData, stepDescription, options = {}) {
  if (!stepDescription || !String(stepDescription).trim()) {
    throw new Error('stepDescription ist erforderlich');
  }

  const { base64, mediaType } = normalizeImage(imageData);

  const enrichedDescription = options.stepType
    ? `[${options.stepType.toUpperCase()}${options.target ? ` → ${options.target}` : ''}] ${stepDescription}`
    : stepDescription;

  logger.info('ghost.vision.verify', {
    stepType:    options.stepType,
    target:      options.target,
    description: stepDescription.slice(0, 80),
    mediaType
  });

  // Provider-Strategie: Anthropic Vision → OpenRouter GPT-4o Fallback
  let raw = '';
  let provider = '';

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      raw = await callAnthropicVision(base64, mediaType, enrichedDescription);
      provider = `anthropic/${VISION_MODEL_ANTHROPIC}`;
    } catch (err) {
      logger.warn('ghost.vision.anthropic.failed', { error: err.message });
    }
  }

  if (!raw && process.env.OPENROUTER_API_KEY) {
    raw = await callOpenRouterVision(base64, mediaType, enrichedDescription);
    provider = `openrouter/${VISION_MODEL_OPENROUTER}`;
  }

  if (!raw) {
    throw new Error('Kein Vision-Provider verfügbar (ANTHROPIC_API_KEY oder OPENROUTER_API_KEY erforderlich)');
  }

  const result = parseVisionResponse(raw);

  // Normalisierung
  const verified    = Boolean(result.verified);
  const confidence  = Math.min(1, Math.max(0, Number(result.confidence) || 0));
  const description = String(result.description || '');
  const hint        = result.hint ? String(result.hint) : undefined;

  logger.info('ghost.vision.result', { verified, confidence, provider });

  return { verified, confidence, description, ...(hint ? { hint } : {}), provider };
}

module.exports = { verifyStep };

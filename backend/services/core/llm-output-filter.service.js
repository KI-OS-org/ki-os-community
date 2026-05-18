/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: llm-output-filter.service.js
 * LLM Output Filter — erkennt und bereinigt schädliche Inhalte in Modell-Outputs:
 * Training-Injections (CJK/CCP-Propaganda), Prompt-Injection, Jailbreak-Versuche.
 * @license AGPL-3.0-only
 */
'use strict';

const logger = require('./logger.service');

// Regex für CJK-Zeichen (Chinesisch, Japanisch Kanji, Koreanisch)
const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF]/g;

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+|previous\s+|above\s+|prior\s+|your\s+)(instructions|rules|prompt|system)/i,
  /you\s+are\s+now\s+/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+if\s+you/i,
  /disregard\s+(all\s+)?(previous|your|the)\s+/i,
  /<!--\s/,
  /<\/s>/,
  /\[\/INST\]/,
  /<\|im_end\|>/,
  /###\s*Human:/i,
  /###\s*Assistant:/i,
  /DAN\s+mode/i,
  /jailbreak/i,
  /do\s+anything\s+now/i,
];

const POLITICAL_PATTERNS = [
  /core\s+socialist\s+values/i,
  /xi\s+jinping/i,
  /chinese\s+communist\s+party/i,
  /\bccp\b/i,
  /党的领导/,
  /习近平/,
  /社会主义核心价值观/,
  /中国共产党/,
  /新时代中国特色/,
];

const INSTRUCTION_OVERRIDE_PATTERNS = [
  /^(system|user|assistant)\s*:/im,
  /^IMPORTANT\s+OVERRIDE/im,
  /^NEW\s+INSTRUCTIONS/im,
];

class LlmOutputFilter {
  constructor() {
    this.enabled = process.env.LLM_FILTER_ENABLED !== 'false';
    this.strict  = process.env.LLM_FILTER_STRICT === 'true';
  }

  filter(text, options = {}) {
    if (!this.enabled || !text) return { text: text || '', flagged: false, flags: [], score: 0.0 };

    const model  = options.model || 'unknown';
    const flags  = [];

    // 1. CJK-Block-Detection
    const cjkMatches = [...text.matchAll(new RegExp(`[\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uAC00-\\uD7AF\\u3040-\\u309F\\u30A0-\\u30FF]{5,}`, 'g'))];
    for (const m of cjkMatches) {
      if (m[0].length >= 20) {
        flags.push({ type: 'cjk_injection', severity: 'HIGH', excerpt: m[0].slice(0, 60), offset: m.index });
      }
    }

    // 2. Prompt Injection
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      const m = text.match(pattern);
      if (m) {
        flags.push({ type: 'prompt_injection', severity: 'HIGH', pattern: m[0] });
        break;
      }
    }

    // 3. Excessive Non-ASCII
    const nonAsciiCount = Array.from(text).filter(c => c.charCodeAt(0) > 127).length;
    const ratio = nonAsciiCount / text.length;
    if (ratio > 0.30 && text.length > 100) {
      flags.push({ type: 'excessive_non_ascii', severity: 'MEDIUM', ratio: +ratio.toFixed(2) });
    }

    // 4. Political/Ideological Content
    for (const pattern of POLITICAL_PATTERNS) {
      if (pattern.test(text)) {
        flags.push({ type: 'political_content', severity: 'MEDIUM' });
        break;
      }
    }

    // 5. Instruction Override (nur ausserhalb Code-Blocks)
    const noCode = text.replace(/```[\s\S]*?```/g, '');
    for (const pattern of INSTRUCTION_OVERRIDE_PATTERNS) {
      if (pattern.test(noCode)) {
        flags.push({ type: 'instruction_override', severity: 'LOW' });
        break;
      }
    }

    // Logging
    for (const flag of flags) {
      const meta = { type: flag.type, severity: flag.severity, model };
      if (flag.severity === 'HIGH') {
        logger.error('llm-output-filter: HIGH severity flag', meta);
      } else {
        logger.warn('llm-output-filter: flag detected', meta);
      }
    }

    const highCount = flags.filter(f => f.severity === 'HIGH').length;
    const score = flags.length === 0 ? 0.0 : Math.min(1.0, (highCount * 0.6 + (flags.length - highCount) * 0.2));

    return { text, flagged: flags.length > 0, flags, score };
  }

  isSafe(text, options) {
    return !this.filter(text, options).flagged;
  }

  sanitize(text, options = {}) {
    if (!this.enabled || !text) return text || '';
    const { flags } = this.filter(text, options);
    if (flags.length === 0) return text;

    let out = text;

    // Entferne CJK-Bloecke (alles ab 5 aufeinanderfolgenden CJK-Zeichen)
    const highOrStrict = (f) => f.severity === 'HIGH' || (this.strict && f.severity === 'MEDIUM');

    if (flags.some(f => f.type === 'cjk_injection' && highOrStrict(f))) {
      out = out.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF]{5,}/g, '');
    }
    if (flags.some(f => f.type === 'political_content' && highOrStrict(f))) {
      for (const p of POLITICAL_PATTERNS) out = out.replace(p, '[filtered]');
    }
    if (flags.some(f => f.type === 'prompt_injection')) {
      for (const p of PROMPT_INJECTION_PATTERNS) out = out.replace(p, '[filtered]');
    }

    out = out.replace(/\s{3,}/g, '\n').trim();
    if (out && flags.some(f => f.severity === 'HIGH')) {
      out += '\n\n> [llm-output-filter: HIGH severity content removed]';
    }
    return out;
  }
}

module.exports = new LlmOutputFilter();

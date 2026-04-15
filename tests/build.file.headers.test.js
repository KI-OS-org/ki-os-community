'use strict';
const { test } = require('node:test');
const assert   = require('node:assert');

// Inline-Definitionen — exakt wie in scripts/build-file-headers.js

function hasFileHeader(content) {
  return content.includes('@file');
}

function shouldSkipFile(filename) {
  return filename.endsWith('.min.js');
}

function stripMarkdownFences(text) {
  return text.replace(/^```(?:javascript|js)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function isValidHeaderResponse(text, originalContent) {
  return text.includes('@file') && text.length >= originalContent.length * 0.5;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('hasFileHeader — mit @file → true', () => {
  const content = '/**\n * @file test.js\n */\n\'use strict\';';
  assert.strictEqual(hasFileHeader(content), true);
});

test('hasFileHeader — ohne @file → false', () => {
  const content = '\'use strict\';\nconst x = 1;';
  assert.strictEqual(hasFileHeader(content), false);
});

test('hasFileHeader — @file in der Mitte → true', () => {
  const content = 'const x = 1;\n// @file somewhere\nmodule.exports = {};';
  assert.strictEqual(hasFileHeader(content), true);
});

test('shouldSkipFile — .min.js → true', () => {
  assert.strictEqual(shouldSkipFile('jquery.min.js'), true);
});

test('shouldSkipFile — normale .js → false', () => {
  assert.strictEqual(shouldSkipFile('server.js'), false);
});

test('stripMarkdownFences — mit js-Fences → sauber', () => {
  const input = '```javascript\nconst x = 1;\n```';
  assert.strictEqual(stripMarkdownFences(input), 'const x = 1;');
});

test('stripMarkdownFences — ohne Fences → unverändert', () => {
  const input = 'const x = 1;';
  assert.strictEqual(stripMarkdownFences(input), 'const x = 1;');
});

test('stripMarkdownFences — mit js-shorthand Fence', () => {
  const input = '```js\nmodule.exports = {};\n```';
  assert.strictEqual(stripMarkdownFences(input), 'module.exports = {};');
});

test('isValidHeaderResponse — zu kurze Antwort → false', () => {
  const original = 'A'.repeat(1000);
  const response = 'A'.repeat(400);
  assert.strictEqual(isValidHeaderResponse(response, original), false);
});

test('isValidHeaderResponse — ohne @file → false', () => {
  const original = 'A'.repeat(100);
  const response = 'A'.repeat(200);
  assert.strictEqual(isValidHeaderResponse(response, original), false);
});

test('isValidHeaderResponse — gültig → true', () => {
  const original = 'A'.repeat(100);
  const response = '/**\n * @file test.js\n */\n' + 'A'.repeat(100);
  assert.strictEqual(isValidHeaderResponse(response, original), true);
});

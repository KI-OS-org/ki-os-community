'use strict';
const { test } = require('node:test');
const assert   = require('node:assert');
const path     = require('path');

const VISION_MODULE = path.resolve(__dirname, '../backend/services/ghost/ghost.vision.service');

function freshVision() {
  delete require.cache[VISION_MODULE];
  return require(VISION_MODULE);
}

test('verifyStep — ohne imageData → Error', async () => {
  const { verifyStep } = freshVision();
  await assert.rejects(() => verifyStep('', 'some step'), /imageData/);
});

test('verifyStep — ohne stepDescription → Error', async () => {
  const { verifyStep } = freshVision();
  await assert.rejects(() => verifyStep('data:image/png;base64,abc', ''), /stepDescription/);
});

test('verifyStep — ungültiger Bildtyp (bmp) → Error', async () => {
  const { verifyStep } = freshVision();
  await assert.rejects(
    () => verifyStep('data:image/bmp;base64,abc', 'step'),
    /Nicht unterstützter/
  );
});

test('verifyStep — Bild zu groß (>5MB) → Error', async () => {
  const { verifyStep } = freshVision();
  const bigBase64 = 'A'.repeat(7 * 1024 * 1024);
  await assert.rejects(
    () => verifyStep('data:image/png;base64,' + bigBase64, 'step'),
    /zu groß/
  );
});

test('verifyStep — kein Provider konfiguriert → Error', async () => {
  const saved = {
    anthropic:   process.env.ANTHROPIC_API_KEY,
    openrouter:  process.env.OPENROUTER_API_KEY,
  };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  delete require.cache[VISION_MODULE];
  const { verifyStep } = require(VISION_MODULE);

  try {
    await assert.rejects(
      () => verifyStep('data:image/png;base64,abc123', 'step'),
      /Provider/
    );
  } finally {
    if (saved.anthropic)  process.env.ANTHROPIC_API_KEY  = saved.anthropic;
    if (saved.openrouter) process.env.OPENROUTER_API_KEY = saved.openrouter;
    delete require.cache[VISION_MODULE];
  }
});

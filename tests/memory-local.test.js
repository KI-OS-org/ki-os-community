/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: memory-local.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('local file memory adapter saves and lists entries', async () => {
  const tempFile = path.join(os.tmpdir(), `ki-os-memory-${Date.now()}.json`);
  process.env.MEMORY_DRIVER = 'file';
  process.env.LOCAL_MEMORY_FILE = tempFile;
  delete require.cache[require.resolve('../backend/memory/index')];
  const { createMemoryAdapter } = require('../backend/memory/index');
  const adapter = createMemoryAdapter();

  await adapter.save({ userId: 'u1', text: 'hello world' });
  const items = await adapter.listByUser('u1');
  assert.equal(items.length, 1);
  assert.match(items[0].text || '', /hello world/);

  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
});

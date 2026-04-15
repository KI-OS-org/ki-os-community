import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (relativePath) => fs.readFileSync(new URL(relativePath, root), 'utf8');

test('F4 workspace page wires file and memory workspace', () => {
  const page = read('./app/workspace/files/page.tsx');
  const shell = read('./components/files/file-memory-workspace.tsx');

  assert.match(page, /FileMemoryWorkspace/);
  assert.match(shell, /UploadDropzone/);
  assert.match(shell, /MemoryPanel/);
  assert.match(shell, /MemoryGraph/);
});

test('F4 adapter exposes upload, retrieval and graph data', () => {
  const adapter = read('./lib/adapters/files-memory.ts');

  assert.match(adapter, /demoFiles/);
  assert.match(adapter, /demoMemoryHits/);
  assert.match(adapter, /demoMemoryGraph/);
  assert.match(adapter, /createOrbitFilesFromSelection/);
});

test('F4 API routes expose files and memory retrieval', () => {
  const filesRoute = read('./app/api/files/route.ts');
  const memoryRoute = read('./app/api/memory/retrieve/route.ts');

  assert.match(filesRoute, /NextResponse\.json/);
  assert.match(memoryRoute, /searchParams\.get\("q"\)/);
  assert.match(memoryRoute, /hits/);
});

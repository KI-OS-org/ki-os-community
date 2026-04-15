import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStarterBoard } from '../components/whiteboard/whiteboard-shell.tsx';

test('starter board contains sticky, kpi and result cards', () => {
  const cards = buildStarterBoard();
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map((c) => c.type), ['sticky', 'kpi', 'result']);
});

test('board satisfies DoD semantics', () => {
  const cards = buildStarterBoard();
  assert.ok(cards.every((card) => Number.isFinite(card.x) && Number.isFinite(card.y)));
  assert.ok(cards.some((card) => card.type === 'sticky'));
});

test('shared board state is intended to be visible', async () => {
  const mod = await import('../lib/adapters/whiteboard.ts');
  const state = await mod.getWhiteboardState();
  assert.equal(state.shared, true);
  assert.equal(state.persisted, true);
});

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { DominoesBoard } from '../packages/games/dominoes/ui.tsx';
import { applyDominoMove, projectDominoState } from '../packages/games/dominoes/rules.ts';
import { createDominoes } from '../packages/games/dominoes/state.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});

const { render, fireEvent, cleanup } = await import('@testing-library/react');
afterEach(() => cleanup());
const t = (key: string) => key;

test('online Dominoes renders only the viewer hand and never opponent or boneyard IDs', () => {
  const authoritative = createDominoes(5021),
    viewer = authoritative.turn,
    projected = projectDominoState(authoritative, viewer),
    hidden = [...authoritative.hands[viewer === 0 ? 1 : 0], ...authoritative.boneyard];
  const view = render(
    <DominoesBoard state={projected} disabled={false} onMove={() => {}} t={t} mode="online" />,
  );
  assert.equal(view.container.querySelectorAll('.domino-hand-tile').length, 7);
  const markup = view.container.innerHTML;
  for (const tileId of hidden) assert.equal(markup.includes(tileId), false);
  assert.equal(markup.includes(String(authoritative.seed)), false);
});

test('local Dominoes starts behind a handoff screen and reveals only the active hand', () => {
  const state = createDominoes(1977);
  let emitted: unknown;
  const view = render(
    <DominoesBoard state={state} disabled={false} onMove={(move) => (emitted = move)} t={t} mode="local" />,
  );
  assert.equal(view.container.querySelectorAll('.domino-hand-tile').length, 0);
  assert.ok(view.getByText('dominoHandoff'));
  fireEvent.click(view.getByRole('button', { name: 'dominoShowHand' }));
  assert.equal(view.container.querySelectorAll('.domino-hand-tile').length, 7);
  const opponent = state.turn === 0 ? 1 : 0,
    markup = view.container.innerHTML;
  for (const tileId of state.hands[opponent]) assert.equal(markup.includes(tileId), false);

  const opening = state.openingTileId!;
  fireEvent.click(view.getByRole('listitem', { name: `dominoTile ${opening} · dominoPlayable` }));
  assert.deepEqual(emitted, { type: 'play', tileId: opening, side: 'right' });

  const next = applyDominoMove(state, emitted as never);
  view.rerender(
    <DominoesBoard state={next} disabled={false} onMove={() => {}} t={t} mode="local" />,
  );
  assert.equal(view.container.querySelectorAll('.domino-hand-tile').length, 0);
  assert.ok(view.getByText('dominoHandoff'));
});

test('AI Dominoes keeps the human hand visible and does not render the AI hand', () => {
  const state = createDominoes(7007),
    aiTiles = state.hands[1];
  const view = render(
    <DominoesBoard state={state} disabled={state.turn === 1} onMove={() => {}} t={t} mode="ai" />,
  );
  assert.equal(view.container.querySelectorAll('.domino-hand-tile').length, 7);
  const markup = view.container.innerHTML;
  for (const tileId of aiTiles) assert.equal(markup.includes(tileId), false);
  for (const tileId of state.hands[0]) assert.equal(markup.includes(tileId), true);
});

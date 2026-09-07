import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { createReversi } from '../packages/games/reversi/state.ts';
import { reversiEngine } from '../packages/games/reversi/rules.ts';
import { ReversiBoard } from '../packages/games/reversi/ui.tsx';

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

test('Reversi UI exposes exactly four opening moves and flips the captured disc', () => {
  const state = createReversi();
  let move: { row: number; col: number } | undefined;
  const view = render(
    <ReversiBoard state={state} disabled={false} onMove={(next) => (move = next)} t={t} />,
  );

  const board = view.getByRole('grid', { name: 'reversi' });
  assert.equal(board.getAttribute('dir'), 'ltr');
  assert.equal(view.container.querySelectorAll('.reversi-cell').length, 64);
  assert.equal(view.container.querySelectorAll('.reversi-cell:not(:disabled)').length, 4);
  assert.equal(view.container.querySelectorAll('.reversi-disc').length, 4);

  fireEvent.click(view.getByRole('button', { name: 'reversiLegalMove 3,4' }));
  assert.deepEqual(move, { row: 2, col: 3 });

  const next = reversiEngine.apply(state, move!);
  view.rerender(
    <ReversiBoard state={next} disabled={false} onMove={(candidate) => (move = candidate)} t={t} />,
  );
  assert.equal(view.container.querySelectorAll('.reversi-disc').length, 5);
  assert.equal(view.container.querySelectorAll('.reversi-disc.flipped').length, 1);
  assert.equal(view.container.querySelectorAll('.reversi-cell.last-cell').length, 1);
});

test('Reversi UI locks every board cell when the match layer disables input', () => {
  const view = render(
    <ReversiBoard state={createReversi()} disabled={true} onMove={() => assert.fail('move emitted')} t={t} />,
  );
  const cells = Array.from(view.container.querySelectorAll<HTMLButtonElement>('.reversi-cell'));
  assert.equal(cells.length, 64);
  assert.ok(cells.every((cell) => cell.disabled));
});

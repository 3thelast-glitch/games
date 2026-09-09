import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { createChess, type ChessMove } from '../packages/games/chess/state.ts';
import { ChessBoard } from '../packages/games/chess/ui.tsx';

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

test('Chess UI renders 64 fixed-coordinate squares and emits a legal e2-e4 move', () => {
  let move: ChessMove | undefined;
  const view = render(
    <ChessBoard state={createChess()} disabled={false} onMove={(next) => (move = next)} t={t} />,
  );

  const board = view.getByRole('group', { name: 'chess' });
  assert.equal(board.getAttribute('dir'), 'ltr');
  assert.equal(view.container.querySelectorAll('.chess-cell').length, 64);
  assert.equal(view.container.querySelectorAll('.chess-piece').length, 32);

  fireEvent.click(view.getByRole('button', { name: /e2: chessWhite chessPawn/ }));
  assert.equal(view.container.querySelectorAll('.chess-cell.legal-cell').length, 2);
  fireEvent.click(view.getByRole('button', { name: /e4: emptyCell/ }));
  assert.deepEqual(move, { from: 52, to: 36 });
});

test('Chess UI locks every square when the match layer disables input', () => {
  const view = render(
    <ChessBoard state={createChess()} disabled={true} onMove={() => assert.fail('move emitted')} t={t} />,
  );
  const cells = Array.from(view.container.querySelectorAll<HTMLButtonElement>('.chess-cell'));
  assert.equal(cells.length, 64);
  assert.ok(cells.every((cell) => cell.disabled));
});

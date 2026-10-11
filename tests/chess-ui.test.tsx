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

  const board = view.getByRole('grid', { name: 'chess' });
  assert.equal(board.getAttribute('dir'), 'ltr');
  assert.equal(view.container.querySelectorAll('.chess-cell').length, 64);
  assert.equal(view.container.querySelectorAll('.chess-piece').length, 32);
  const svgs = Array.from(view.container.querySelectorAll<SVGElement>('.chess-piece-svg'));
  assert.equal(svgs.length, 32);
  assert.ok(!/[♔♕♖♗♘♙♚♛♜♝♞♟]/u.test(view.container.textContent ?? ''));
  for (const type of ['pawn', 'knight', 'queen', 'king', 'bishop', 'rook']) {
    const piece = view.container.querySelector<SVGElement>(
      `.chess-piece-svg[data-piece="${type}"]`,
    );
    assert.ok(piece, type);
    assert.match(piece.getAttribute('viewBox') ?? '', /^\d+ \d+ \d+ \d+$/);
    assert.ok(piece.getAttribute('style')?.includes('--chess-piece-reference-height'));
    assert.equal(piece.getAttribute('data-reference-traced'), 'true');
  }
  assert.equal(
    view.container.querySelectorAll('.chess-piece-svg[data-piece="queen"]').length,
    2,
  );
  assert.equal(
    view.container.querySelectorAll('.chess-piece-svg[data-piece="king"]').length,
    2,
  );

  fireEvent.click(view.getByRole('gridcell', { name: /e2: chessWhite chessPawn/ }));
  assert.equal(view.container.querySelectorAll('.chess-cell.legal-cell').length, 2);
  fireEvent.click(view.getByRole('gridcell', { name: /e4: emptyCell/ }));
  assert.deepEqual(move, { from: 52, to: 36 });
});

test('Chess reference pieces use tight viewboxes and per-piece relative heights', () => {
  const view = render(
    <ChessBoard state={createChess()} disabled={false} onMove={() => {}} t={t} />,
  );
  const king = view.container.querySelector<SVGElement>('.chess-piece-svg[data-piece="king"]');
  const pawn = view.container.querySelector<SVGElement>('.chess-piece-svg[data-piece="pawn"]');
  assert.ok(king);
  assert.ok(pawn);
  assert.notEqual(king?.getAttribute('viewBox'), pawn?.getAttribute('viewBox'));
  const kingStyle = king?.getAttribute('style') ?? '';
  const pawnStyle = pawn?.getAttribute('style') ?? '';
  assert.match(kingStyle, /94%/);
  assert.match(pawnStyle, /43%/);
});

test('Chess UI renders a non-interactive strategic plan arrow over the board', () => {
  const view = render(
    <ChessBoard
      state={createChess()}
      disabled={false}
      onMove={() => {}}
      t={t}
      plan={{ from: 52, to: 36, kind: 'centerControl', player: 0 }}
    />,
  );

  const overlay = view.container.querySelector<SVGElement>('.chess-plan-overlay');
  assert.ok(overlay);
  assert.equal(overlay?.getAttribute('aria-hidden'), 'true');
  assert.ok(overlay?.querySelector('line'));
  assert.ok(overlay?.querySelector('marker'));
});

test('Chess UI locks every square when the match layer disables input', () => {
  const view = render(
    <ChessBoard state={createChess()} disabled={true} onMove={() => assert.fail('move emitted')} t={t} />,
  );
  const cells = Array.from(view.container.querySelectorAll<HTMLButtonElement>('.chess-cell'));
  assert.equal(cells.length, 64);
  assert.ok(cells.every((cell) => cell.disabled));
});

test('Local chess uses face-to-face tabletop orientation only for the opposite seat', () => {
  const local = render(
    <ChessBoard
      state={createChess()}
      disabled={false}
      onMove={() => {}}
      t={t}
      mode="local"
    />,
  );

  assert.ok(local.container.querySelector('.chess-game.chess-tabletop'));
  const facingPieces = Array.from(
    local.container.querySelectorAll<HTMLElement>('.chess-piece.tabletop-facing-piece'),
  );
  assert.equal(facingPieces.length, 16);
  assert.ok(facingPieces.every((piece) => piece.classList.contains('owner-1')));
  assert.equal(local.container.querySelectorAll('.chess-file-opposite').length, 8);
  assert.equal(local.container.querySelectorAll('.chess-rank-opposite').length, 8);

  local.rerender(
    <ChessBoard
      state={createChess()}
      disabled={false}
      onMove={() => {}}
      t={t}
      mode="ai"
    />,
  );
  assert.equal(local.container.querySelector('.chess-game.chess-tabletop'), null);
  assert.equal(local.container.querySelectorAll('.tabletop-facing-piece').length, 0);
  assert.equal(local.container.querySelectorAll('.chess-file-opposite').length, 0);
  assert.equal(local.container.querySelectorAll('.chess-rank-opposite').length, 0);
});

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { createDotsAndBoxes } from '../packages/games/dots-and-boxes/state.ts';
import { DotsAndBoxesBoard } from '../packages/games/dots-and-boxes/ui.tsx';

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

test('Dots and Boxes UI renders all 60 edges and emits logical coordinates', () => {
  const state = createDotsAndBoxes();
  let move: unknown;
  const view = render(
    <DotsAndBoxesBoard state={state} disabled={false} onMove={(next) => (move = next)} t={t} />,
  );
  const board = view.getByRole('grid', { name: 'dotsAndBoxes' });
  assert.equal(board.getAttribute('dir'), 'ltr');
  assert.equal(view.container.querySelectorAll('.dots-edge.horizontal').length, 30);
  assert.equal(view.container.querySelectorAll('.dots-edge.vertical').length, 30);
  assert.equal(view.container.querySelectorAll('.dots-dot').length, 36);
  fireEvent.click(view.getByRole('button', { name: 'drawHorizontalEdge 1,1' }));
  assert.deepEqual(move, { orientation: 'h', row: 0, col: 0 });
});

test('Dots and Boxes UI shows claimed boxes and locks occupied edges', () => {
  const state = createDotsAndBoxes(1, 1);
  state.horizontalEdges[0] = 0;
  state.horizontalEdges[1] = 1;
  state.verticalEdges[0] = 0;
  state.verticalEdges[1] = 1;
  state.boxes[0] = 1;
  state.scores = [0, 1];
  const view = render(
    <DotsAndBoxesBoard state={state} disabled={false} onMove={() => assert.fail('move emitted')} t={t} />,
  );
  assert.equal(view.container.querySelectorAll('.box-owner-1').length, 1);
  const edges = Array.from(view.container.querySelectorAll<HTMLButtonElement>('.dots-edge'));
  assert.equal(edges.length, 4);
  assert.ok(edges.every((edge) => edge.disabled));
});

test('Dots and Boxes UI locks all available edges when match input is disabled', () => {
  const view = render(
    <DotsAndBoxesBoard
      state={createDotsAndBoxes()}
      disabled={true}
      onMove={() => assert.fail('move emitted')}
      t={t}
    />,
  );
  const edges = Array.from(view.container.querySelectorAll<HTMLButtonElement>('.dots-edge'));
  assert.equal(edges.length, 60);
  assert.ok(edges.every((edge) => edge.disabled));
});

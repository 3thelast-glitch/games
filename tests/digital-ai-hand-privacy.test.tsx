import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { DigitalGameBoard } from '../packages/games/digital-game/ui.tsx';
import { createDigitalGame } from '../packages/games/digital-game/state.ts';

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

const { render, cleanup } = await import('@testing-library/react');
afterEach(() => cleanup());
const t = (key: string) => key;

function rackLabels(state: ReturnType<typeof createDigitalGame>, seat: number) {
  return state.racks[seat].map((id) => {
    const tile = state.tiles[id];
    return tile.isJoker ? 'digitalJoker' : `${tile.value} digitalColor.${tile.color}`;
  });
}
function renderedRack(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.digital-rack .digital-tile'), (node) => node.getAttribute('aria-label'));
}

test('Digital Game AI turn still shows human rack, not computer rack', () => {
  const initial = createDigitalGame(4521);
  const state = { ...initial, turn: 1 as const, ply: initial.ply + 1 };
  const view = render(
    <DigitalGameBoard state={state} mode="ai" disabled onMove={() => {}} t={t} />,
  );
  assert.deepEqual(renderedRack(view.container), rackLabels(state, 0));
  assert.equal(view.container.querySelectorAll('.digital-rack button:enabled').length, 0);
});

test('Digital Game local seat follows turn; online seat follows projection', () => {
  const initial = createDigitalGame(5622);
  const local = { ...initial, turn: 1 as const };
  const view = render(
    <DigitalGameBoard state={local} mode="local" disabled onMove={() => {}} t={t} />,
  );
  assert.deepEqual(renderedRack(view.container), rackLabels(local, 1));
  view.rerender(
    <DigitalGameBoard state={{ ...local, viewerSeat: 0 }} mode="online" disabled onMove={() => {}} t={t} />,
  );
  assert.deepEqual(renderedRack(view.container), rackLabels(local, 0));
});

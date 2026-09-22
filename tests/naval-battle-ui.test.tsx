import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { NavalBattleBoard } from '../packages/games/naval-battle/ui.tsx';
import { applyNavalMove, projectNavalState } from '../packages/games/naval-battle/rules.ts';
import {
  createNavalBattle,
  type NavalBattleState,
  type NavalPlacement,
} from '../packages/games/naval-battle/state.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLButtonElement: dom.window.HTMLButtonElement,
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

const fleet0: NavalPlacement[] = [
  { shipId: 'carrier', row: 0, col: 0, orientation: 'horizontal' },
  { shipId: 'battleship', row: 2, col: 0, orientation: 'horizontal' },
  { shipId: 'cruiser', row: 4, col: 0, orientation: 'horizontal' },
  { shipId: 'submarine', row: 6, col: 0, orientation: 'horizontal' },
  { shipId: 'destroyer', row: 8, col: 0, orientation: 'horizontal' },
];

const fleet1: NavalPlacement[] = [
  { shipId: 'carrier', row: 0, col: 9, orientation: 'vertical' },
  { shipId: 'battleship', row: 0, col: 7, orientation: 'vertical' },
  { shipId: 'cruiser', row: 0, col: 5, orientation: 'vertical' },
  { shipId: 'submarine', row: 0, col: 3, orientation: 'vertical' },
  { shipId: 'destroyer', row: 0, col: 1, orientation: 'vertical' },
];

function chooseLoadouts(state = createNavalBattle()) {
  let next = applyNavalMove(state, {
    type: 'selectAbilities',
    abilities: ['sonarPulse', 'twinSalvo', 'hunterProtocol'],
  });
  next = applyNavalMove(next, {
    type: 'selectAbilities',
    abilities: ['emergencyRepair', 'signalJammer', 'silentReposition'],
  });
  return next;
}

function deploy(state: NavalBattleState, fleet: NavalPlacement[]) {
  let next = state;
  for (const placement of fleet) next = applyNavalMove(next, { type: 'place', ...placement });
  return applyNavalMove(next, { type: 'ready' });
}

function battleState() {
  let state = chooseLoadouts(createNavalBattle());
  state = deploy(state, fleet0);
  state = deploy(state, fleet1);
  return state;
}

test('loadout requires exactly three selections and emits only those abilities', () => {
  const state = projectNavalState(createNavalBattle(), 0);
  let emitted: unknown;
  const view = render(
    <NavalBattleBoard
      state={state}
      disabled={false}
      onMove={(move) => (emitted = move)}
      t={t}
      mode="online"
    />,
  );

  const cards = view.container.querySelectorAll<HTMLButtonElement>('.naval-ability-card');
  assert.equal(cards.length, 6);
  fireEvent.click(cards[0]);
  fireEvent.click(cards[1]);
  assert.equal(view.getByRole('button', { name: 'navalConfirmLoadout' }).hasAttribute('disabled'), true);
  fireEvent.click(cards[2]);
  const confirm = view.getByRole('button', { name: 'navalConfirmLoadout' });
  assert.equal(confirm.hasAttribute('disabled'), false);
  fireEvent.click(confirm);
  assert.deepEqual(emitted, {
    type: 'selectAbilities',
    abilities: ['sonarPulse', 'twinSalvo', 'hunterProtocol'],
  });
});

test('online placement exposes 100 stable coordinate controls and emits a valid placement', () => {
  const state = projectNavalState(chooseLoadouts(createNavalBattle()), 0);
  let emitted: unknown;
  const view = render(
    <NavalBattleBoard
      state={state}
      disabled={false}
      onMove={(move) => (emitted = move)}
      t={t}
      mode="online"
    />,
  );

  const cells = view.getAllByRole('gridcell');
  assert.equal(cells.length, 100);
  fireEvent.click(view.getByRole('gridcell', { name: /A1:/ }));
  assert.ok(view.getByText('navalPlacementValid'));
  fireEvent.click(view.getByRole('button', { name: 'navalPlaceShip' }));
  assert.deepEqual(emitted, {
    type: 'place',
    shipId: 'carrier',
    row: 0,
    col: 0,
    orientation: 'horizontal',
  });
});

test('placement rotation changes preview geometry without dispatching a move', () => {
  const state = projectNavalState(chooseLoadouts(createNavalBattle()), 0);
  const emitted: unknown[] = [];
  const view = render(
    <NavalBattleBoard
      state={state}
      disabled={false}
      onMove={(move) => emitted.push(move)}
      t={t}
      mode="online"
    />,
  );

  fireEvent.click(view.getByRole('button', { name: /navalRotate/ }));
  fireEvent.click(view.getByRole('gridcell', { name: /A1:/ }));
  assert.equal(emitted.length, 0);
  fireEvent.click(view.getByRole('button', { name: 'navalPlaceShip' }));
  assert.deepEqual(emitted[0], {
    type: 'place',
    shipId: 'carrier',
    row: 0,
    col: 0,
    orientation: 'vertical',
  });
});

test('battle target selection is two-step and duplicate/public shot cells are disabled', () => {
  let authoritative = battleState();
  authoritative = applyNavalMove(authoritative, { type: 'fire', row: 0, col: 9 });
  authoritative.turn = 0;
  const state = projectNavalState(authoritative, 0);
  let emitted: unknown;
  const view = render(
    <NavalBattleBoard
      state={state}
      disabled={false}
      onMove={(move) => (emitted = move)}
      t={t}
      mode="online"
    />,
  );

  const targetBoard = view.getByRole('grid', { name: 'navalTargetGrid' });
  const fired = targetBoard.querySelector<HTMLButtonElement>('[data-cell-index="9"]')!;
  assert.equal(fired.disabled, true);

  const target = targetBoard.querySelector<HTMLButtonElement>('[data-cell-index="0"]')!;
  fireEvent.click(target);
  assert.equal(emitted, undefined);
  fireEvent.click(view.getByRole('button', { name: /navalFire/ }));
  assert.deepEqual(emitted, { type: 'fire', row: 0, col: 0 });
});

test('online rendering contains only the viewer fleet overlays, never hidden enemy geometry', () => {
  const authoritative = battleState();
  const projected = projectNavalState(authoritative, 0);
  const view = render(
    <NavalBattleBoard state={projected} disabled={false} onMove={() => {}} t={t} mode="online" />,
  );

  const ownBoard = view.getByRole('grid', { name: 'navalOwnFleet' });
  assert.equal(ownBoard.querySelectorAll('.naval-ship-overlay').length, 5);
  const targetBoard = view.getByRole('grid', { name: 'navalTargetGrid' });
  assert.equal(targetBoard.querySelectorAll('.naval-ship-overlay').length, 0);
  assert.deepEqual(projected.fleets[1], []);
});

test('local Naval Battle starts behind a privacy handoff and reveals only the active seat', () => {
  const state = createNavalBattle();
  const view = render(
    <NavalBattleBoard state={state} disabled={false} onMove={() => {}} t={t} mode="local" />,
  );

  assert.equal(view.container.querySelectorAll('.naval-grid').length, 0);
  assert.ok(view.getByText('navalPrivacyHandoff'));
  fireEvent.click(view.getByRole('button', { name: 'navalRevealBoard' }));
  assert.ok(view.getByText('navalChooseAbilities'));
  assert.equal(view.getAllByRole('button').filter((button) => button.className.includes('naval-ability-card')).length, 6);
});

test('grid keyboard navigation uses one roving tab stop and preserves logical coordinates in RTL', () => {
  document.documentElement.dir = 'rtl';
  const state = projectNavalState(chooseLoadouts(createNavalBattle()), 0);
  const view = render(
    <NavalBattleBoard state={state} disabled={false} onMove={() => {}} t={t} mode="online" />,
  );
  const grid = view.getByRole('grid', { name: 'navalPlacementBoard' });
  const first = grid.querySelector<HTMLButtonElement>('[data-cell-index="0"]')!;
  const second = grid.querySelector<HTMLButtonElement>('[data-cell-index="1"]')!;
  assert.equal(first.tabIndex, 0);
  assert.equal(second.tabIndex, -1);
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  assert.equal(document.activeElement, second);
  assert.match(second.getAttribute('aria-label') ?? '', /^B1:/);
  document.documentElement.dir = 'ltr';
});

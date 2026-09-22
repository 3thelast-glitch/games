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
const loadout0 = ['sonarPulse', 'twinSalvo', 'hunterProtocol'] as const;
const loadout1 = ['emergencyRepair', 'signalJammer', 'silentReposition'] as const;

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

function selectedFor(state: NavalBattleState, player: 0 | 1) {
  let next = state;
  if (next.phase === 'loadout') {
    if (next.turn === 0)
      next = applyNavalMove(next, { type: 'selectAbilities', abilities: [...loadout0] });
    else next = applyNavalMove(next, { type: 'selectAbilities', abilities: [...loadout1] });
  }
  if (next.phase === 'loadout') {
    if (next.turn === 0)
      next = applyNavalMove(next, { type: 'selectAbilities', abilities: [...loadout0] });
    else next = applyNavalMove(next, { type: 'selectAbilities', abilities: [...loadout1] });
  }
  return projectNavalState(next, player);
}

function readyForPlacement(player: 0 | 1 = 0) {
  let state = createNavalBattle();
  if (state.turn === 0) state = applyNavalMove(state, { type: 'selectAbilities', abilities: [...loadout0] });
  state = applyNavalMove(state, { type: 'selectAbilities', abilities: [...loadout1] });
  return projectNavalState(state, player);
}

function deploy(state: NavalBattleState, fleet: NavalPlacement[]) {
  let next = state;
  for (const placement of fleet) next = applyNavalMove(next, { type: 'place', ...placement });
  return applyNavalMove(next, { type: 'ready' });
}

function battleState() {
  let state = createNavalBattle();
  state = applyNavalMove(state, { type: 'selectAbilities', abilities: [...loadout0] });
  state = applyNavalMove(state, { type: 'selectAbilities', abilities: [...loadout1] });
  state = deploy(state, fleet0);
  state = deploy(state, fleet1);
  return state;
}

test('loadout UI exposes six abilities and emits exactly the three chosen abilities', () => {
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

  const cards = view.container.querySelectorAll('.naval-loadout-card');
  assert.equal(cards.length, 6);
  fireEvent.click(cards[0] as HTMLButtonElement);
  fireEvent.click(cards[1] as HTMLButtonElement);
  fireEvent.click(cards[2] as HTMLButtonElement);
  const confirm = view.getByRole('button', { name: 'navalConfirmLoadout' });
  assert.equal((confirm as HTMLButtonElement).disabled, false);
  fireEvent.click(confirm);
  assert.deepEqual(emitted, {
    type: 'selectAbilities',
    abilities: ['sonarPulse', 'twinSalvo', 'hunterProtocol'],
  });
});

test('online placement exposes 100 stable coordinate controls and emits a valid placement', () => {
  const state = readyForPlacement(0);
  let emitted: unknown;
  const view = render(
    <NavalBattleBoard state={state} disabled={false} onMove={(move) => (emitted = move)} t={t} mode="online" />,
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
  const state = readyForPlacement(0);
  const emitted: unknown[] = [];
  const view = render(
    <NavalBattleBoard state={state} disabled={false} onMove={(move) => emitted.push(move)} t={t} mode="online" />,
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

test('battle shows only the three selected tactical cards and unused enemy loadout stays absent', () => {
  const authoritative = battleState();
  const projected = projectNavalState(authoritative, 0);
  const view = render(
    <NavalBattleBoard state={projected} disabled={false} onMove={() => {}} t={t} mode="online" />,
  );
  assert.equal(view.container.querySelectorAll('.naval-ability-item').length, 3);
  assert.deepEqual(projected.loadouts[1], []);
  assert.equal(view.container.textContent?.includes('navalAbility.emergencyRepair'), false);
});

test('Sonar Pulse selects one enemy center and emits no normal fire', () => {
  const projected = projectNavalState(battleState(), 0);
  let emitted: unknown;
  const view = render(
    <NavalBattleBoard state={projected} disabled={false} onMove={(move) => (emitted = move)} t={t} mode="online" />,
  );
  fireEvent.click(view.getByRole('button', { name: /navalAbility.sonarPulse/ }));
  const targetBoard = view.getByRole('grid', { name: 'navalTargetGrid' });
  fireEvent.click(targetBoard.querySelector<HTMLButtonElement>('[data-cell-index="11"]')!);
  fireEvent.click(view.getByRole('button', { name: 'navalActivateAbility' }));
  assert.deepEqual(emitted, { type: 'sonarPulse', row: 1, col: 1 });
});

test('Twin Salvo requires and emits two distinct target cells', () => {
  const projected = projectNavalState(battleState(), 0);
  let emitted: unknown;
  const view = render(
    <NavalBattleBoard state={projected} disabled={false} onMove={(move) => (emitted = move)} t={t} mode="online" />,
  );
  fireEvent.click(view.getByRole('button', { name: /navalAbility.twinSalvo/ }));
  const targetBoard = view.getByRole('grid', { name: 'navalTargetGrid' });
  fireEvent.click(targetBoard.querySelector<HTMLButtonElement>('[data-cell-index="0"]')!);
  const activate = view.getByRole('button', { name: 'navalActivateAbility' }) as HTMLButtonElement;
  assert.equal(activate.disabled, true);
  fireEvent.click(targetBoard.querySelector<HTMLButtonElement>('[data-cell-index="1"]')!);
  assert.equal(activate.disabled, false);
  fireEvent.click(activate);
  assert.deepEqual(emitted, {
    type: 'twinSalvo',
    targets: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ],
  });
});

test('Hunter Protocol presents use-or-end-turn after a hit and only accepts adjacent targets', () => {
  let authoritative = battleState();
  authoritative = applyNavalMove(authoritative, { type: 'fire', row: 0, col: 9 });
  const projected = projectNavalState(authoritative, 0);
  const emitted: unknown[] = [];
  const view = render(
    <NavalBattleBoard state={projected} disabled={false} onMove={(move) => emitted.push(move)} t={t} mode="online" />,
  );
  assert.ok(view.getByText('navalHunterDecision'));
  const targetBoard = view.getByRole('grid', { name: 'navalTargetGrid' });
  fireEvent.click(targetBoard.querySelector<HTMLButtonElement>('[data-cell-index="55"]')!);
  const activate = view.getByRole('button', { name: 'navalActivateAbility' }) as HTMLButtonElement;
  assert.equal(activate.disabled, true);
  fireEvent.click(targetBoard.querySelector<HTMLButtonElement>('[data-cell-index="19"]')!);
  assert.equal(activate.disabled, false);
  fireEvent.click(activate);
  assert.deepEqual(emitted.at(-1), { type: 'hunterFire', row: 1, col: 9 });
});

test('Emergency Repair targets an active own hit', () => {
  let authoritative = battleState();
  authoritative.loadouts[0] = ['emergencyRepair', 'signalJammer', 'silentReposition'];
  authoritative.loadouts[1] = ['sonarPulse', 'twinSalvo', 'hunterProtocol'];
  authoritative.turn = 1;
  authoritative = applyNavalMove(authoritative, { type: 'fire', row: 0, col: 0 });
  authoritative = applyNavalMove(authoritative, { type: 'declineHunter' });
  authoritative.turn = 0;
  const projected = projectNavalState(authoritative, 0);
  let emitted: unknown;
  const view = render(
    <NavalBattleBoard state={projected} disabled={false} onMove={(move) => (emitted = move)} t={t} mode="online" />,
  );
  fireEvent.click(view.getByRole('button', { name: /navalAbility.emergencyRepair/ }));
  const ownBoard = view.getByRole('grid', { name: 'navalOwnFleet' });
  fireEvent.click(ownBoard.querySelector<HTMLButtonElement>('[data-cell-index="0"]')!);
  fireEvent.click(view.getByRole('button', { name: 'navalActivateAbility' }));
  assert.deepEqual(emitted, { type: 'emergencyRepair', row: 0, col: 0 });
});

test('online rendering contains only the viewer fleet overlays, never hidden enemy geometry', () => {
  const projected = projectNavalState(battleState(), 0);
  const view = render(
    <NavalBattleBoard state={projected} disabled={false} onMove={() => {}} t={t} mode="online" />,
  );
  const ownBoard = view.getByRole('grid', { name: 'navalOwnFleet' });
  assert.equal(ownBoard.querySelectorAll('.naval-ship-overlay:not(.preview)').length, 5);
  const targetBoard = view.getByRole('grid', { name: 'navalTargetGrid' });
  assert.equal(targetBoard.querySelectorAll('.naval-ship-overlay').length, 0);
  assert.deepEqual(projected.fleets[1], []);
});

test('local Naval Battle begins behind privacy handoff before loadout selection', () => {
  const state = createNavalBattle();
  const view = render(
    <NavalBattleBoard state={state} disabled={false} onMove={() => {}} t={t} mode="local" />,
  );
  assert.equal(view.container.querySelectorAll('.naval-loadout-card').length, 0);
  assert.ok(view.getByText('navalPrivacyHandoff'));
  fireEvent.click(view.getByRole('button', { name: 'navalRevealBoard' }));
  assert.equal(view.container.querySelectorAll('.naval-loadout-card').length, 6);
});

test('grid keyboard navigation keeps logical A–J coordinates in RTL', () => {
  document.documentElement.dir = 'rtl';
  const state = readyForPlacement(0);
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

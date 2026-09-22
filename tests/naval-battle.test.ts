import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchService } from '../apps/server/src/matches.ts';
import { Store } from '../apps/server/src/store.ts';
import type { MatchCommand, MatchSnapshot } from '../packages/core/src/protocol.ts';
import { chooseNavalMove } from '../packages/games/naval-battle/ai.ts';
import {
  applyNavalMove,
  isCompleteNavalFleet,
  isNavalPlacementValid,
  legalNavalMoves,
  navalPlacementCells,
  projectNavalState,
  validateNavalMove,
} from '../packages/games/naval-battle/rules.ts';
import {
  createNavalBattle,
  type NavalBattleMove,
  type NavalBattleState,
  type NavalPlacement,
} from '../packages/games/naval-battle/state.ts';
import { games } from '../packages/games/registry.ts';

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

function chooseLoadouts(state = createNavalBattle(0)): NavalBattleState {
  let next = applyNavalMove(state, {
    type: 'selectAbilities',
    abilities: ['sonarPulse', 'twinSalvo', 'emergencyRepair'],
  });
  next = applyNavalMove(next, {
    type: 'selectAbilities',
    abilities: ['sonarPulse', 'emergencyRepair', 'signalJammer'],
  });
  return next;
}

function deploy(state: NavalBattleState, fleet: NavalPlacement[]): NavalBattleState {
  let next = state;
  for (const placement of fleet)
    next = applyNavalMove(next, { type: 'place', ...placement });
  return applyNavalMove(next, { type: 'ready' });
}

function battleState(): NavalBattleState {
  let state = chooseLoadouts(createNavalBattle(0));
  state = deploy(state, fleet0);
  state = deploy(state, fleet1);
  assert.equal(state.phase, 'battle');
  assert.deepEqual(state.ready, [true, true]);
  return state;
}

function onlineMove(match: MatchSnapshot, move: NavalBattleMove): MatchCommand {
  return {
    type: 'move',
    matchId: match.id,
    commandId: randomUUID(),
    expectedRevision: match.revision,
    move,
  } as MatchCommand;
}

test('Naval Battle is registered as a two-player game', () => {
  const game = games.get('navalBattle');
  assert.equal(game.id, 'navalBattle');
  assert.equal(game.minPlayers, 2);
  assert.equal(game.maxPlayers, 2);
});

test('each player must lock exactly three distinct abilities before placement', () => {
  const state = createNavalBattle();
  assert.equal(state.phase, 'loadout');
  assert.deepEqual(
    validateNavalMove(state, {
      type: 'selectAbilities',
      abilities: ['sonarPulse', 'sonarPulse', 'twinSalvo'],
    } as NavalBattleMove),
    { ok: false, code: 'naval-invalid-loadout' },
  );

  let next = applyNavalMove(state, {
    type: 'selectAbilities',
    abilities: ['sonarPulse', 'twinSalvo', 'emergencyRepair'],
  });
  assert.equal(next.phase, 'loadout');
  assert.equal(next.turn, 1);
  assert.deepEqual(next.loadouts[0], ['sonarPulse', 'twinSalvo', 'hunterProtocol']);

  next = applyNavalMove(next, {
    type: 'selectAbilities',
    abilities: ['emergencyRepair', 'signalJammer', 'silentReposition'],
  });
  assert.equal(next.phase, 'placement');
  assert.equal(next.turn, 0);
});

test('fleet geometry uses the exact 5/4/3/3/2 lengths and allows adjacency', () => {
  assert.deepEqual(fleet0.map((placement) => navalPlacementCells(placement).length), [5, 4, 3, 3, 2]);
  assert.equal(isCompleteNavalFleet(fleet0), true);

  const touching: NavalPlacement[] = [
    { shipId: 'carrier', row: 0, col: 0, orientation: 'horizontal' },
    { shipId: 'destroyer', row: 1, col: 0, orientation: 'horizontal' },
  ];
  assert.equal(isNavalPlacementValid(touching, touching[1]), true);
});

test('placement validation rejects overlap and out-of-bounds without mutating state', () => {
  let state = chooseLoadouts();
  state = applyNavalMove(state, {
    type: 'place',
    shipId: 'carrier',
    row: 0,
    col: 0,
    orientation: 'horizontal',
  });
  const before = structuredClone(state);

  assert.deepEqual(
    validateNavalMove(state, {
      type: 'place',
      shipId: 'battleship',
      row: 0,
      col: 3,
      orientation: 'vertical',
    }),
    { ok: false, code: 'naval-overlap' },
  );
  assert.deepEqual(
    validateNavalMove(state, {
      type: 'place',
      shipId: 'battleship',
      row: 9,
      col: 8,
      orientation: 'horizontal',
    }),
    { ok: false, code: 'naval-out-of-bounds' },
  );
  assert.deepEqual(state, before);
});

test('ready requires all five ships and locks the confirmed fleet', () => {
  let state = chooseLoadouts();
  assert.deepEqual(validateNavalMove(state, { type: 'ready' }), {
    ok: false,
    code: 'naval-fleet-incomplete',
  });
  for (const placement of fleet0) state = applyNavalMove(state, { type: 'place', ...placement });
  state = applyNavalMove(state, { type: 'ready' });
  assert.equal(state.ready[0], true);
  assert.equal(state.turn, 1);
  state.turn = 0;
  assert.deepEqual(
    validateNavalMove(state, {
      type: 'place',
      shipId: 'destroyer',
      row: 9,
      col: 8,
      orientation: 'horizontal',
    }),
    { ok: false, code: 'naval-fleet-locked' },
  );
});

test('battle begins only after both fleets confirm and starter keeps the first shot', () => {
  let state = chooseLoadouts(createNavalBattle(0));
  state = deploy(state, fleet0);
  assert.equal(state.phase, 'placement');
  assert.equal(state.turn, 1);
  state = deploy(state, fleet1);
  assert.equal(state.phase, 'battle');
  assert.equal(state.turn, 0);
});

test('a hit consumes the turn and a miss consumes the turn', () => {
  let state = battleState();
  state = applyNavalMove(state, { type: 'fire', row: 0, col: 9 });
  assert.equal(state.shots.at(-1)?.outcome, 'hit');
  assert.equal(state.turn, 1);

  state = applyNavalMove(state, { type: 'fire', row: 9, col: 9 });
  assert.equal(state.shots.at(-1)?.outcome, 'miss');
  assert.equal(state.turn, 0);
});

test('duplicate shots are rejected and malformed moves cannot smuggle authority fields', () => {
  let state = battleState();
  state = applyNavalMove(state, { type: 'fire', row: 0, col: 9 });
  state.turn = 0;
  assert.deepEqual(validateNavalMove(state, { type: 'fire', row: 0, col: 9 }), {
    ok: false,
    code: 'naval-duplicate-shot',
  });
  assert.throws(
    () =>
      games.get('navalBattle').parseMove({
        type: 'fire',
        row: 1,
        col: 1,
        winner: 0,
        enemyFleet: fleet1,
      }),
    /invalid-coordinate/,
  );
});

test('sunk state becomes public only after every cell of that ship is hit', () => {
  let state = battleState();
  const destroyer = fleet1.find((ship) => ship.shipId === 'destroyer')!;
  const [first, second] = navalPlacementCells(destroyer);

  state = applyNavalMove(state, { type: 'fire', ...first });
  assert.equal(state.shots.at(-1)?.outcome, 'hit');
  assert.equal(state.shots.at(-1)?.sunkCells, undefined);

  state.turn = 0;
  state = applyNavalMove(state, { type: 'fire', ...second });
  const shot = state.shots.at(-1)!;
  assert.equal(shot.outcome, 'sunk');
  assert.equal(shot.sunkShipId, 'destroyer');
  assert.deepEqual(shot.sunkCells, navalPlacementCells(destroyer));
  assert.equal(state.remainingShips[1], 4);
});

test('destroying the fifth enemy ship ends the match with the Naval result reason', () => {
  const state = battleState();
  const almostDone: NavalBattleState = {
    ...state,
    remainingShips: [5, 1],
    shots: fleet1
      .filter((placement) => placement.shipId !== 'destroyer')
      .flatMap((placement) =>
        navalPlacementCells(placement).map((cell, index, cells) => ({
          shooter: 0 as const,
          ...cell,
          outcome: index === cells.length - 1 ? ('sunk' as const) : ('hit' as const),
          ...(index === cells.length - 1
            ? { sunkShipId: placement.shipId, sunkCells: cells }
            : {}),
        })),
      ),
  };
  let next = almostDone;
  const destroyer = fleet1.find((ship) => ship.shipId === 'destroyer')!;
  for (const cell of navalPlacementCells(destroyer)) {
    next.turn = 0;
    next = applyNavalMove(next, { type: 'fire', ...cell });
  }
  assert.equal(next.winner, 0);
  assert.equal(next.remainingShips[1], 0);
  assert.equal(next.resultReason, 'naval-fleet-destroyed');
  assert.deepEqual(legalNavalMoves(next), []);
});

test('projection is an allowlist: viewer receives only own fleet plus public shot information', () => {
  const state = battleState();
  const view0 = projectNavalState(state, 0);
  const view1 = projectNavalState(state, 1);
  assert.deepEqual(view0.fleets[0], state.fleets[0]);
  assert.deepEqual(view0.fleets[1], []);
  assert.deepEqual(view1.fleets[0], []);
  assert.deepEqual(view1.fleets[1], state.fleets[1]);
  assert.equal(view0.viewerSeat, 0);
  assert.equal(view1.viewerSeat, 1);
  assert.equal(JSON.stringify(view0.fleets[1]), '[]');
});

test('AI receives a player-scoped projection and cannot change target because the hidden fleet moved', () => {
  let first = battleState();
  first.turn = 1;
  first.shots = [
    { shooter: 1, row: 5, col: 5, outcome: 'miss' },
    { shooter: 1, row: 2, col: 2, outcome: 'hit' },
  ];
  const second = structuredClone(first);
  second.fleets[0] = fleet0.map((placement) => ({
    ...placement,
    row: Math.min(9 - (placement.orientation === 'vertical' ? navalPlacementCells(placement).length - 1 : 0), placement.row + 1),
  }));
  const viewA = projectNavalState(first, 1);
  const viewB = projectNavalState(second, 1);
  assert.deepEqual(viewA, viewB);
  assert.deepEqual(
    chooseNavalMove(viewA, 'hard', { random: () => 0.31 }),
    chooseNavalMove(viewB, 'hard', { random: () => 0.31 }),
  );
});

test('server-side online projection never returns the opponent fleet to either client', () => {
  const store = new Store();
  const alice = store.createUser('Alice');
  const bob = store.createUser('Bob');
  const service = new MatchService(store, games, { clockMs: 600000 });
  try {
    let match = service.create('navalBattle', [alice.id, bob.id]);
    for (const placement of fleet0)
      match = service.command(alice.id, onlineMove(match, { type: 'place', ...placement }));
    match = service.command(alice.id, onlineMove(match, { type: 'ready' }));
    for (const placement of fleet1)
      match = service.command(bob.id, onlineMove(match, { type: 'place', ...placement }));
    match = service.command(bob.id, onlineMove(match, { type: 'ready' }));

    const aliceView = service.forUser(match, alice.id).state as NavalBattleState;
    const bobView = service.forUser(match, bob.id).state as NavalBattleState;
    assert.deepEqual(aliceView.fleets[1], []);
    assert.deepEqual(bobView.fleets[0], []);
    assert.equal(aliceView.phase, 'battle');
    assert.equal(bobView.phase, 'battle');

    const raw = match.state as NavalBattleState;
    const forged = service.command(
      alice.id,
      onlineMove(match, { type: 'fire', row: raw.fleets[1][0].row, col: raw.fleets[1][0].col }),
    );
    const bobProjected = service.forUser(forged, bob.id).state as NavalBattleState;
    assert.deepEqual(bobProjected.fleets[0], []);
  } finally {
    store.close();
  }
});

test('Naval Battle state survives JSON round-trip with the same next legal transitions', () => {
  const state = battleState();
  const serialized = JSON.stringify(state);
  const restored = JSON.parse(serialized) as NavalBattleState;
  assert.deepEqual(restored, JSON.parse(serialized));
  assert.deepEqual(legalNavalMoves(restored), legalNavalMoves(state));
});

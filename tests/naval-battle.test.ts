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
  navalAbilityAvailable,
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

function selectLoadouts(state: NavalBattleState): NavalBattleState {
  let next = state;
  const first = next.turn;
  next = applyNavalMove(next, {
    type: 'selectAbilities',
    abilities: first === 0 ? [...loadout0] : [...loadout1],
  });
  const second = next.turn;
  next = applyNavalMove(next, {
    type: 'selectAbilities',
    abilities: second === 0 ? [...loadout0] : [...loadout1],
  });
  assert.equal(next.phase, 'placement');
  assert.equal(next.turn, next.starter);
  return next;
}

function deploy(state: NavalBattleState, fleet: NavalPlacement[]): NavalBattleState {
  let next = state;
  for (const placement of fleet) next = applyNavalMove(next, { type: 'place', ...placement });
  return applyNavalMove(next, { type: 'ready' });
}

function battleState(): NavalBattleState {
  let state = selectLoadouts(createNavalBattle(0));
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

test('loadout phase requires exactly three unique abilities and hides unused enemy choices', () => {
  let state = createNavalBattle();
  assert.equal(state.phase, 'loadout');
  assert.deepEqual(
    validateNavalMove(state, { type: 'selectAbilities', abilities: ['sonarPulse', 'twinSalvo'] }),
    { ok: false, code: 'naval-loadout-size' },
  );
  assert.deepEqual(
    validateNavalMove(state, {
      type: 'selectAbilities',
      abilities: ['sonarPulse', 'sonarPulse', 'twinSalvo'],
    }),
    { ok: false, code: 'naval-loadout-size' },
  );

  state = selectLoadouts(state);
  const view0 = projectNavalState(state, 0);
  const view1 = projectNavalState(state, 1);
  assert.deepEqual(view0.loadouts[0], [...loadout0]);
  assert.deepEqual(view0.loadouts[1], []);
  assert.deepEqual(view1.loadouts[0], []);
  assert.deepEqual(view1.loadouts[1], [...loadout1]);
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
  let state = selectLoadouts(createNavalBattle());
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
  let state = selectLoadouts(createNavalBattle());
  assert.deepEqual(validateNavalMove(state, { type: 'ready' }), {
    ok: false,
    code: 'naval-fleet-incomplete',
  });
  for (const placement of fleet0) state = applyNavalMove(state, { type: 'place', ...placement });
  state = applyNavalMove(state, { type: 'ready' });
  assert.equal(state.ready[0], true);
  assert.equal(state.turn, 1);
});

test('battle begins only after loadouts and both fleets confirm', () => {
  let state = selectLoadouts(createNavalBattle(0));
  state = deploy(state, fleet0);
  assert.equal(state.phase, 'placement');
  state = deploy(state, fleet1);
  assert.equal(state.phase, 'battle');
  assert.equal(state.turn, 0);
});

test('Sonar Pulse returns only a private 3×3 count and consumes its use and turn', () => {
  let state = battleState();
  state = applyNavalMove(state, { type: 'sonarPulse', row: 1, col: 9 });
  assert.equal(state.turn, 1);
  assert.equal(navalAbilityAvailable(state, 0, 'sonarPulse'), false);
  assert.deepEqual(state.privateIntel[0].at(-1), {
    type: 'sonar',
    center: { row: 1, col: 9 },
    count: 3,
    jammed: false,
    atPly: state.ply,
  });

  const enemyView = projectNavalState(state, 1);
  assert.deepEqual(enemyView.privateIntel[0], []);
  assert.deepEqual(enemyView.loadouts[0], ['sonarPulse']);
  assert.deepEqual(enemyView.fleets[0], []);
});

test('Signal Jammer hides its center and blocks overlapping Sonar for two opponent turns', () => {
  let state = battleState();
  state.turn = 1;
  state = applyNavalMove(state, { type: 'signalJammer', row: 1, col: 9 });
  assert.equal(state.turn, 0);
  assert.equal(state.jammers[1]?.opponentTurnsRemaining, 2);

  const opponentView = projectNavalState(state, 0);
  assert.equal(opponentView.jammers[1]?.center, undefined);
  assert.equal(opponentView.jammers[1]?.opponentTurnsRemaining, 2);

  state = applyNavalMove(state, { type: 'sonarPulse', row: 1, col: 9 });
  assert.equal(state.privateIntel[0].at(-1)?.jammed, true);
  assert.equal(state.privateIntel[0].at(-1)?.count, null);
  assert.equal(state.jammers[1]?.opponentTurnsRemaining, 1);

  state = applyNavalMove(state, { type: 'fire', row: 9, col: 9 });
  state = applyNavalMove(state, { type: 'fire', row: 9, col: 8 });
  assert.equal(state.jammers[1], null);
});

test('Twin Salvo fires at two distinct targets and is one-use only', () => {
  let state = battleState();
  state = applyNavalMove(state, {
    type: 'twinSalvo',
    targets: [
      { row: 0, col: 9 },
      { row: 9, col: 9 },
    ],
  });
  assert.equal(state.shots.length, 2);
  assert.deepEqual(state.shots.map((shot) => shot.outcome), ['hit', 'miss']);
  assert.equal(state.turn, 1);
  assert.ok(state.usedAbilities[0].includes('twinSalvo'));

  state.turn = 0;
  assert.deepEqual(
    validateNavalMove(state, {
      type: 'twinSalvo',
      targets: [
        { row: 1, col: 9 },
        { row: 8, col: 8 },
      ],
    }),
    { ok: false, code: 'naval-ability-unavailable' },
  );
});

test('Hunter Protocol opens after a normal hit, can be declined, and later fires one adjacent bonus shot', () => {
  let state = battleState();
  state = applyNavalMove(state, { type: 'fire', row: 0, col: 9 });
  assert.equal(state.turn, 0);
  assert.deepEqual(state.hunterWindow, { player: 0, origin: { row: 0, col: 9 } });

  state = applyNavalMove(state, { type: 'declineHunter' });
  assert.equal(state.turn, 1);
  assert.equal(state.usedAbilities[0].includes('hunterProtocol'), false);

  state = applyNavalMove(state, { type: 'fire', row: 9, col: 9 });
  state = applyNavalMove(state, { type: 'fire', row: 1, col: 9 });
  assert.ok(state.hunterWindow);
  assert.deepEqual(
    validateNavalMove(state, { type: 'hunterFire', row: 5, col: 5 }),
    { ok: false, code: 'naval-hunter-adjacent' },
  );

  state = applyNavalMove(state, { type: 'hunterFire', row: 2, col: 9 });
  assert.equal(state.turn, 1);
  assert.ok(state.usedAbilities[0].includes('hunterProtocol'));
  assert.equal(state.shots.at(-1)?.outcome, 'hit');
});

test('Emergency Repair restores a hit cell and lets the opponent legally target it again', () => {
  let state = battleState();
  state = applyNavalMove(state, { type: 'fire', row: 0, col: 9 });
  state = applyNavalMove(state, { type: 'declineHunter' });
  assert.equal(state.turn, 1);

  state = applyNavalMove(state, { type: 'emergencyRepair', row: 0, col: 9 });
  assert.equal(state.shots[0].repaired, true);
  assert.equal(state.turn, 0);
  assert.equal(validateNavalMove(state, { type: 'fire', row: 0, col: 9 }).ok, true);
});

test('Silent Reposition moves only an untouched ship to a legal previously untargeted position', () => {
  let state = battleState();
  state.turn = 1;
  state = applyNavalMove(state, {
    type: 'silentReposition',
    shipId: 'destroyer',
    row: 7,
    col: 6,
    orientation: 'horizontal',
  });
  const destroyer = state.fleets[1].find((ship) => ship.shipId === 'destroyer');
  assert.deepEqual(destroyer, {
    shipId: 'destroyer',
    row: 7,
    col: 6,
    orientation: 'horizontal',
  });
  assert.ok(state.usedAbilities[1].includes('silentReposition'));
});

test('Silent Reposition rejects a ship that has ever been hit', () => {
  let state = battleState();
  state = applyNavalMove(state, { type: 'fire', row: 0, col: 1 });
  state = applyNavalMove(state, { type: 'declineHunter' });
  state.turn = 1;
  assert.deepEqual(
    validateNavalMove(state, {
      type: 'silentReposition',
      shipId: 'destroyer',
      row: 7,
      col: 6,
      orientation: 'horizontal',
    }),
    { ok: false, code: 'naval-reposition-invalid' },
  );
});

test('a hit and a miss still consume the normal turn when Hunter is unavailable', () => {
  let state = battleState();
  state.loadouts[0] = ['sonarPulse', 'twinSalvo', 'signalJammer'];
  state = applyNavalMove(state, { type: 'fire', row: 0, col: 9 });
  assert.equal(state.turn, 1);
  state = applyNavalMove(state, { type: 'fire', row: 9, col: 9 });
  assert.equal(state.turn, 0);
});

test('duplicate shots and authority-field smuggling are rejected', () => {
  let state = battleState();
  state.loadouts[0] = ['sonarPulse', 'twinSalvo', 'signalJammer'];
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

test('sunk state becomes public only after every active hit cell completes the ship', () => {
  let state = battleState();
  state.loadouts[0] = ['sonarPulse', 'twinSalvo', 'signalJammer'];
  const destroyer = fleet1.find((ship) => ship.shipId === 'destroyer')!;
  const [first, second] = navalPlacementCells(destroyer);

  state = applyNavalMove(state, { type: 'fire', ...first });
  assert.equal(state.shots.at(-1)?.outcome, 'hit');
  assert.equal(state.shots.at(-1)?.sunkCells, undefined);
  state.turn = 0;
  state = applyNavalMove(state, { type: 'fire', ...second });
  assert.equal(state.shots.at(-1)?.outcome, 'sunk');
  assert.deepEqual(state.shots.at(-1)?.sunkCells, navalPlacementCells(destroyer));
});

test('projection is an allowlist for fleets, unused abilities, private intel, and jammer centers', () => {
  let state = battleState();
  state.privateIntel[0].push({
    type: 'sonar',
    center: { row: 4, col: 4 },
    count: 2,
    jammed: false,
    atPly: state.ply,
  });
  state.jammers[1] = { center: { row: 3, col: 3 }, opponentTurnsRemaining: 2 };

  const view0 = projectNavalState(state, 0);
  const view1 = projectNavalState(state, 1);
  assert.deepEqual(view0.fleets[1], []);
  assert.deepEqual(view1.fleets[0], []);
  assert.deepEqual(view0.loadouts[1], []);
  assert.deepEqual(view1.loadouts[0], []);
  assert.equal(view1.privateIntel[0].length, 0);
  assert.equal(view0.jammers[1]?.center, undefined);
  assert.deepEqual(view1.jammers[1]?.center, { row: 3, col: 3 });
});

test('AI selects three abilities from projected state and cannot see hidden enemy fleet geometry', () => {
  let loadoutState = createNavalBattle();
  loadoutState = projectNavalState(loadoutState, 0);
  const loadoutMove = chooseNavalMove(loadoutState, 'hard', { random: () => 0.31 });
  assert.equal(loadoutMove.type, 'selectAbilities');
  if (loadoutMove.type === 'selectAbilities') assert.equal(loadoutMove.abilities.length, 3);

  let first = battleState();
  first.turn = 1;
  first.shots = [
    { shooter: 1, row: 5, col: 5, outcome: 'miss' },
    { shooter: 1, row: 2, col: 2, outcome: 'hit' },
  ];
  const second = structuredClone(first);
  second.fleets[0] = fleet0.map((placement) => ({
    ...placement,
    row: Math.min(
      9 - (placement.orientation === 'vertical' ? navalPlacementCells(placement).length - 1 : 0),
      placement.row + 1,
    ),
  }));
  const viewA = projectNavalState(first, 1);
  const viewB = projectNavalState(second, 1);
  assert.deepEqual(viewA, viewB);
  assert.deepEqual(
    chooseNavalMove(viewA, 'hard', { random: () => 0.31 }),
    chooseNavalMove(viewB, 'hard', { random: () => 0.31 }),
  );
});

test('server online projection never returns opponent fleet or unused opponent loadout', () => {
  const store = new Store();
  const alice = store.createUser('Alice');
  const bob = store.createUser('Bob');
  const service = new MatchService(store, games, { clockMs: 600000 });
  try {
    let match = service.create('navalBattle', [alice.id, bob.id]);
    match = service.command(
      alice.id,
      onlineMove(match, { type: 'selectAbilities', abilities: [...loadout0] }),
    );
    match = service.command(
      bob.id,
      onlineMove(match, { type: 'selectAbilities', abilities: [...loadout1] }),
    );
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
    assert.deepEqual(aliceView.loadouts[1], []);
    assert.deepEqual(bobView.loadouts[0], []);
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

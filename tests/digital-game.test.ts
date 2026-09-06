import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDigital,
  calculateRoundScores,
  projectDigitalState,
  rackPenalty,
  validateDigital,
  validateGroup,
  validateMeld,
  validateRun,
  validateTable,
} from '../packages/games/digital-game/rules.ts';
import {
  createDigitalGame,
  createTileSet,
  shuffleTileIds,
  type DigitalColor,
  type DigitalGameState,
  type DigitalTile,
} from '../packages/games/digital-game/state.ts';

function tile(
  state: DigitalGameState,
  color: DigitalColor,
  value: number,
  copyIndex: 0 | 1 = 0,
): string {
  const found = Object.values(state.tiles).find(
    (item) => !item.isJoker && item.color === color && item.value === value && item.copyIndex === copyIndex,
  );
  assert.ok(found, `missing ${color} ${value} copy ${copyIndex}`);
  return found.id;
}

function joker(state: DigitalGameState, index = 0): string {
  const found = Object.values(state.tiles).filter((item) => item.isJoker)[index];
  assert.ok(found);
  return found.id;
}

function tiles(state: DigitalGameState, ids: string[]): DigitalTile[] {
  return ids.map((id) => state.tiles[id]);
}

function fixture(rack0: string[], rack1: string[] = []): DigitalGameState {
  const state = createDigitalGame(12345);
  state.racks = [[...rack0], [...rack1]];
  state.rackCounts = [rack0.length, rack1.length];
  state.drawPool = [];
  state.table = [];
  state.turn = 0;
  state.ply = 0;
  state.winner = null;
  state.drawReason = null;
  state.hasCompletedInitialMeld = [false, false];
  state.scores = [0, 0];
  return state;
}

test('Digital Game creates exactly 106 unique tiles and deals 14 each', () => {
  const list = createTileSet();
  assert.equal(list.length, 106);
  assert.equal(new Set(list.map((item) => item.id)).size, 106);
  assert.equal(list.filter((item) => item.isJoker).length, 2);
  assert.equal(list.filter((item) => !item.isJoker).length, 104);
  const state = createDigitalGame(7);
  assert.equal(state.racks[0].length, 14);
  assert.equal(state.racks[1].length, 14);
  assert.equal(state.drawPool.length, 78);
  assert.equal(new Set([...state.racks[0], ...state.racks[1], ...state.drawPool]).size, 106);
});

test('seeded shuffle is deterministic and changes with seed', () => {
  const ids = createTileSet().map((item) => item.id);
  assert.deepEqual(shuffleTileIds(ids, 42), shuffleTileIds(ids, 42));
  assert.notDeepEqual(shuffleTileIds(ids, 42), shuffleTileIds(ids, 43));
});

test('groups require 3-4 same-value tiles of unique colors', () => {
  const s = createDigitalGame(1);
  assert.equal(validateGroup(tiles(s, [tile(s, 'red', 7), tile(s, 'blue', 7), tile(s, 'black', 7)])).ok, true);
  assert.equal(
    validateGroup(
      tiles(s, [tile(s, 'red', 7), tile(s, 'blue', 7), tile(s, 'black', 7), tile(s, 'orange', 7)]),
    ).ok,
    true,
  );
  assert.equal(validateGroup(tiles(s, [tile(s, 'red', 7), tile(s, 'blue', 7)])).ok, false);
  assert.equal(
    validateGroup(
      tiles(s, [
        tile(s, 'red', 7, 0),
        tile(s, 'red', 7, 1),
        tile(s, 'blue', 7),
      ]),
    ).ok,
    false,
  );
  assert.equal(validateGroup(tiles(s, [tile(s, 'red', 7), tile(s, 'blue', 8), tile(s, 'black', 7)])).ok, false);
});

test('runs require ordered consecutive numbers in one color with no wraparound', () => {
  const s = createDigitalGame(1);
  assert.equal(validateRun(tiles(s, [tile(s, 'blue', 4), tile(s, 'blue', 5), tile(s, 'blue', 6)])).ok, true);
  assert.equal(
    validateRun(tiles(s, [tile(s, 'blue', 8), tile(s, 'blue', 9), tile(s, 'blue', 10), tile(s, 'blue', 11), tile(s, 'blue', 12)])).ok,
    true,
  );
  assert.equal(validateRun(tiles(s, [tile(s, 'blue', 4), tile(s, 'red', 5), tile(s, 'blue', 6)])).ok, false);
  assert.equal(validateRun(tiles(s, [tile(s, 'blue', 4), tile(s, 'blue', 6), tile(s, 'blue', 7)])).ok, false);
  assert.equal(validateRun(tiles(s, [tile(s, 'blue', 1), tile(s, 'blue', 2), tile(s, 'blue', 3)])).ok, true);
  assert.equal(validateRun(tiles(s, [tile(s, 'blue', 12), tile(s, 'blue', 13), tile(s, 'blue', 1)])).ok, false);
  assert.equal(
    validateRun(tiles(s, [tile(s, 'blue', 5, 0), tile(s, 'blue', 5, 1), tile(s, 'blue', 6)])).ok,
    false,
  );
});

test('jokers resolve inside runs and groups', () => {
  const s = createDigitalGame(1);
  const j = joker(s);
  const end = validateRun(tiles(s, [tile(s, 'red', 5), tile(s, 'red', 6), j]));
  assert.equal(end.ok, true);
  if (end.ok) assert.deepEqual(end.representedValues, [5, 6, 7]);
  const middle = validateRun(tiles(s, [tile(s, 'red', 5), j, tile(s, 'red', 7)]));
  assert.equal(middle.ok, true);
  if (middle.ok) assert.deepEqual(middle.representedValues, [5, 6, 7]);
  assert.equal(validateGroup(tiles(s, [tile(s, 'red', 9), tile(s, 'blue', 9), j])).ok, true);
  assert.equal(validateMeld(tiles(s, [j, joker(s, 1), tile(s, 'blue', 5)])).ok, true);
});

test('initial meld rejects 29, accepts 30 and 31+ points', () => {
  const base = createDigitalGame(5);
  const group29 = [
    tile(base, 'red', 5),
    tile(base, 'blue', 5),
    tile(base, 'orange', 5),
    tile(base, 'black', 5),
  ];
  const run29 = [tile(base, 'red', 2), tile(base, 'red', 3), tile(base, 'red', 4)];
  const s29 = fixture([...group29, ...run29]);
  s29.tiles = base.tiles;
  assert.deepEqual(validateDigital(s29, { type: 'commit', table: [{ tiles: group29 }, { tiles: run29 }] }), {
    ok: false,
    code: 'initial-meld-30',
  });

  const run30 = [tile(base, 'blue', 9), tile(base, 'blue', 10), tile(base, 'blue', 11)];
  const s30 = fixture(run30);
  s30.tiles = base.tiles;
  assert.equal(validateDigital(s30, { type: 'commit', table: [{ tiles: run30 }] }).ok, true);
  const after30 = applyDigital(s30, { type: 'commit', table: [{ tiles: run30 }] });
  assert.equal(after30.hasCompletedInitialMeld[0], true);

  const group31 = [
    tile(base, 'red', 4, 1),
    tile(base, 'blue', 4),
    tile(base, 'orange', 4),
    tile(base, 'black', 4),
  ];
  const run31 = [tile(base, 'red', 4), tile(base, 'red', 5), tile(base, 'red', 6)];
  const s31 = fixture([...group31, ...run31]);
  s31.tiles = base.tiles;
  assert.equal(validateDigital(s31, { type: 'commit', table: [{ tiles: group31 }, { tiles: run31 }] }).ok, true);
});

test('initial meld cannot manipulate or count existing table tiles', () => {
  const s = createDigitalGame(10);
  const old = [tile(s, 'blue', 10), tile(s, 'blue', 11), tile(s, 'blue', 12)];
  const own = [tile(s, 'red', 1), tile(s, 'red', 2), tile(s, 'red', 3)];
  s.table = [{ id: 'old', tiles: old, type: 'run' }];
  s.racks = [[...own], []];
  s.rackCounts = [own.length, 0];
  s.drawPool = [];
  s.turn = 0;
  assert.deepEqual(
    validateDigital(s, {
      type: 'commit',
      table: [
        { id: 'old', tiles: old },
        { tiles: own },
      ],
    }),
    { ok: false, code: 'initial-meld-30' },
  );
  assert.deepEqual(
    validateDigital(s, {
      type: 'commit',
      table: [{ tiles: [...old, own[0]] }],
    }),
    { ok: false, code: 'run-color' },
  );
});

test('whole-table validation rejects taking a tile that breaks its original run', () => {
  const s = createDigitalGame(20);
  const blue3 = tile(s, 'blue', 3), blue4 = tile(s, 'blue', 4), blue5 = tile(s, 'blue', 5), blue6 = tile(s, 'blue', 6);
  const red4 = tile(s, 'red', 4), black4 = tile(s, 'black', 4);
  s.table = [{ id: 'run', tiles: [blue3, blue4, blue5, blue6], type: 'run' }];
  s.racks = [[red4, black4], []];
  s.rackCounts = [2, 0];
  s.drawPool = [];
  s.turn = 0;
  s.hasCompletedInitialMeld = [true, true];
  const result = validateDigital(s, {
    type: 'commit',
    table: [
      { id: 'run', tiles: [blue3, blue5, blue6] },
      { tiles: [red4, blue4, black4] },
    ],
  });
  assert.equal(result.ok, false);
});

test('tile may leave a four-tile group when the remaining group stays valid', () => {
  const s = createDigitalGame(21);
  const red5 = tile(s, 'red', 5), blue5 = tile(s, 'blue', 5), black5 = tile(s, 'black', 5), orange5 = tile(s, 'orange', 5);
  const blue3 = tile(s, 'blue', 3), blue4 = tile(s, 'blue', 4);
  s.table = [{ id: 'group', tiles: [red5, blue5, black5, orange5], type: 'group' }];
  s.racks = [[blue3, blue4], []];
  s.rackCounts = [2, 0];
  s.drawPool = [];
  s.turn = 0;
  s.hasCompletedInitialMeld = [true, true];
  assert.equal(
    validateDigital(s, {
      type: 'commit',
      table: [
        { id: 'group', tiles: [red5, black5, orange5] },
        { tiles: [blue3, blue4, blue5] },
      ],
    }).ok,
    true,
  );
});

test('a long run can be split while playing a rack tile', () => {
  const s = createDigitalGame(22);
  const run = [1, 2, 3, 4, 5, 6].map((value) => tile(s, 'red', value));
  const seven = tile(s, 'red', 7);
  s.table = [{ id: 'long', tiles: run, type: 'run' }];
  s.racks = [[seven], []];
  s.rackCounts = [1, 0];
  s.drawPool = [];
  s.turn = 0;
  s.hasCompletedInitialMeld = [true, true];
  assert.equal(
    validateDigital(s, {
      type: 'commit',
      table: [
        { tiles: run.slice(0, 3) },
        { tiles: [...run.slice(3), seven] },
      ],
    }).ok,
    true,
  );
});

test('retrieved joker must remain legally assigned on the table in the same turn', () => {
  const s = createDigitalGame(23);
  const j = joker(s);
  const b5 = tile(s, 'blue', 5), b6 = tile(s, 'blue', 6), b7 = tile(s, 'blue', 7);
  const r9 = tile(s, 'red', 9), b9 = tile(s, 'blue', 9);
  s.table = [{ id: 'joker-run', tiles: [b5, j, b7], type: 'run' }];
  s.racks = [[b6, r9, b9], []];
  s.rackCounts = [3, 0];
  s.drawPool = [];
  s.turn = 0;
  s.hasCompletedInitialMeld = [true, true];
  assert.equal(
    validateDigital(s, {
      type: 'commit',
      table: [
        { id: 'joker-run', tiles: [b5, b6, b7] },
        { tiles: [r9, b9, j] },
      ],
    }).ok,
    true,
  );
  assert.deepEqual(
    validateDigital(s, {
      type: 'commit',
      table: [{ id: 'joker-run', tiles: [b5, b6, b7] }],
    }),
    { ok: false, code: 'table-tile-missing' },
  );
});

test('draw takes one tile, makes it unavailable until the next turn, and ends turn', () => {
  const s = createDigitalGame(30);
  const draw = tile(s, 'orange', 13);
  s.racks = [[], []];
  s.rackCounts = [0, 0];
  s.drawPool = [draw];
  s.turn = 0;
  const next = applyDigital(s, { type: 'draw' });
  assert.deepEqual(next.racks[0], [draw]);
  assert.equal(next.drawPool.length, 0);
  assert.equal(next.turn, 1);
  assert.equal(next.ply, 1);
});

test('two empty-pool passes end a blocked round by lowest rack penalty', () => {
  const s = createDigitalGame(31);
  const low = tile(s, 'red', 3), high = tile(s, 'blue', 9);
  s.racks = [[low], [high]];
  s.rackCounts = [1, 1];
  s.drawPool = [];
  s.turn = 0;
  const one = applyDigital(s, { type: 'draw' });
  assert.equal(one.winner, null);
  const two = applyDigital(one, { type: 'draw' });
  assert.equal(two.winner, 0);
});

test('empty rack after a valid commit wins and scores the opponent rack', () => {
  const s = createDigitalGame(32);
  const winningRun = [tile(s, 'red', 9), tile(s, 'red', 10), tile(s, 'red', 11)];
  const opponentRack = [tile(s, 'blue', 3), tile(s, 'blue', 7), tile(s, 'blue', 11), joker(s)];
  s.racks = [[...winningRun], [...opponentRack]];
  s.rackCounts = [3, 4];
  s.drawPool = [];
  s.turn = 0;
  const next = applyDigital(s, { type: 'commit', table: [{ tiles: winningRun }] });
  assert.equal(next.winner, 0);
  assert.deepEqual(next.scores, [51, -51]);
  assert.equal(rackPenalty(next, 1), 51);
  assert.deepEqual(calculateRoundScores(next, 0), [51, -51]);
});

test('table validator rejects duplicate tile IDs across melds', () => {
  const s = createDigitalGame(40);
  const a = tile(s, 'red', 7), b = tile(s, 'blue', 7), c = tile(s, 'black', 7);
  assert.deepEqual(
    validateTable(s, [
      { tiles: [a, b, c] },
      { tiles: [a, tile(s, 'red', 8), tile(s, 'red', 9)] },
    ]),
    { ok: false, code: 'duplicate-tile' },
  );
});

test('online projection exposes only viewer rack, public table and hidden counts', () => {
  const s = createDigitalGame(50);
  const publicRun = [tile(s, 'red', 1), tile(s, 'red', 2), tile(s, 'red', 3)];
  const own = [tile(s, 'blue', 5), tile(s, 'blue', 6)];
  const other = [tile(s, 'black', 8), tile(s, 'orange', 9)];
  const hiddenDraw = tile(s, 'black', 13);
  s.table = [{ id: 'public', tiles: publicRun, type: 'run' }];
  s.racks = [[...own], [...other]];
  s.rackCounts = [2, 2];
  s.drawPool = [hiddenDraw];
  const view = projectDigitalState(s, 0);
  assert.deepEqual(view.racks[0], own);
  assert.equal(view.racks[1].length, 2);
  assert.ok(view.racks[1].every((id) => id.startsWith('hidden-rack-1-')));
  assert.equal(view.drawPool.length, 1);
  assert.ok(view.drawPool[0].startsWith('hidden-draw-'));
  for (const id of [...own, ...publicRun]) assert.ok(view.tiles[id]);
  for (const id of [...other, hiddenDraw]) assert.equal(view.tiles[id], undefined);
});

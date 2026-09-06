import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyClassicDigital,
  validateClassicDigital,
  type ClassicDigitalGameMove,
} from '../packages/games/digital-game/classic-engine.ts';
import {
  createDigitalGame,
  type DigitalColor,
  type DigitalGameState,
  type DigitalMeld,
} from '../packages/games/digital-game/state.ts';

function tile(
  state: DigitalGameState,
  color: DigitalColor,
  value: number,
  copyIndex: 0 | 1 = 0,
): string {
  const found = Object.values(state.tiles).find(
    (item) =>
      !item.isJoker &&
      item.color === color &&
      item.value === value &&
      item.copyIndex === copyIndex,
  );
  assert.ok(found, `missing ${color} ${value} copy ${copyIndex}`);
  return found.id;
}

function joker(state: DigitalGameState, index = 0): string {
  const found = Object.values(state.tiles).filter((item) => item.isJoker)[index];
  assert.ok(found, `missing joker ${index}`);
  return found.id;
}

function prepare(
  state: DigitalGameState,
  rack: string[],
  table: DigitalMeld[],
  opened = true,
): DigitalGameState {
  state.racks = [[...rack], []];
  state.rackCounts = [rack.length, 0];
  state.drawPool = [];
  state.table = table.map((meld) => ({ ...meld, tiles: [...meld.tiles] }));
  state.turn = 0;
  state.ply = 0;
  state.winner = null;
  state.drawReason = null;
  state.hasCompletedInitialMeld = [opened, true];
  state.scores = [0, 0];
  state.emptyPoolPasses = 0;
  return state;
}

function commit(table: { id?: string; tiles: string[] }[]): ClassicDigitalGameMove {
  return { type: 'commit', table };
}

test('Classic joker: direct run replacement from rack and same-turn reuse in a new set is legal', () => {
  const s = createDigitalGame(701);
  const j = joker(s),
    b5 = tile(s, 'blue', 5),
    b6 = tile(s, 'blue', 6),
    b7 = tile(s, 'blue', 7),
    r9 = tile(s, 'red', 9),
    k9 = tile(s, 'black', 9);
  prepare(s, [b6, r9, k9], [{ id: 'source', tiles: [b5, j, b7], type: 'run' }]);

  const move = commit([
    { id: 'source', tiles: [b5, b6, b7] },
    { id: 'joker-new', tiles: [r9, k9, j] },
  ]);
  assert.deepEqual(validateClassicDigital(s, move), { ok: true });

  const next = applyClassicDigital(s, move);
  assert.equal(next.racks[0].length, 0);
  assert.ok(next.table.some((meld) => meld.tiles.includes(j)));
});

test('Classic joker: a three-tile group may replace the joker with either missing color', () => {
  for (const replacementColor of ['black', 'orange'] as const) {
    const s = createDigitalGame(replacementColor === 'black' ? 702 : 703);
    const j = joker(s),
      r3 = tile(s, 'red', 3),
      b3 = tile(s, 'blue', 3),
      replacement = tile(s, replacementColor, 3),
      r8 = tile(s, 'red', 8),
      b8 = tile(s, 'blue', 8);
    prepare(s, [replacement, r8, b8], [{ id: 'source', tiles: [r3, b3, j], type: 'group' }]);

    assert.deepEqual(
      validateClassicDigital(
        s,
        commit([
          { id: 'source', tiles: [r3, b3, replacement] },
          { id: 'joker-new', tiles: [r8, b8, j] },
        ]),
      ),
      { ok: true },
    );
  }
});

test('Classic joker: replacement material may come from another table set', () => {
  const s = createDigitalGame(704);
  const j = joker(s),
    b5 = tile(s, 'blue', 5),
    b6 = tile(s, 'blue', 6),
    b7 = tile(s, 'blue', 7),
    r6 = tile(s, 'red', 6),
    o6 = tile(s, 'orange', 6),
    k6 = tile(s, 'black', 6),
    r9 = tile(s, 'red', 9),
    k9 = tile(s, 'black', 9);
  prepare(
    s,
    [r9, k9],
    [
      { id: 'source', tiles: [b5, j, b7], type: 'run' },
      { id: 'donor', tiles: [r6, o6, k6, b6], type: 'group' },
    ],
  );

  assert.deepEqual(
    validateClassicDigital(
      s,
      commit([
        { id: 'source', tiles: [b5, b6, b7] },
        { id: 'donor', tiles: [r6, o6, k6] },
        { id: 'joker-new', tiles: [r9, k9, j] },
      ]),
    ),
    { ok: true },
  );
});

test('Classic joker: splitting a run may clear the joker when all resulting sets stay legal', () => {
  const s = createDigitalGame(705);
  const j = joker(s),
    r1 = tile(s, 'red', 1),
    r2 = tile(s, 'red', 2),
    r3 = tile(s, 'red', 3),
    r5 = tile(s, 'red', 5),
    r6 = tile(s, 'red', 6),
    r7 = tile(s, 'red', 7),
    b10 = tile(s, 'blue', 10),
    k10 = tile(s, 'black', 10);
  prepare(s, [r1, r7, b10, k10], [{ id: 'source', tiles: [r2, r3, j, r5, r6], type: 'run' }]);

  assert.deepEqual(
    validateClassicDigital(
      s,
      commit([
        { tiles: [r1, r2, r3] },
        { tiles: [r5, r6, r7] },
        { tiles: [b10, k10, j] },
      ]),
    ),
    { ok: true },
  );
});

test('Classic joker: a player cannot retrieve or manipulate a table joker before completing the initial meld', () => {
  const s = createDigitalGame(706);
  const j = joker(s),
    b5 = tile(s, 'blue', 5),
    b6 = tile(s, 'blue', 6),
    b7 = tile(s, 'blue', 7),
    r9 = tile(s, 'red', 9),
    k9 = tile(s, 'black', 9);
  prepare(s, [b6, r9, k9], [{ id: 'source', tiles: [b5, j, b7], type: 'run' }], false);

  assert.deepEqual(
    validateClassicDigital(
      s,
      commit([
        { id: 'source', tiles: [b5, b6, b7] },
        { tiles: [r9, k9, j] },
      ]),
    ),
    { ok: false, code: 'joker-before-initial-meld' },
  );
});

test('Classic joker: a retrieved joker cannot disappear from the table for later use', () => {
  const s = createDigitalGame(707);
  const j = joker(s),
    b5 = tile(s, 'blue', 5),
    b6 = tile(s, 'blue', 6),
    b7 = tile(s, 'blue', 7),
    r9 = tile(s, 'red', 9),
    b9 = tile(s, 'blue', 9),
    k9 = tile(s, 'black', 9);
  prepare(s, [b6, r9, b9, k9], [{ id: 'source', tiles: [b5, j, b7], type: 'run' }]);

  assert.deepEqual(
    validateClassicDigital(
      s,
      commit([
        { id: 'source', tiles: [b5, b6, b7] },
        { tiles: [r9, b9, k9] },
      ]),
    ),
    { ok: false, code: 'joker-must-be-reused' },
  );
});

test('Classic joker: retrieval requires at least one tile from the acting rack that turn', () => {
  const s = createDigitalGame(708);
  const j = joker(s),
    b5 = tile(s, 'blue', 5),
    b6 = tile(s, 'blue', 6),
    b7 = tile(s, 'blue', 7),
    r6 = tile(s, 'red', 6),
    o6 = tile(s, 'orange', 6),
    k6 = tile(s, 'black', 6),
    r1 = tile(s, 'red', 1),
    r2 = tile(s, 'red', 2),
    r3 = tile(s, 'red', 3),
    r4 = tile(s, 'red', 4),
    r5 = tile(s, 'red', 5),
    unused = tile(s, 'orange', 12);
  prepare(
    s,
    [unused],
    [
      { id: 'source', tiles: [b5, j, b7], type: 'run' },
      { id: 'group6', tiles: [r6, o6, k6, b6], type: 'group' },
      { id: 'run', tiles: [r1, r2, r3, r4, r5], type: 'run' },
    ],
  );

  assert.deepEqual(
    validateClassicDigital(
      s,
      commit([
        { tiles: [b5, b6, b7] },
        { tiles: [r6, o6, k6] },
        { tiles: [r3, r4, r5] },
        { tiles: [r1, r2, j] },
      ]),
    ),
    { ok: false, code: 'joker-rack-tile-required' },
  );
});

test('Classic joker: a retrieved joker cannot merely extend an unchanged pre-existing set', () => {
  const s = createDigitalGame(709);
  const j = joker(s),
    b5 = tile(s, 'blue', 5),
    b6 = tile(s, 'blue', 6),
    b7 = tile(s, 'blue', 7),
    r1 = tile(s, 'red', 1),
    r2 = tile(s, 'red', 2),
    r3 = tile(s, 'red', 3),
    o9 = tile(s, 'orange', 9),
    b9 = tile(s, 'blue', 9),
    k9 = tile(s, 'black', 9);
  prepare(
    s,
    [b6, o9, b9, k9],
    [
      { id: 'source', tiles: [b5, j, b7], type: 'run' },
      { id: 'existing', tiles: [r1, r2, r3], type: 'run' },
    ],
  );

  assert.deepEqual(
    validateClassicDigital(
      s,
      commit([
        { id: 'source', tiles: [b5, b6, b7] },
        { id: 'existing', tiles: [r1, r2, r3, j] },
        { tiles: [o9, b9, k9] },
      ]),
    ),
    { ok: false, code: 'joker-new-set-required' },
  );
});

test('Classic joker: a new joker set may be formed by repartitioning table tiles while using a rack tile elsewhere', () => {
  const s = createDigitalGame(710);
  const j = joker(s),
    b5 = tile(s, 'blue', 5),
    b6 = tile(s, 'blue', 6),
    b7 = tile(s, 'blue', 7),
    r1 = tile(s, 'red', 1),
    r2 = tile(s, 'red', 2),
    r3 = tile(s, 'red', 3),
    r4 = tile(s, 'red', 4),
    r5 = tile(s, 'red', 5);
  prepare(
    s,
    [b6],
    [
      { id: 'source', tiles: [b5, j, b7], type: 'run' },
      { id: 'donor', tiles: [r1, r2, r3, r4, r5], type: 'run' },
    ],
  );

  assert.deepEqual(
    validateClassicDigital(
      s,
      commit([
        { tiles: [b5, b6, b7] },
        { tiles: [r3, r4, r5] },
        { tiles: [r1, r2, j] },
      ]),
    ),
    { ok: true },
  );
});

test('Classic joker: invalid replacement or invalid joker destination cannot be committed', () => {
  const badSource = createDigitalGame(711);
  const j1 = joker(badSource),
    b5 = tile(badSource, 'blue', 5),
    b7 = tile(badSource, 'blue', 7),
    b8 = tile(badSource, 'blue', 8),
    r9 = tile(badSource, 'red', 9),
    k9 = tile(badSource, 'black', 9);
  prepare(badSource, [b8, r9, k9], [{ id: 'source', tiles: [b5, j1, b7], type: 'run' }]);
  assert.equal(
    validateClassicDigital(
      badSource,
      commit([
        { tiles: [b5, b8, b7] },
        { tiles: [r9, k9, j1] },
      ]),
    ).ok,
    false,
  );

  const badDestination = createDigitalGame(712);
  const j2 = joker(badDestination),
    bb5 = tile(badDestination, 'blue', 5),
    bb6 = tile(badDestination, 'blue', 6),
    bb7 = tile(badDestination, 'blue', 7),
    rr9 = tile(badDestination, 'red', 9),
    bb10 = tile(badDestination, 'blue', 10);
  prepare(badDestination, [bb6, rr9, bb10], [{ id: 'source', tiles: [bb5, j2, bb7], type: 'run' }]);
  assert.equal(
    validateClassicDigital(
      badDestination,
      commit([
        { tiles: [bb5, bb6, bb7] },
        { tiles: [rr9, bb10, j2] },
      ]),
    ).ok,
    false,
  );
});

test('Classic joker: a joker set may be extended or have tiles removed when the final table remains legal', () => {
  const extend = createDigitalGame(713);
  const j1 = joker(extend),
    b5 = tile(extend, 'blue', 5),
    b7 = tile(extend, 'blue', 7),
    b8 = tile(extend, 'blue', 8);
  prepare(extend, [b8], [{ id: 'joker-run', tiles: [b5, j1, b7], type: 'run' }]);
  assert.deepEqual(
    validateClassicDigital(extend, commit([{ id: 'joker-run', tiles: [b5, j1, b7, b8] }])),
    { ok: true },
  );

  const shrink = createDigitalGame(714);
  const j2 = joker(shrink),
    bb5 = tile(shrink, 'blue', 5),
    bb7 = tile(shrink, 'blue', 7),
    bb8 = tile(shrink, 'blue', 8),
    bb9 = tile(shrink, 'blue', 9),
    bb10 = tile(shrink, 'blue', 10);
  prepare(shrink, [bb9, bb10], [{ id: 'joker-run', tiles: [bb5, j2, bb7, bb8], type: 'run' }]);
  assert.deepEqual(
    validateClassicDigital(
      shrink,
      commit([
        { id: 'joker-run', tiles: [bb5, j2, bb7] },
        { tiles: [bb8, bb9, bb10] },
      ]),
    ),
    { ok: true },
  );
});

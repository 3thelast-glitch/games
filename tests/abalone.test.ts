import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAbalone,
  abaloneLegalMoves,
  validateAbalone,
  parseAbaloneMove,
} from '../packages/games/abalone/rules.ts';
import {
  createAbalone,
  DIRECTIONS,
  HEXES,
  hexKey,
  onBoard,
  type AbaloneState,
  type Hex,
} from '../packages/games/abalone/state.ts';
import { abaloneAI } from '../packages/games/abalone/ai.ts';
function fixture(own: Hex[], other: Hex[]): AbaloneState {
  const state = createAbalone();
  state.board = {};
  own.forEach((p, i) => (state.board[hexKey(p)] = { owner: 0, id: `b${i}` }));
  other.forEach((p, i) => (state.board[hexKey(p)] = { owner: 1, id: `w${i}` }));
  return state;
}
test('standard board has 61 holes, 14 marbles each and black starts', () => {
  const s = createAbalone();
  assert.equal(HEXES.length, 61);
  for (const p of [0, 1])
    assert.equal(Object.values(s.board).filter((m) => m.owner === p).length, 14);
  assert.equal(s.turn, 0);
  assert.equal(s.winner, null);
});
for (let direction = 0; direction < 6; direction++) {
  const d = DIRECTIONS[direction],
    at = (n: number): Hex => [n * d[0], n * d[1]];
  for (const size of [1, 2, 3])
    test(`inline ${size} marbles in direction ${direction}`, () => {
      const group = Array.from({ length: size }, (_, i) => at(i - 1));
      const s = fixture(group, []),
        copy = structuredClone(s);
      const next = applyAbalone(s, { marbles: group, direction });
      assert.deepEqual(s, copy);
      assert.equal(next.turn, 1);
      assert.equal(next.ply, 1);
      for (let i = 0; i < size; i++) assert.equal(next.board[hexKey(at(i))].id, `b${i}`);
    });
  for (const [a, b] of [
    [2, 1],
    [3, 1],
    [3, 2],
  ])
    test(`sumito ${a} vs ${b} direction ${direction}`, () => {
      const own = Array.from({ length: a }, (_, i) => at(i - 2)),
        other = Array.from({ length: b }, (_, i) => at(a - 2 + i));
      const s = fixture(own, other),
        next = applyAbalone(s, { marbles: own, direction });
      assert.equal(Object.keys(next.board).length, a + b);
      assert.equal(next.board[hexKey(at(a + b - 2))].owner, 1);
    });
  test(`ejection and sixth capture wins at edge ${direction}`, () => {
    const own = [at(1), at(2), at(3)],
      s = fixture(own, [at(4)]);
    s.captured = [5, 0];
    const next = applyAbalone(s, { marbles: own, direction });
    assert.equal(next.captured[0], 6);
    assert.equal(next.winner, 0);
    assert.equal(next.lastMove.filter((m) => m.ejected).length, 1);
    assert.equal(abaloneLegalMoves(next).length, 0);
    assert.ok(next.lastMove.some((m) => m.ejected && !onBoard(m.to)));
  });
  test(`cannot move own marble off edge ${direction}`, () => {
    assert.equal(validateAbalone(fixture([at(4)], []), { marbles: [at(4)], direction }).ok, false);
  });
}
for (const size of [1, 2, 3])
  test(`equal strength ${size} vs ${size} cannot push`, () => {
    const own = Array.from({ length: size }, (_, i): Hex => [i - 3, 0]),
      other = Array.from({ length: size }, (_, i): Hex => [i + size - 3, 0]);
    assert.equal(validateAbalone(fixture(own, other), { marbles: own, direction: 0 }).ok, false);
  });
test('three can eject one of two opponents, and the other stays on board', () => {
  const s = fixture(
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [3, 0],
      [4, 0],
    ],
  );
  const next = applyAbalone(s, {
    marbles: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    direction: 0,
  });
  assert.deepEqual(next.captured, [1, 0]);
  assert.equal(next.board['4,0'].id, 'w0');
  assert.equal(Object.keys(next.board).length, 4);
});
test('a fourth friendly marble behind the selected trio does not move', () => {
  const next = applyAbalone(
    fixture(
      [
        [-2, 0],
        [-1, 0],
        [0, 0],
        [1, 0],
      ],
      [
        [2, 0],
        [3, 0],
      ],
    ),
    {
      marbles: [
        [-1, 0],
        [0, 0],
        [1, 0],
      ],
      direction: 0,
    },
  );
  assert.equal(next.board['-2,0'].id, 'b0');
  assert.equal(next.board['4,0'].owner, 1);
});
test('sidestep moves all selected marbles and cannot push', () => {
  const own: Hex[] = [
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
    s = fixture(own, []);
  assert.ok(validateAbalone(s, { marbles: own, direction: 1 }).ok);
  assert.equal(applyAbalone(s, { marbles: own, direction: 1 }).board['0,1'].owner, 0);
  s.board['0,1'] = { owner: 1, id: 'opponent' };
  assert.equal(validateAbalone(s, { marbles: own, direction: 1 }).ok, false);
});
test('push fails when a friendly marble blocks the far end', () => {
  assert.equal(
    validateAbalone(
      fixture(
        [
          [-1, 0],
          [0, 0],
          [2, 0],
        ],
        [[1, 0]],
      ),
      {
        marbles: [
          [-1, 0],
          [0, 0],
        ],
        direction: 0,
      },
    ).ok,
    false,
  );
});
test('invalid selections, gaps, bends, duplicates, foreign pieces and malformed inputs are rejected', () => {
  const s = fixture(
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ],
    [[0, -1]],
  );
  for (const marbles of [
    [],
    [
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [2, 0],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [[0, -1]],
    [[3, 0]],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ],
  ] as Hex[][])
    assert.equal(validateAbalone(s, { marbles, direction: 0 }).ok, false);
  for (const input of [
    null,
    {},
    { marbles: [[0.5, 0]], direction: 0 },
    { marbles: [[0, 0]], direction: 6 },
    { marbles: [[0, 0]], direction: 0, winner: 0 },
  ])
    assert.throws(() => parseAbaloneMove(input));
});
test('seeded legal playout preserves identities, ownership and 28 total marbles', () => {
  let s = createAbalone(),
    seed = 19;
  for (let i = 0; i < 100 && s.winner === null; i++) {
    const moves = abaloneLegalMoves(s);
    assert.ok(moves.length > 0);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    s = applyAbalone(s, moves[seed % moves.length]);
    assert.equal(Object.keys(s.board).length + s.captured[0] + s.captured[1], 28);
    assert.equal(
      new Set(Object.values(s.board).map((m) => m.id)).size,
      Object.keys(s.board).length,
    );
    assert.ok(
      Object.keys(s.board).every((k) => onBoard(k.split(',').map(Number) as [number, number])),
    );
  }
});
test('each AI difficulty produces a legal move, medium and hard take an immediate win', () => {
  const s = fixture(
    [
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    [[4, 0]],
  );
  s.captured = [5, 0];
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const m = abaloneAI(s, difficulty, { random: () => 0, budgetMs: 40 });
    assert.ok(m);
    assert.ok(validateAbalone(s, m).ok);
    if (difficulty !== 'easy') assert.equal(applyAbalone(s, m).winner, 0);
  }
});

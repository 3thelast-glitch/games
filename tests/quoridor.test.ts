import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyQuoridor,
  pawnTargets,
  edgeBlocked,
  shortestPath,
  wallValidation,
  quoridorLegalMoves,
  parseQuoridorMove,
} from '../packages/games/quoridor/rules.ts';
import { createQuoridor, type Square, type Wall } from '../packages/games/quoridor/state.ts';
import { quoridorAI } from '../packages/games/quoridor/ai.ts';
const includes = (points: Square[], p: Square) =>
  points.some((x) => x[0] === p[0] && x[1] === p[1]);
test('9 by 9 board starts at center edges with 10 walls per player', () => {
  const s = createQuoridor();
  assert.deepEqual(s.pawns, [
    [8, 4],
    [0, 4],
  ]);
  assert.deepEqual(s.remaining, [10, 10]);
  assert.equal(shortestPath(s, 0).length, 9);
  assert.equal(pawnTargets(s).length, 3);
  assert.equal(quoridorLegalMoves(s).length, 131);
});
test('normal moves are orthogonal and one square', () => {
  const s = createQuoridor();
  s.pawns[0] = [4, 4];
  assert.deepEqual(pawnTargets(s), [
    [3, 4],
    [5, 4],
    [4, 3],
    [4, 5],
  ]);
  assert.throws(() => applyQuoridor(s, { kind: 'pawn', to: [3, 3] }));
  assert.throws(() => applyQuoridor(s, { kind: 'pawn', to: [2, 4] }));
});
for (const [dr, dc] of [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
])
  test(`straight jump ${dr},${dc} without optional diagonal`, () => {
    const s = createQuoridor();
    s.pawns = [
      [4, 4],
      [4 + dr, 4 + dc],
    ];
    const targets = pawnTargets(s);
    assert.ok(includes(targets, [4 + 2 * dr, 4 + 2 * dc]));
    assert.ok(!includes(targets, s.pawns[1]));
    assert.equal(targets.length, 4);
  });
test('wall behind adjacent pawn permits two sideways jumps', () => {
  const s = createQuoridor();
  s.pawns = [
    [4, 4],
    [3, 4],
  ];
  s.walls = [{ row: 2, col: 4, orientation: 'h', owner: 1 }];
  const targets = pawnTargets(s);
  assert.ok(!includes(targets, [2, 4]));
  assert.ok(includes(targets, [3, 3]));
  assert.ok(includes(targets, [3, 5]));
});
test('board edge behind pawn also permits side jumps', () => {
  const s = createQuoridor();
  s.pawns = [
    [1, 4],
    [0, 4],
  ];
  assert.ok(includes(pawnTargets(s), [0, 3]));
  assert.ok(includes(pawnTargets(s), [0, 5]));
});
test('side jumps cannot pass through a side wall', () => {
  const s = createQuoridor();
  s.pawns = [
    [4, 4],
    [3, 4],
  ];
  s.walls = [
    { row: 2, col: 4, orientation: 'h', owner: 1 },
    { row: 3, col: 3, orientation: 'v', owner: 1 },
  ];
  assert.ok(!includes(pawnTargets(s), [3, 3]));
  assert.ok(includes(pawnTargets(s), [3, 5]));
});
test('a wall between pawns prevents any jump over that pawn', () => {
  const s = createQuoridor();
  s.pawns = [
    [4, 4],
    [3, 4],
  ];
  s.walls = [{ row: 3, col: 4, orientation: 'h', owner: 1 }];
  for (const p of [
    [2, 4],
    [3, 3],
    [3, 5],
  ] as Square[])
    assert.ok(!includes(pawnTargets(s), p));
});
for (const orientation of ['h', 'v'] as const)
  test(`${orientation} wall blocks exactly two edges both ways`, () => {
    const s = createQuoridor();
    s.walls = [{ row: 3, col: 3, orientation, owner: 0 }];
    const edges: [Square, Square][] =
      orientation === 'h'
        ? [
            [
              [3, 3],
              [4, 3],
            ],
            [
              [3, 4],
              [4, 4],
            ],
          ]
        : [
            [
              [3, 3],
              [3, 4],
            ],
            [
              [4, 3],
              [4, 4],
            ],
          ];
    for (const [a, b] of edges) {
      assert.ok(edgeBlocked(s, a, b));
      assert.ok(edgeBlocked(s, b, a));
    }
    assert.ok(!edgeBlocked(s, [2, 2], [2, 3]));
  });
test('walls cannot overlap, partially overlap, cross or extend outside board', () => {
  const s = createQuoridor();
  s.walls = [{ row: 3, col: 3, orientation: 'h', owner: 0 }];
  const invalid: Wall[] = [
    { row: 3, col: 3, orientation: 'h' },
    { row: 3, col: 2, orientation: 'h' },
    { row: 3, col: 4, orientation: 'h' },
    { row: 3, col: 3, orientation: 'v' },
    { row: 8, col: 0, orientation: 'v' },
    { row: 0, col: -1, orientation: 'h' },
  ];
  for (const wall of invalid) assert.equal(wallValidation(s, wall).ok, false);
  for (const wall of [
    { row: 3, col: 1, orientation: 'h' },
    { row: 3, col: 5, orientation: 'h' },
    { row: 2, col: 3, orientation: 'v' },
  ] as Wall[])
    assert.ok(wallValidation(s, wall).ok);
});
test('vertical partial overlap is rejected and end-to-end walls are allowed', () => {
  const s = createQuoridor();
  s.walls = [{ row: 3, col: 3, orientation: 'v', owner: 0 }];
  assert.equal(wallValidation(s, { row: 4, col: 3, orientation: 'v' }).ok, false);
  assert.ok(wallValidation(s, { row: 5, col: 3, orientation: 'v' }).ok);
});
test('cannot seal the last path of either player, even your own', () => {
  for (const player of [0, 1] as const)
    for (const turn of [0, 1] as const) {
      const s = createQuoridor();
      s.turn = turn;
      s.pawns[player] = player === 0 ? [8, 0] : [0, 0];
      s.walls = [{ row: player === 0 ? 6 : 1, col: 0, orientation: 'h', owner: 0 }];
      const wall: Wall = {
        row: player === 0 ? 7 : 0,
        col: 1,
        orientation: 'v',
      };
      assert.ok(shortestPath(s, player).length);
      assert.deepEqual(wallValidation(s, wall), {
        ok: false,
        code: 'path-blocked',
      });
    }
});
test('wall placement is immutable, consumes one wall and passes turn', () => {
  const s = createQuoridor(),
    copy = structuredClone(s);
  const next = applyQuoridor(s, {
    kind: 'wall',
    wall: { row: 3, col: 3, orientation: 'h' },
  });
  assert.deepEqual(s, copy);
  assert.deepEqual(next.remaining, [9, 10]);
  assert.equal(next.turn, 1);
  s.remaining[0] = 0;
  assert.equal(wallValidation(s, { row: 3, col: 3, orientation: 'h' }).ok, false);
});
for (const player of [0, 1] as const)
  test(`player ${player} wins on any target square`, () => {
    for (let col = 0; col < 9; col++) {
      const s = createQuoridor();
      s.turn = player;
      s.pawns[player] = [player === 0 ? 1 : 7, col];
      s.pawns[player === 0 ? 1 : 0] = [4, 4];
      const next = applyQuoridor(s, {
        kind: 'pawn',
        to: [player === 0 ? 0 : 8, col],
      });
      assert.equal(next.winner, player);
      assert.equal(quoridorLegalMoves(next).length, 0);
      assert.throws(() => applyQuoridor(next, { kind: 'pawn', to: [4, 3] }));
    }
  });
test('malformed protocol moves are rejected', () => {
  for (const m of [
    null,
    {},
    { kind: 'pawn', to: [NaN, 0] },
    { kind: 'pawn', to: [0.5, 0] },
    { kind: 'pawn', to: [0, 0, 0] },
    { kind: 'wall', wall: { row: 0, col: 0, orientation: 'x' } },
    { kind: 'pawn', to: [0, 0], winner: 0 },
  ])
    assert.throws(() => parseQuoridorMove(m));
});
test('seeded wall and pawn playout always leaves both goal paths open', () => {
  let s = createQuoridor(),
    seed = 831;
  for (let i = 0; i < 70 && s.winner === null; i++) {
    const moves = quoridorLegalMoves(s);
    assert.ok(moves.length);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    s = applyQuoridor(s, moves[seed % moves.length]);
    assert.ok(shortestPath(s, 0).length);
    assert.ok(shortestPath(s, 1).length);
    assert.equal(s.remaining[0] + s.remaining[1] + s.walls.length, 20);
    assert.notDeepEqual(s.pawns[0], s.pawns[1]);
  }
});
test('AI stays legal on every difficulty and takes an immediate goal', () => {
  const s = createQuoridor();
  s.pawns = [
    [1, 2],
    [7, 6],
  ];
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const move = quoridorAI(s, difficulty, { random: () => 0, budgetMs: 30 });
    assert.ok(move);
    const next = applyQuoridor(s, move);
    if (difficulty !== 'easy') assert.equal(next.winner, 0);
  }
});

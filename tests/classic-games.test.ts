import { test } from 'node:test';
import assert from 'node:assert/strict';
import { games } from '../packages/games/registry.ts';
import { isGameOver, type Difficulty } from '../packages/core/src/game.ts';
import { chooseMove } from '../packages/core/src/ai.ts';
import { OfflineMatch } from '../packages/core/src/offline.ts';
import { createCheckers, checkersPosition } from '../packages/games/checkers/state.ts';
import { checkersEngine as checkers } from '../packages/games/checkers/rules.ts';
import { createGomoku } from '../packages/games/gomoku/state.ts';
import { gomokuEngine as gomoku } from '../packages/games/gomoku/rules.ts';
import { createConnectFour } from '../packages/games/connect-four/state.ts';
import { connectFourEngine as connect } from '../packages/games/connect-four/rules.ts';
import {
  createMorris,
  MORRIS_EDGES,
  MORRIS_MILLS,
} from '../packages/games/nine-mens-morris/state.ts';
import {
  morrisEngine as morris,
  captureTargets,
  morrisCount,
} from '../packages/games/nine-mens-morris/rules.ts';
function bareCheckers() {
  const s = createCheckers();
  s.board.fill(null);
  s.positions = [];
  return s;
}
function movementMorris() {
  const s = createMorris();
  s.remaining = [0, 0];
  s.positions = [];
  return s;
}
function randomGenerator(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('all four games register complete initial positions', () => {
  assert.equal(games.ids().length, 6);
  const s = createCheckers();
  for (const owner of [0, 1]) assert.equal(s.board.filter((p) => p?.owner === owner).length, 12);
  assert.equal(checkers.legalMoves(s).length, 7);
  assert.equal(gomoku.legalMoves(createGomoku()).length, 225);
  assert.equal(connect.legalMoves(createConnectFour()).length, 7);
  assert.equal(morris.legalMoves(createMorris()).length, 24);
  assert.equal(MORRIS_MILLS.length, 16);
  assert.equal(MORRIS_EDGES.length, 32);
});

test('Checkers forces captures globally and keeps the same piece for the entire chain', () => {
  let s = bareCheckers();
  s.board[40] = { owner: 0, king: false };
  s.board[44] = { owner: 0, king: false };
  s.board[33] = { owner: 1, king: false };
  s.board[19] = { owner: 1, king: false };
  s.board[7] = { owner: 1, king: false };
  assert.deepEqual(checkers.legalMoves(s), [{ from: 40, to: 26 }]);
  assert.throws(() => checkers.apply(s, { from: 44, to: 35 }));
  const before = structuredClone(s);
  s = checkers.apply(s, { from: 40, to: 26 });
  assert.equal(s.turn, 0);
  assert.equal(s.forcedFrom, 26);
  assert.equal(s.board[33], null);
  assert.deepEqual(before.board[40], { owner: 0, king: false });
  assert.throws(() => checkers.apply(s, { from: 44, to: 35 }), /continue-capture/);
  s = checkers.apply(s, { from: 26, to: 12 });
  assert.equal(s.forcedFrom, null);
  assert.equal(s.turn, 1);
  assert.equal(s.board[19], null);
});

test('Checkers men cannot move or capture backward; kings can', () => {
  const s = bareCheckers();
  s.board[26] = { owner: 0, king: false };
  s.board[35] = { owner: 1, king: false };
  assert.equal(checkers.validate(s, { from: 26, to: 44 }).ok, false);
  assert.equal(checkers.validate(s, { from: 26, to: 33 }).ok, false);
  s.board[26]!.king = true;
  const next = checkers.apply(s, { from: 26, to: 44 });
  assert.equal(next.board[35], null);
  assert.equal(next.winner, 0);
});

test('Checkers promotion ends a capture turn even when a backward king jump is available', () => {
  const s = bareCheckers();
  s.board[17] = { owner: 0, king: false };
  s.board[10] = { owner: 1, king: false };
  s.board[12] = { owner: 1, king: false };
  const next = checkers.apply(s, { from: 17, to: 3 });
  assert.equal(next.board[3]?.king, true);
  assert.equal(next.turn, 1);
  assert.equal(next.forcedFrom, null);
  assert.equal(next.board[12]?.owner, 1);
});

test('Checkers allows either capture route and detects blocked opponents', () => {
  const s = bareCheckers();
  s.board[42] = { owner: 0, king: false };
  s.board[33] = { owner: 1, king: false };
  s.board[35] = { owner: 1, king: false };
  assert.deepEqual(checkers.legalMoves(s), [
    { from: 42, to: 24 },
    { from: 42, to: 28 },
  ]);
  const blocked = bareCheckers();
  blocked.board[17] = { owner: 0, king: false };
  blocked.board[56] = { owner: 1, king: false };
  assert.equal(checkers.apply(blocked, { from: 17, to: 8 }).winner, 0);
});

test('Checkers repeats only complete positions and enforces the 40-turn no-progress draw', () => {
  let s = bareCheckers();
  s.board[56] = { owner: 0, king: true };
  s.board[7] = { owner: 1, king: true };
  s.positions = [checkersPosition(s)];
  for (let cycle = 0; cycle < 2; cycle++)
    for (const [from, to] of [
      [56, 49],
      [7, 14],
      [49, 56],
      [14, 7],
    ])
      s = checkers.apply(s, { from, to });
  assert.equal(s.drawReason, 'threefold-repetition');
  assert.deepEqual(checkers.legalMoves(s), []);
  const quiet = bareCheckers();
  quiet.board[56] = { owner: 0, king: true };
  quiet.board[7] = { owner: 1, king: true };
  quiet.quietTurns = 79;
  assert.equal(checkers.apply(quiet, { from: 56, to: 49 }).drawReason, 'forty-move-rule');
  quiet.board[56]!.king = false;
  assert.equal(checkers.apply(quiet, { from: 56, to: 49 }).quietTurns, 0);
});

for (const [dr, dc] of [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
]) {
  test(`Gomoku wins in direction ${dr},${dc}, including overlines`, () => {
    for (const length of [5, 6]) {
      const s = createGomoku();
      const row = 4,
        col = dc < 0 ? 10 : 4;
      for (let n = 0; n < length; n++) if (n !== 2) s.board[(row + n * dr) * 15 + col + n * dc] = 0;
      const next = gomoku.apply(s, { row: row + 2 * dr, col: col + 2 * dc });
      assert.equal(next.winner, 0);
      assert.equal(next.winningLine.length, length);
      assert.equal(s.board[(row + 2 * dr) * 15 + col + 2 * dc], null);
      assert.deepEqual(gomoku.legalMoves(next), []);
    }
  });
  test(`Connect Four detects direction ${dr},${dc}`, () => {
    const s = createConnectFour();
    const row = dr ? 2 : 5,
      col = dc < 0 ? 4 : 1;
    for (let n = 0; n < 3; n++) s.board[(row + n * dr) * 7 + col + n * dc] = 0;
    const targetRow = row + 3 * dr,
      targetCol = col + 3 * dc;
    for (let r = targetRow + 1; r < 6; r++) s.board[r * 7 + targetCol] = 1;
    const next = connect.apply(s, { column: targetCol });
    assert.equal(next.winner, 0);
    assert.equal(next.winningLine.length, 4);
  });
}

test('Gomoku does not join lines across row boundaries and handles a full-board draw', () => {
  const s = createGomoku();
  for (const i of [13, 14, 15, 16]) s.board[i] = 0;
  assert.equal(gomoku.apply(s, { row: 1, col: 2 }).winner, null);
  const full = createGomoku();
  full.board = full.board.map(
    (_, i) => Math.floor(((Math.floor(i / 15) + 2 * (i % 15)) % 4) / 2) as 0 | 1,
  );
  full.board[0] = null;
  full.ply = 224;
  const next = gomoku.apply(full, { row: 0, col: 0 });
  assert.equal(next.drawReason, 'board-full');
  assert.equal(next.winner, null);
  assert.throws(() => gomoku.apply(next, { row: 0, col: 0 }), /game-over/);
});

test('Connect Four uses gravity, rejects full columns, and never wraps rows', () => {
  let s = createConnectFour();
  for (let i = 0; i < 6; i++) {
    s = connect.apply(s, { column: 0 });
    assert.equal(s.lastMove, (5 - i) * 7);
  }
  assert.throws(() => connect.apply(s, { column: 0 }), /column-full/);
  const wrap = createConnectFour();
  for (const i of [33, 34, 35]) wrap.board[i] = 0;
  assert.equal(connect.apply(wrap, { column: 1 }).winner, null);
});

test('Morris placement, mills, protected captures and reserves preserve the turn', () => {
  let s = createMorris();
  for (const to of [0, 8, 1, 9]) s = morris.apply(s, { kind: 'place', to });
  s = morris.apply(s, { kind: 'place', to: 2 });
  assert.equal(s.capturing, true);
  assert.equal(s.turn, 0);
  assert.deepEqual(s.remaining, [6, 7]);
  assert.throws(() => morris.apply(s, { kind: 'place', to: 3 }));
  s = morris.apply(s, { kind: 'capture', at: 8 });
  assert.equal(s.turn, 1);
  assert.equal(s.capturing, false);
  assert.equal(s.winner, null);
  assert.equal(s.board[8], null);
  s.turn = 0;
  s.capturing = true;
  s.board[8] = 1;
  s.board[10] = 1;
  s.board[4] = 1;
  assert.deepEqual(captureTargets(s), [4]);
  assert.throws(() => morris.apply(s, { kind: 'capture', at: 8 }), /capture-outside-mill/);
  s.board[4] = null;
  assert.deepEqual(captureTargets(s), [8, 9, 10]);
});

test('Morris cannot slide during placement; adjacency and flying depend on remaining pieces', () => {
  const placing = createMorris();
  placing.board[0] = 0;
  assert.throws(() => morris.apply(placing, { kind: 'move', from: 0, to: 1 }));
  const s = movementMorris();
  for (const i of [0, 2, 4, 6]) s.board[i] = 0;
  for (const i of [8, 10, 12, 14]) s.board[i] = 1;
  assert.ok(morris.validate(s, { kind: 'move', from: 0, to: 1 }).ok);
  assert.equal(morris.validate(s, { kind: 'move', from: 0, to: 17 }).ok, false);
  s.board[6] = null;
  assert.ok(morris.validate(s, { kind: 'move', from: 0, to: 17 }).ok);
  s.board[17] = 1;
  assert.equal(morris.validate(s, { kind: 'move', from: 0, to: 17 }).ok, false);
});

test('Morris double mills award exactly one capture, and a re-formed mill captures again', () => {
  let s = createMorris();
  for (const i of [0, 2, 9, 17]) s.board[i] = 0;
  for (const i of [4, 6, 8, 10]) s.board[i] = 1;
  s = morris.apply(s, { kind: 'place', to: 1 });
  assert.equal(s.capturing, true);
  s = morris.apply(s, { kind: 'capture', at: 4 });
  assert.equal(s.turn, 1);
  assert.equal(s.capturing, false);
  const moving = movementMorris();
  for (const i of [0, 1, 2, 6]) moving.board[i] = 0;
  for (const i of [8, 10, 12, 14]) moving.board[i] = 1;
  let n = morris.apply(moving, { kind: 'move', from: 1, to: 9 });
  n = morris.apply(n, { kind: 'move', from: 12, to: 11 });
  n = morris.apply(n, { kind: 'move', from: 9, to: 1 });
  assert.equal(n.capturing, true);
});

test('Morris wins by reducing to two or blocking all moves and draws on repetition', () => {
  const s = movementMorris();
  s.capturing = true;
  for (const i of [0, 1, 2]) s.board[i] = 0;
  for (const i of [8, 10, 12]) s.board[i] = 1;
  assert.equal(morris.apply(s, { kind: 'capture', at: 8 }).winner, 0);
  const blocked = movementMorris();
  for (const i of [0, 2, 4, 6]) blocked.board[i] = 1;
  for (const i of [1, 3, 5, 15, 8]) blocked.board[i] = 0;
  assert.equal(morris.apply(blocked, { kind: 'move', from: 15, to: 7 }).winner, 0);
  let repeat = movementMorris();
  for (const i of [0, 4, 8]) repeat.board[i] = 0;
  for (const i of [2, 6, 10]) repeat.board[i] = 1;
  // Initial position is intentionally reached once before the two repeating cycles.
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const [from, to] of [
      [0, 16],
      [2, 18],
      [16, 0],
      [18, 2],
    ]) {
      if (!isGameOver(repeat)) repeat = morris.apply(repeat, { kind: 'move', from, to });
    }
  }
  assert.equal(repeat.drawReason, 'threefold-repetition');
});

for (const id of ['checkers', 'gomoku', 'nineMensMorris', 'connectFour']) {
  test(`${id}: rejects malformed/injected moves without changing state`, () => {
    const game = games.get(id),
      s = game.create(),
      before = structuredClone(s);
    for (const bad of [
      null,
      [],
      {},
      { from: -1, to: 2 },
      { row: 0, col: 15 },
      { column: 7 },
      { column: 0.5 },
      { ...(game.legalMoves(s)[0] as object), winner: 0 },
    ])
      assert.throws(() => game.apply(s, bad));
    assert.deepEqual(s, before);
  });
  test(`${id}: seeded playouts stay legal, serializable and immutable`, () => {
    const game = games.get(id),
      random = randomGenerator(81);
    for (let run = 0; run < 3; run++) {
      let s = game.create();
      for (let ply = 0; ply < 180 && !isGameOver(s); ply++) {
        const before = JSON.stringify(s),
          moves = game.legalMoves(s);
        assert.ok(moves.length > 0);
        const next = game.apply(s, moves[Math.floor(random() * moves.length)]);
        assert.equal(JSON.stringify(s), before);
        assert.equal(next.ply, s.ply + 1);
        s = JSON.parse(JSON.stringify(next));
        if (id === 'checkers')
          assert.ok((s as ReturnType<typeof createCheckers>).board.filter(Boolean).length <= 24);
        if (id === 'nineMensMorris')
          for (const p of [0, 1] as const) {
            const m = s as ReturnType<typeof createMorris>;
            assert.ok(morrisCount(m, p) + m.remaining[p] <= 9);
          }
      }
    }
  });
  test(`${id}: all AI levels return legal moves and stop on a draw`, () => {
    const game = games.get(id),
      s = game.create();
    for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const move = chooseMove(game, s, difficulty, { budgetMs: 80, random: () => 0.4 });
      assert.ok(move);
      assert.doesNotThrow(() => game.apply(s, move));
    }
    assert.equal(chooseMove(game, { ...s, drawReason: 'board-full' }, 'easy'), null);
  });
}

test('line-game AI takes an immediate win and blocks an immediate loss at medium/hard', () => {
  for (const difficulty of ['medium', 'hard'] as Difficulty[]) {
    const s = createConnectFour();
    s.board[35] = 1;
    s.board[36] = 1;
    s.board[37] = 1;
    assert.deepEqual(chooseMove(games.get('connectFour'), s, difficulty, { budgetMs: 100 }), {
      column: 3,
    });
    s.board[35] = 0;
    s.board[36] = 0;
    s.board[37] = 0;
    assert.deepEqual(chooseMove(games.get('connectFour'), s, difficulty, { budgetMs: 100 }), {
      column: 3,
    });
    const g = createGomoku();
    for (const i of [0, 1, 2, 3]) g.board[i] = 1;
    assert.deepEqual(chooseMove(games.get('gomoku'), g, difficulty, { budgetMs: 100 }), {
      row: 0,
      col: 4,
    });
    for (const i of [0, 1, 2, 3]) g.board[i] = 0;
    assert.deepEqual(chooseMove(games.get('gomoku'), g, difficulty, { budgetMs: 100 }), {
      row: 0,
      col: 4,
    });
  }
});

test('offline automatic draws stop clocks and undo restores the playable board', () => {
  let time = 0;
  const match = new OfflineMatch(games.get('checkers'), 'local', () => time);
  const s = bareCheckers();
  s.board[56] = { owner: 0, king: true };
  s.board[7] = { owner: 1, king: true };
  s.quietTurns = 79;
  match.current.state = s;
  time = 1000;
  match.move({ from: 56, to: 49 });
  assert.equal(match.current.result?.reason, 'forty-move-rule');
  assert.equal(match.current.result?.winner, null);
  time = 700000;
  match.tick();
  assert.equal(match.current.result?.reason, 'forty-move-rule');
  assert.throws(() => match.move({ from: 7, to: 14 }), /game-over/);
  match.undo();
  assert.equal(match.current.result, null);
  assert.equal(match.current.state.drawReason, null);
  assert.equal(match.move({ from: 56, to: 49 }).result?.reason, 'forty-move-rule');
});

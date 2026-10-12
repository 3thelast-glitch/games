import test from 'node:test';
import assert from 'node:assert/strict';
import { createChess } from '../packages/games/chess/state.ts';
import { applyChess } from '../packages/games/chess/rules.ts';
import {
  appendAcceptedChessMove,
  createChessMoveJournal,
  reconstructChessJournal,
} from '../packages/games/chess/journal.ts';
import { chessMoveToSan, chessFromFen, chessToFen } from '../packages/games/chess/notation.ts';
import { exportChessPgn } from '../packages/games/chess/pgn.ts';

test('accepted move journal records independently from engine reviews and replays exactly', () => {
  let state = createChess();
  let journal = createChessMoveJournal('game-1', state);
  const moves = [
    { from: 52, to: 36 },
    { from: 12, to: 28 },
    { from: 62, to: 45 },
  ];
  for (let index = 0; index < moves.length; index++) {
    const before = structuredClone(state);
    state = applyChess(state, moves[index]);
    journal = appendAcceptedChessMove(journal, before, moves[index], state, 1000 + index);
  }
  assert.deepEqual(journal.entries.map((entry) => entry.san), ['e4', 'e5', 'Nf3']);
  assert.equal(journal.entries.length, 3);
  const restored = reconstructChessJournal(journal);
  assert.equal(chessToFen(restored), chessToFen(state));
  const duplicate = appendAcceptedChessMove(
    journal,
    chessFromFen(journal.entries[2].beforeFen),
    moves[2],
    chessFromFen(journal.entries[2].afterFen),
    9999,
  );
  assert.equal(duplicate.entries.length, 3);
});

test('SAN covers castling, promotion, capture and checkmate suffixes', () => {
  const castle = chessFromFen('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
  assert.equal(chessMoveToSan(castle, { from: 60, to: 62 }), 'O-O');

  const promotion = chessFromFen('7k/4P3/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(chessMoveToSan(promotion, { from: 12, to: 4, promotion: 'queen' }), 'e8=Q+');

  const mate = chessFromFen('k1KQ4/8/8/8/8/8/8/8 w - - 0 1');
  assert.equal(chessMoveToSan(mate, { from: 3, to: 24 }), 'Qa5#');
});

test('PGN export uses SAN, standard tags, Unicode names, escaping, and result', () => {
  let state = createChess();
  let journal = createChessMoveJournal('game-pgn', state);
  for (const move of [{ from: 52, to: 36 }, { from: 12, to: 28 }, { from: 62, to: 45 }]) {
    const before = structuredClone(state);
    state = applyChess(state, move);
    journal = appendAcceptedChessMove(journal, before, move, state, 1000);
  }
  const pgn = exportChessPgn(journal, {
    date: new Date('2026-10-12T00:00:00Z'),
    white: 'نواف "A"',
    black: 'NAQLA Bot',
    result: null,
    mode: 'ai',
  });
  assert.match(pgn, /\[Date "2026\.10\.12"\]/);
  assert.match(pgn, /\[White "نواف \\"A\\""\]/);
  assert.match(pgn, /1\. e4 e5 2\. Nf3 \*/);
  assert.doesNotMatch(pgn, /e2–e4/);
});
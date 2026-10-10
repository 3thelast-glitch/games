import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHESS_OPENINGS,
  DEFAULT_CHESS_REPERTOIRE,
  chessOpeningCandidates,
  chessOpeningMatchesRepertoire,
  detectChessOpening,
} from '../packages/games/chess/opening.ts';

test('Chess opening explorer identifies specific lines before generic families', () => {
  const sicilian = detectChessOpening([
    { from: 52, to: 36 },
    { from: 10, to: 26 },
  ]);
  assert.equal(sicilian?.id, 'sicilian');
  assert.equal(sicilian?.eco, 'B20');

  const petroff = detectChessOpening([
    { from: 52, to: 36 },
    { from: 12, to: 28 },
    { from: 62, to: 45 },
    { from: 6, to: 21 },
  ]);
  assert.equal(petroff?.id, 'petroff');

  const grunfeld = detectChessOpening([
    { from: 51, to: 35 },
    { from: 6, to: 21 },
    { from: 50, to: 34 },
    { from: 14, to: 22 },
    { from: 57, to: 42 },
    { from: 11, to: 27 },
  ]);
  assert.equal(grunfeld?.id, 'grunfeld');
});

test('Chess opening explorer suggests unique catalog continuations from the current prefix', () => {
  const candidates = chessOpeningCandidates([{ from: 52, to: 36 }]);
  const replies = candidates.map((candidate) => candidate.move.from + '-' + candidate.move.to);
  assert.ok(replies.includes('10-26'));
  assert.ok(replies.includes('12-28'));
  assert.ok(replies.includes('12-20'));
  assert.equal(new Set(replies).size, replies.length);
});

test('Chess repertoire matching distinguishes White and Black preferences', () => {
  const opening = CHESS_OPENINGS.find((item) => item.id === 'sicilian')!;
  assert.deepEqual(chessOpeningMatchesRepertoire(opening, DEFAULT_CHESS_REPERTOIRE), {
    white: true,
    black: true,
  });
  assert.deepEqual(
    chessOpeningMatchesRepertoire(opening, { white: 'd4', black: 'french' }),
    { white: false, black: false },
  );
});
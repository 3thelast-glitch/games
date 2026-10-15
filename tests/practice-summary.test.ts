import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceSummary } from '../apps/mobile/src/practice.ts';

test('offline practice stats classify AI wins, losses, draws and separate pass-and-play games', () => {
  const stats = practiceSummary([
    { id: 'ai-win', gameId: 'chess', mode: 'ai', winner: 0, durationMs: 2_000 },
    { id: 'ai-loss', gameId: 'chess', mode: 'ai', winner: 1, durationMs: 4_000 },
    { id: 'ai-draw', gameId: 'connectFour', mode: 'ai', winner: null, durationMs: 6_000 },
    { id: 'local-p2-win', gameId: 'checkers', mode: 'local', winner: 1, durationMs: 1_000 },
  ]);
  assert.deepEqual(
    [stats.aiMatches, stats.aiWins, stats.aiLosses, stats.aiDraws, stats.localMatches],
    [3, 1, 1, 1, 1],
  );
  assert.equal(stats.totalDurationMs, 13_000);
  assert.equal(stats.byGame[0].gameId, 'chess');
  assert.equal(stats.byGame[0].aiMatches, 2);
  assert.equal(stats.byGame[1].gameId, 'connectFour');
  assert.equal(stats.byGame.find((g) => g.gameId === 'checkers'), undefined);
});

test('history stats are deduplicated, bounded to 100 and ignore invalid duration', () => {
  const list = Array.from({ length: 110 }, (_, n) => ({
    id: String(n),
    gameId: 'reversi',
    mode: 'ai' as const,
    winner: 0 as const,
    durationMs: n === 2 ? Number.NaN : 1_000,
  }));
  list.splice(2, 0, { ...list[1] });
  const summary = practiceSummary(list);
  assert.equal(summary.aiMatches, 99);
  assert.equal(summary.aiWins, 99);
  assert.equal(summary.totalDurationMs, 98_000);
});

test('practice stats gracefully handle no saved games', () => {
  const stats = practiceSummary([]);
  assert.equal(stats.aiMatches, 0);
  assert.equal(stats.localMatches, 0);
  assert.deepEqual(stats.byGame, []);
});

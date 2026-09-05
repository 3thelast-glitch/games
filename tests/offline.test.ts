import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OfflineMatch } from '../packages/core/src/offline.ts';
import { games } from '../packages/games/registry.ts';
test('local undo restores the board and clock snapshot, AI undo is rejected', () => {
  let time = 1000;
  const match = new OfflineMatch(games.get('quoridor'), 'local', () => time);
  time += 5000;
  match.move({ kind: 'pawn', to: [7, 4] });
  assert.equal(match.current.clocks[0], 595000);
  assert.equal(match.history.length, 1);
  match.undo();
  assert.equal(match.current.state.ply, 0);
  assert.deepEqual(match.current.clocks, [600000, 600000]);
  assert.equal(match.current.turnStartedAt, time);
  const ai = new OfflineMatch(games.get('quoridor'), 'ai');
  assert.throws(() => ai.undo(), /undo-local-only/);
});
test('offline timeout prevents a late move and result cannot change after resignation', () => {
  let time = 0;
  const match = new OfflineMatch(games.get('quoridor'), 'local', () => time);
  time = 600001;
  assert.throws(() => match.move({ kind: 'pawn', to: [7, 4] }), /game-over/);
  assert.equal(match.current.result?.winner, 1);
  match.finish(0, 'resignation');
  assert.equal(match.current.result?.reason, 'timeout');
});

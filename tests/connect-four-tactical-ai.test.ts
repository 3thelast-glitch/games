import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnectFour } from '../packages/games/connect-four/state.ts';
import { connectFourEngine, applyConnectFour } from '../packages/games/connect-four/rules.ts';
import { chooseConnectFourExpertMove } from '../packages/games/connect-four/expert.ts';
import { connectFourAI } from '../packages/games/connect-four/ai.ts';

function replay(columns: number[]) {
  return columns.reduce((state, column) => applyConnectFour(state, { column }), createConnectFour());
}

test('Connect Four Medium and Hard prioritize immediate winning drops', () => {
  const state = replay([0, 6, 1, 6, 2, 5]);
  assert.equal(state.turn, 0);
  for (const difficulty of ['medium', 'hard'] as const) {
    const move = chooseConnectFourExpertMove(state, difficulty);
    assert.deepEqual(move, { column: 3 });
    assert.equal(applyConnectFour(state, move!).winner, 0);
  }
});

test('Connect Four Medium and Hard block an opponent immediate four-in-a-row', () => {
  const state = replay([6, 0, 6, 1, 5, 2]);
  assert.equal(state.turn, 0);
  for (const difficulty of ['medium', 'hard'] as const) {
    assert.deepEqual(connectFourAI(state, difficulty), { column: 3 });
  }
});

test('Connect Four AI levels always return legal moves and obey bounded search budgets', () => {
  const positions = [
    createConnectFour(),
    replay([3, 2, 3, 4]),
    replay([3, 3, 2, 4, 1, 5, 5, 2]),
  ];
  for (const state of positions) {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      let tick = 0;
      const move = connectFourAI(state, difficulty, {
        random: () => 0.8,
        budgetMs: 15,
        now: () => ++tick,
      });
      assert.ok(move, `${difficulty} ${state.ply}`);
      assert.ok(connectFourEngine.legalMoves(state).some((legal) => legal.column === move.column));
      assert.ok(tick < 2000, 'clock budget should stop deep search');
    }
  }
});

test('Connect Four expert does not move in a finished game', () => {
  const finished = replay([0, 6, 1, 6, 2, 5, 3]);
  assert.equal(finished.winner, 0);
  for (const difficulty of ['easy', 'medium', 'hard'] as const)
    assert.equal(chooseConnectFourExpertMove(finished, difficulty), null);
});

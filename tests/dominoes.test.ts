import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchService } from '../apps/server/src/matches.ts';
import { Store } from '../apps/server/src/store.ts';
import { OfflineMatch } from '../packages/core/src/offline.ts';
import type { MatchCommand, MatchSnapshot } from '../packages/core/src/protocol.ts';
import { games } from '../packages/games/registry.ts';
import { chooseDominoMove } from '../packages/games/dominoes/ai.ts';
import {
  applyDominoMove,
  dominoHandPips,
  legalDominoMoves,
  playableDominoSides,
  projectDominoState,
} from '../packages/games/dominoes/rules.ts';
import {
  canonicalDominoId,
  chooseDominoOpening,
  createDominoes,
  createDoubleSixSet,
  type DominoesState,
} from '../packages/games/dominoes/state.ts';

function onlineMove(match: MatchSnapshot, move: unknown): MatchCommand {
  return {
    type: 'move',
    matchId: match.id,
    commandId: randomUUID(),
    expectedRevision: match.revision,
    move,
  } as MatchCommand;
}

function position(overrides: Partial<DominoesState> = {}): DominoesState {
  const state = createDominoes(12345);
  return {
    ...state,
    hands: [['0|0'], ['6|6']],
    handCounts: [1, 1],
    boneyard: [],
    boneyardCount: 0,
    chain: [{ tileId: '2|3', leftValue: 2, rightValue: 3 }],
    openingPending: false,
    openingTileId: null,
    turn: 0,
    winner: null,
    drawReason: null,
    resultReason: undefined,
    lastAction: null,
    blockedPips: null,
    viewerSeat: undefined,
    ...overrides,
  };
}

test('Double-Six has 28 unique canonical tiles', () => {
  const tiles = createDoubleSixSet();
  assert.equal(tiles.length, 28);
  assert.equal(new Set(tiles.map((tile) => tile.id)).size, 28);
  assert.equal(canonicalDominoId(5, 2), '2|5');
  assert.ok(tiles.every((tile) => tile.a <= tile.b && tile.a >= 0 && tile.b <= 6));
});

test('deal is reproducible and conserves 7/7/14 tiles', () => {
  const a = createDominoes(9876),
    b = createDominoes(9876);
  assert.deepEqual(a, b);
  assert.deepEqual(a.handCounts, [7, 7]);
  assert.equal(a.boneyardCount, 14);
  const all = [...a.hands[0], ...a.hands[1], ...a.boneyard];
  assert.equal(all.length, 28);
  assert.equal(new Set(all).size, 28);
});

test('highest double in hands determines starter and boneyard does not participate', () => {
  const opening = chooseDominoOpening([
    ['0|0', '2|5', '4|4'],
    ['1|6', '5|5', '3|4'],
  ]);
  assert.deepEqual(opening, { starter: 1, tileId: '5|5' });
  // A hypothetical 6|6 in the boneyard is deliberately not an argument to the selector.
  assert.notEqual(opening.tileId, '6|6');
});

test('without doubles, opening rank uses pip sum then highest endpoint', () => {
  assert.deepEqual(
    chooseDominoOpening([
      ['2|5', '0|3'],
      ['1|6', '0|4'],
    ]),
    { starter: 1, tileId: '1|6' },
  );
});

test('opening requires the exact forced tile and forbids draw or pass', () => {
  const state = createDominoes(44),
    required = state.openingTileId!;
  assert.deepEqual(legalDominoMoves(state), [{ type: 'play', tileId: required, side: 'right' }]);
  assert.throws(() => applyDominoMove(state, { type: 'draw' }), /opening-play-required/);
  assert.throws(() => applyDominoMove(state, { type: 'pass' }), /opening-play-required/);
  const other = state.hands[state.turn].find((id) => id !== required)!;
  assert.throws(() => applyDominoMove(state, { type: 'play', tileId: other, side: 'right' }), /opening-tile-required/);
  const next = applyDominoMove(state, { type: 'play', tileId: required, side: 'right' });
  assert.equal(next.openingPending, false);
  assert.equal(next.turn, state.turn === 0 ? 1 : 0);
});

test('left and right placement normalize orientation from canonical tile ID', () => {
  const state = position({
    hands: [['1|2', '3|6'], ['4|5']],
    handCounts: [2, 1],
  });
  assert.deepEqual(playableDominoSides(state, '1|2'), ['left']);
  assert.deepEqual(playableDominoSides(state, '3|6'), ['right']);
  const left = applyDominoMove(state, { type: 'play', tileId: '1|2', side: 'left' });
  assert.deepEqual(left.chain[0], { tileId: '1|2', leftValue: 1, rightValue: 2 });
  assert.equal(left.turn, 1);
});

test('a tile matching both ends exposes two explicit legal sides and doubles give no extra turn', () => {
  const both = position({
    chain: [{ tileId: '2|3', leftValue: 2, rightValue: 2 }],
    hands: [['2|5'], ['1|6']],
    handCounts: [1, 1],
  });
  assert.deepEqual(playableDominoSides(both, '2|5'), ['left', 'right']);

  const doubled = position({
    chain: [{ tileId: '2|3', leftValue: 2, rightValue: 3 }],
    hands: [['3|3', '0|6'], ['1|5']],
    handCounts: [2, 1],
  });
  const next = applyDominoMove(doubled, { type: 'play', tileId: '3|3', side: 'right' });
  assert.equal(next.turn, 1);
  assert.equal(next.handCounts[0], 1);
});

test('draw keeps the turn, draws one ordered tile, and becomes illegal when a play exists', () => {
  let state = position({
    hands: [['0|6'], ['1|5']],
    handCounts: [1, 1],
    boneyard: ['4|5', '2|6'],
    boneyardCount: 2,
  });
  assert.deepEqual(legalDominoMoves(state), [{ type: 'draw' }]);
  state = applyDominoMove(state, { type: 'draw' });
  assert.equal(state.turn, 0);
  assert.equal(state.boneyardCount, 1);
  assert.ok(state.hands[0].includes('4|5'));
  assert.deepEqual(legalDominoMoves(state), [{ type: 'draw' }]);
  state = applyDominoMove(state, { type: 'draw' });
  assert.equal(state.turn, 0);
  assert.ok(legalDominoMoves(state).some((move) => move.type === 'play' && move.tileId === '2|6'));
  assert.throws(() => applyDominoMove(state, { type: 'draw' }), /draw-while-playable/);
  assert.throws(() => applyDominoMove(state, { type: 'pass' }), /pass-while-playable/);
});

test('empty boneyard permits pass for an unable player when opponent can still play', () => {
  const state = position({
    hands: [['0|6'], ['2|4']],
    handCounts: [1, 1],
    boneyard: [],
    boneyardCount: 0,
  });
  assert.deepEqual(legalDominoMoves(state), [{ type: 'pass' }]);
  const next = applyDominoMove(state, { type: 'pass' });
  assert.equal(next.turn, 1);
  assert.ok(legalDominoMoves(next).some((move) => move.type === 'play'));
});

test('domino-out wins immediately with the specific result reason', () => {
  const state = position({
    hands: [['2|6'], ['0|0', '6|6']],
    handCounts: [1, 2],
  });
  const next = applyDominoMove(state, { type: 'play', tileId: '2|6', side: 'left' });
  assert.equal(next.winner, 0);
  assert.equal(next.resultReason, 'domino-out');
  assert.equal(next.handCounts[0], 0);
  assert.deepEqual(legalDominoMoves(next), []);
});

test('blocked game resolves immediately by pip total and supports a tie', () => {
  const win = position({
    chain: [{ tileId: '2|3', leftValue: 2, rightValue: 3 }],
    hands: [['0|0', '4|4'], ['5|5']],
    handCounts: [2, 1],
    boneyard: ['1|3'],
    boneyardCount: 1,
  });
  const blocked = applyDominoMove(win, { type: 'draw' });
  assert.equal(blocked.boneyardCount, 0);
  assert.equal(blocked.winner, 0);
  assert.equal(blocked.resultReason, 'domino-blocked');
  assert.deepEqual(blocked.blockedPips, [8, 10]);

  const tie = position({
    chain: [{ tileId: '2|3', leftValue: 2, rightValue: 3 }],
    hands: [['0|6'], ['1|5']],
    handCounts: [1, 1],
    boneyard: ['4|4'],
    boneyardCount: 1,
  });
  const tied = applyDominoMove(tie, { type: 'draw' });
  assert.equal(tied.winner, null);
  assert.equal(tied.drawReason, 'domino-blocked-tie');
  assert.deepEqual(tied.blockedPips, [14, 6]);
});

test('pip counting includes blanks and doubles correctly', () => {
  assert.equal(dominoHandPips(['0|0', '0|6', '6|6']), 18);
});

test('projection is an allowlist: own hand only, no boneyard order or seed', () => {
  const state = createDominoes(991);
  state.lastAction = { type: 'draw', player: 1, handCount: state.handCounts[1], tileId: state.hands[1][0] };
  const view0 = projectDominoState(state, 0),
    view1 = projectDominoState(state, 1);
  assert.deepEqual(view0.hands[1], []);
  assert.deepEqual(view1.hands[0], []);
  assert.deepEqual(view0.hands[0], state.hands[0]);
  assert.deepEqual(view0.boneyard, []);
  assert.equal(view0.boneyardCount, state.boneyard.length);
  assert.equal(view0.seed, 0);
  assert.equal((view0.lastAction as { tileId?: string }).tileId, undefined);
  assert.equal((view1.lastAction as { tileId?: string }).tileId, state.hands[1][0]);
  const serialized = JSON.stringify(view0);
  for (const hidden of [...state.hands[1], ...state.boneyard]) assert.equal(serialized.includes(`\"${hidden}\"`), false);
});

test('projection and AI are noninterfering for different hidden truths', () => {
  const publicBase = position({
    hands: [['2|6', '1|3'], ['0|0', '4|4']],
    handCounts: [2, 2],
    boneyard: ['0|1', '4|6'],
    boneyardCount: 2,
  });
  const alternate = structuredClone(publicBase);
  alternate.hands[1] = ['0|5', '5|5'];
  alternate.boneyard = ['1|1', '4|6'];
  const first = projectDominoState(publicBase, 0),
    second = projectDominoState(alternate, 0);
  assert.deepEqual(first, second);
  const moveA = chooseDominoMove(first, 'hard', { random: () => 0.25 }),
    moveB = chooseDominoMove(second, 'hard', { random: () => 0.25 });
  assert.deepEqual(moveA, moveB);
});

test('OfflineMatch preserves draw chains and dynamic terminal reasons', () => {
  const match = new OfflineMatch(games.get('dominoes'), 'local');
  match.current.state = position({
    hands: [['0|6'], ['1|5']],
    handCounts: [1, 1],
    boneyard: ['2|6'],
    boneyardCount: 1,
  });
  const drawn = match.move({ type: 'draw' });
  assert.equal(drawn.state.turn, 0);
  const final = match.move({ type: 'play', tileId: '2|6', side: 'left' });
  assert.equal(final.result?.winner, null);
  assert.equal(final.result?.reason, 'domino-blocked-tie');
});

test('authoritative online view hides secrets and server rejects a forged tile', () => {
  const store = new Store();
  const alice = store.createUser('Alice'),
    bob = store.createUser('Bob');
  const service = new MatchService(store, games, { clockMs: 60000 });
  try {
    const match = service.create('dominoes', [alice.id, bob.id]),
      authoritative = match.state as DominoesState,
      aliceView = service.forUser(match, alice.id).state as DominoesState,
      bobView = service.forUser(match, bob.id).state as DominoesState;
    assert.deepEqual(aliceView.hands[1], []);
    assert.deepEqual(bobView.hands[0], []);
    assert.equal(aliceView.boneyard.length, 0);
    assert.equal(bobView.boneyard.length, 0);
    assert.equal(JSON.stringify(aliceView).includes(authoritative.hands[1][0]), false);
    const forged = authoritative.hands[authoritative.turn === 0 ? 1 : 0][0];
    const actor = authoritative.turn === 0 ? alice : bob;
    assert.throws(
      () => service.command(actor.id, onlineMove(match, { type: 'play', tileId: forged, side: 'right' })),
      /opening-tile-required|tile-not-owned/,
    );
  } finally {
    store.close();
  }
});

test('Dominoes state survives JSON round trip without changing the next legal transition', () => {
  const state = createDominoes(777),
    restored = JSON.parse(JSON.stringify(state)) as DominoesState,
    move = legalDominoMoves(state)[0];
  assert.deepEqual(restored, state);
  assert.deepEqual(applyDominoMove(restored, move), applyDominoMove(state, move));
});

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { AbaloneBoard } from '../packages/games/abalone/ui.tsx';
import { QuoridorBoard } from '../packages/games/quoridor/ui.tsx';
import { createAbalone, type AbaloneMove } from '../packages/games/abalone/state.ts';
import { createQuoridor, type QuoridorMove } from '../packages/games/quoridor/state.ts';
import { applyQuoridor } from '../packages/games/quoridor/rules.ts';
import { applyAbalone } from '../packages/games/abalone/rules.ts';
import { I18n } from '../apps/mobile/src/i18n.tsx';
import { Modal } from '../apps/mobile/src/components.tsx';
import { MatchPage, type MatchPageProps } from '../apps/mobile/src/MatchPage.tsx';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLDialogElement: dom.window.HTMLDialogElement,
  MutationObserver: dom.window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};
const { render, fireEvent, cleanup } = await import('@testing-library/react');
afterEach(() => cleanup());
const t = (key: string) => key;
test('Abalone UI emits a legal selected move and prevents selecting the opponent', () => {
  let move: AbaloneMove | undefined;
  const state = createAbalone(),
    view = render(<AbaloneBoard state={state} disabled={false} onMove={(m) => (move = m)} t={t} />);
  const opposing = view.getByRole('button', {
    name: 'player2 0,-4',
  }) as HTMLButtonElement;
  assert.ok(opposing.disabled);
  fireEvent.click(view.getByRole('button', { name: 'player1 -2,2' }));
  assert.equal(
    view.getByRole('button', { name: 'player1 -2,2' }).getAttribute('aria-pressed'),
    'true',
  );
  fireEvent.click(view.getByRole('button', { name: 'turn ↖' }));
  assert.deepEqual(move, { marbles: [[-2, 2]], direction: 4 });
  view.rerender(
    <AbaloneBoard
      state={applyAbalone(state, move!)}
      disabled={false}
      onMove={(m) => (move = m)}
      t={t}
    />,
  );
  assert.ok((view.getByRole('button', { name: 'clear' }) as HTMLButtonElement).disabled);
});
test('Quoridor wall preview does not commit until confirmed and consumes one wall', () => {
  let move: QuoridorMove | undefined;
  const state = createQuoridor(),
    view = render(
      <QuoridorBoard state={state} disabled={false} onMove={(m) => (move = m)} t={t} />,
    );
  fireEvent.click(view.getByRole('button', { name: 'placeWall 10' }));
  fireEvent.click(view.getByRole('button', { name: 'placeWall 4,4' }));
  assert.equal(move, undefined);
  assert.equal(view.container.querySelectorAll('.wall-preview').length, 1);
  assert.ok(view.getByText('validWall'));
  fireEvent.click(view.getByRole('button', { name: 'confirmWall' }));
  assert.deepEqual(move, {
    kind: 'wall',
    wall: { row: 3, col: 3, orientation: 'h' },
  });
  const next = applyQuoridor(state, move!);
  assert.equal(next.remaining[0], 9);
  view.rerender(<QuoridorBoard state={next} disabled={false} onMove={(m) => (move = m)} t={t} />);
  assert.equal(view.container.querySelectorAll('.wall-preview').length, 0);
});
test('Quoridor displays the blocked-path reason and disables confirmation', () => {
  const state = createQuoridor();
  state.pawns[0] = [8, 0];
  state.walls = [{ row: 6, col: 0, orientation: 'h', owner: 0 }];
  const view = render(
    <QuoridorBoard
      state={state}
      disabled={false}
      onMove={() => assert.fail('Illegal wall was emitted')}
      t={t}
    />,
  );
  fireEvent.click(view.getByRole('button', { name: 'placeWall 10' }));
  fireEvent.click(view.getByRole('button', { name: 'vertical' }));
  fireEvent.click(view.getByRole('button', { name: 'placeWall 8,2' }));
  assert.ok(view.getByText('path-blocked'));
  assert.ok((view.getByRole('button', { name: 'confirmWall' }) as HTMLButtonElement).disabled);
});
test('Arabic move controls render Arabic while board coordinates remain fixed', () => {
  const state = createQuoridor();
  const view = render(
    <I18n lang="ar">
      <Modal title="طريقة اللعب" onClose={() => {}}>
        <p>تجربة</p>
      </Modal>
    </I18n>,
  );
  assert.ok(view.getByRole('dialog', { name: 'طريقة اللعب' }));
  assert.ok(view.getByRole('button', { name: 'إغلاق' }));
  view.unmount();
  const board = render(
    <QuoridorBoard
      state={state}
      disabled={false}
      onMove={() => {}}
      t={(k) => (k === 'movePawn' ? 'تحريك البيدق' : k === 'placeWall' ? 'وضع جدار' : k)}
    />,
  );
  assert.ok(board.getByRole('button', { name: 'تحريك البيدق 8,5' }));
  assert.equal(board.container.querySelector('svg')?.getAttribute('style'), 'direction: ltr;');
});
function matchProps(mode: 'local' | 'online'): MatchPageProps {
  return {
    id: 'm1',
    state: createQuoridor(),
    mode,
    ranked: mode === 'online',
    players: [
      { id: 'a', name: 'Alice', avatar: 'orbit', rating: 1000, rank: 'Silver' },
      { id: 'b', name: 'Bob', avatar: 'comet', rating: 1000, rank: 'Silver' },
    ],
    self: 0,
    clocks: [600000, 600000],
    turnStartedAt: 1000,
    now: 2000,
    createdAt: 1000,
    endedAt: null,
    result: null,
    disabled: false,
    pending: false,
    canUndo: true,
    sound: false,
    connectionStatus: 'connected',
    disconnected: false,
    graceSeconds: 60,
    drawOffer: null,
    rematchWaiting: false,
    emote: null,
    onMove: () => {},
    onUndo: () => {},
    onRestart: () => {},
    onResign: () => {},
    onDraw: () => {},
    onDrawAnswer: () => {},
    onRematch: () => {},
    onHome: () => {},
    onSound: () => {},
    onEmote: () => {},
  };
}
test('online match has no undo or restart; local match exposes both', () => {
  const view = render(
    <I18n lang="en">
      <MatchPage {...matchProps('online')} />
    </I18n>,
  );
  assert.equal(view.queryByRole('button', { name: 'Undo' }), null);
  assert.equal(view.queryByRole('button', { name: 'Restart' }), null);
  view.rerender(
    <I18n lang="en">
      <MatchPage {...matchProps('local')} />
    </I18n>,
  );
  assert.ok(view.getByRole('button', { name: 'Undo' }));
  assert.ok(view.getByRole('button', { name: 'Restart' }));
});
test('result screen identifies winner, reason, rating and rematch', () => {
  const props = matchProps('online');
  props.result = { winner: 0, reason: 'goal', ratingDelta: [16, -16] };
  props.endedAt = 61000;
  const view = render(
    <I18n lang="en">
      <MatchPage {...props} />
    </I18n>,
  );
  assert.ok(view.getByRole('dialog', { name: 'Victory!' }));
  assert.ok(view.getByText('Destination row reached.'));
  assert.ok(view.getByText('+16'));
  assert.ok(view.getByRole('button', { name: 'Rematch' }));
});
<<<<<<< HEAD
=======

import { CheckersBoard } from '../packages/games/checkers/ui.tsx';
import { GomokuBoard } from '../packages/games/gomoku/ui.tsx';
import { MorrisBoard } from '../packages/games/nine-mens-morris/ui.tsx';
import { ConnectFourBoard } from '../packages/games/connect-four/ui.tsx';
import { createCheckers, type CheckersMove } from '../packages/games/checkers/state.ts';
import { createGomoku, type GomokuMove } from '../packages/games/gomoku/state.ts';
import { createMorris, type MorrisMove } from '../packages/games/nine-mens-morris/state.ts';
import { createConnectFour, type ConnectFourMove } from '../packages/games/connect-four/state.ts';
import { checkersEngine } from '../packages/games/checkers/rules.ts';
import { gomokuEngine } from '../packages/games/gomoku/rules.ts';
import { morrisEngine } from '../packages/games/nine-mens-morris/rules.ts';
import { connectFourEngine } from '../packages/games/connect-four/rules.ts';
import { games } from '../packages/games/registry.ts';
import { gameInfo, upcoming } from '../apps/mobile/src/gameViews.tsx';

test('Checkers UI selects a piece, highlights destinations and emits a legal move', () => {
  const state = createCheckers();
  let move: CheckersMove | undefined;
  const view = render(
    <CheckersBoard state={state} disabled={false} onMove={(m) => (move = m)} t={t} />,
  );
  assert.ok((view.getByRole('button', { name: 'player2 1,2' }) as HTMLButtonElement).disabled);
  fireEvent.click(view.getByRole('button', { name: 'player1 6,1' }));
  assert.equal(
    view.getByRole('button', { name: 'player1 6,1' }).getAttribute('aria-pressed'),
    'true',
  );
  fireEvent.click(view.getByRole('button', { name: 'emptyCell 5,2' }));
  assert.deepEqual(move, { from: 40, to: 33 });
  view.rerender(
    <CheckersBoard
      state={checkersEngine.apply(state, move!)}
      disabled={false}
      onMove={(m) => (move = m)}
      t={t}
    />,
  );
  assert.equal(view.container.querySelectorAll('[aria-pressed="true"]').length, 0);
});

test('Checkers UI locks the captured piece until the chain completes', () => {
  const state = createCheckers();
  state.board.fill(null);
  state.board[40] = { owner: 0, king: false };
  state.board[44] = { owner: 0, king: false };
  state.board[33] = { owner: 1, king: false };
  state.board[19] = { owner: 1, king: false };
  const next = checkersEngine.apply(state, { from: 40, to: 26 });
  let move: CheckersMove | undefined;
  const view = render(
    <CheckersBoard state={next} disabled={false} onMove={(m) => (move = m)} t={t} />,
  );
  assert.ok(view.getByText('continueCapture'));
  assert.ok((view.getByRole('button', { name: 'player1 6,5' }) as HTMLButtonElement).disabled);
  fireEvent.click(view.getByRole('button', { name: 'emptyCell 2,5' }));
  assert.deepEqual(move, { from: 26, to: 12 });
});

test('Gomoku preview requires confirmation and clears after an accepted move', () => {
  const state = createGomoku();
  let move: GomokuMove | undefined;
  const view = render(
    <GomokuBoard state={state} disabled={false} onMove={(m) => (move = m)} t={t} />,
  );
  fireEvent.click(view.getByRole('button', { name: 'placeStone 8,8' }));
  assert.equal(move, undefined);
  fireEvent.click(view.getByRole('button', { name: 'confirmStone' }));
  assert.deepEqual(move, { row: 7, col: 7 });
  view.rerender(
    <GomokuBoard
      state={gomokuEngine.apply(state, move!)}
      disabled={false}
      onMove={(m) => (move = m)}
      t={t}
    />,
  );
  assert.ok((view.getByRole('button', { name: 'confirmStone' }) as HTMLButtonElement).disabled);
  assert.ok((view.getByRole('button', { name: 'player1 8,8' }) as HTMLButtonElement).disabled);
});

test('Morris UI switches from placing to capturing and protects pieces in a mill', () => {
  let state = createMorris();
  state.board[0] = 0;
  state.board[1] = 0;
  for (const i of [8, 9, 10, 4]) state.board[i] = 1;
  let move: MorrisMove | undefined;
  const view = render(
    <MorrisBoard state={state} disabled={false} onMove={(m) => (move = m)} t={t} />,
  );
  fireEvent.click(view.getByRole('button', { name: 'emptyCell 3' }));
  assert.deepEqual(move, { kind: 'place', to: 2 });
  state = morrisEngine.apply(state, move!);
  view.rerender(<MorrisBoard state={state} disabled={false} onMove={(m) => (move = m)} t={t} />);
  assert.ok(view.getByText('morrisCaptureHint'));
  assert.ok((view.getByRole('button', { name: 'player2 9' }) as HTMLButtonElement).disabled);
  fireEvent.click(view.getByRole('button', { name: 'player2 5' }));
  assert.deepEqual(move, { kind: 'capture', at: 4 });
});

test('Connect Four UI drops a disc and disables full columns and finished games', () => {
  let state = createConnectFour();
  let move: ConnectFourMove | undefined;
  const view = render(
    <ConnectFourBoard state={state} disabled={false} onMove={(m) => (move = m)} t={t} />,
  );
  fireEvent.click(view.getByRole('button', { name: 'dropColumn 4' }));
  assert.deepEqual(move, { column: 3 });
  for (let i = 0; i < 6; i++) state = connectFourEngine.apply(state, { column: 3 });
  view.rerender(
    <ConnectFourBoard state={state} disabled={false} onMove={(m) => (move = m)} t={t} />,
  );
  assert.ok((view.getByRole('button', { name: 'dropColumn 4' }) as HTMLButtonElement).disabled);
  view.rerender(
    <ConnectFourBoard state={state} disabled={true} onMove={(m) => (move = m)} t={t} />,
  );
  assert.ok(view.getAllByRole('button').every((b) => (b as HTMLButtonElement).disabled));
});

for (const id of ['checkers', 'gomoku', 'nineMensMorris', 'connectFour']) {
  test(`${id}: available in the catalog, bilingual match resources and board controls lock online`, () => {
    assert.ok(gameInfo.some((g) => g.id === id));
    assert.ok(!upcoming.includes(id));
    const props = matchProps('online');
    props.state = games.get(id).create();
    props.disabled = true;
    const view = render(
      <I18n lang="ar">
        <MatchPage {...props} />
      </I18n>,
    );
    assert.ok(
      view.getByText(
        id === 'gomoku'
          ? 'خمس قطع تحسمها'
          : id === 'checkers'
            ? 'كل قفزة تصنع الفارق'
            : id === 'nineMensMorris'
              ? 'ضع. حرّك. اقفز.'
              : 'أربع قطع للفوز',
      ),
    );
    const board = view.container.querySelector('.classic-game')!;
    assert.ok(Array.from(board.querySelectorAll('button')).every((b) => b.disabled));
    assert.ok(board.querySelector('[dir="ltr"]'));
    props.result = { winner: null, reason: 'threefold-repetition', ratingDelta: [0, 0] };
    view.rerender(
      <I18n lang="en">
        <MatchPage {...props} />
      </I18n>,
    );
    assert.ok(view.getByText('The same position occurred three times.'));
  });
}
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97

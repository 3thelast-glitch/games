import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createArenaServer } from '../apps/server/src/server.ts';
import { Store } from '../apps/server/src/store.ts';
import {
  PROTOCOL_VERSION,
  type MatchSnapshot,
  type ServerMessage,
} from '../packages/core/src/protocol.ts';
import type { DigitalGameState } from '../packages/games/digital-game/state.ts';

type Client = ReturnType<typeof connectClient>;

function connectClient(port: number, sockets: WebSocket[]) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    origin: 'http://localhost',
  });
  sockets.push(ws);
  const messages: ServerMessage[] = [],
    observed: ServerMessage[] = [];
  const waiters: {
    predicate: (message: ServerMessage) => boolean;
    resolve: (message: ServerMessage) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];

  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString()) as ServerMessage;
    observed.push(message);
    const index = waiters.findIndex((waiter) => waiter.predicate(message));
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else messages.push(message);
  });

  return {
    observed,
    send(message: unknown) {
      ws.send(JSON.stringify(message));
    },
    async open() {
      await new Promise<void>((resolve) => ws.once('open', resolve));
    },
    next(predicate: (message: ServerMessage) => boolean): Promise<ServerMessage> {
      const index = messages.findIndex(predicate);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          reject,
          timer: setTimeout(() => {
            const waiterIndex = waiters.indexOf(waiter);
            if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
            reject(new Error('WebSocket response timeout'));
          }, 5000),
        };
        waiters.push(waiter);
      });
    },
  };
}

function asMatch(message: ServerMessage): MatchSnapshot {
  assert.equal(message.type, 'match');
  if (message.type !== 'match') throw new Error('expected match message');
  return message.match;
}

function sharedSnapshot(match: MatchSnapshot) {
  const state = match.state as DigitalGameState;
  return {
    id: match.id,
    revision: match.revision,
    turn: state.turn,
    ply: state.ply,
    rackCounts: state.rackCounts,
    drawPoolCount: state.drawPool.length,
    table: state.table,
    lastAction: state.lastAction,
    emptyPoolPasses: state.emptyPoolPasses,
    clockMs: match.clockMs,
    turnStartedAt: match.turnStartedAt,
    drawOffer: match.drawOffer,
    drawAccepts: match.drawAccepts,
    result: match.result,
    endedAt: match.endedAt,
  };
}

function assertInventoryConsistent(state: DigitalGameState) {
  const placed = [
    ...state.racks.flat(),
    ...state.table.flatMap((meld) => meld.tiles),
    ...state.drawPool,
  ];
  const catalog = Object.keys(state.tiles);
  assert.equal(placed.length, catalog.length);
  assert.equal(new Set(placed).size, catalog.length);
  assert.ok(placed.every((id) => state.tiles[id] !== undefined));
  assert.deepEqual(state.rackCounts, state.racks.map((rack) => rack.length));
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('condition timeout');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('four Digital clients racing different commands on one revision accept exactly one and stay synchronized', async () => {
  const store = new Store(),
    app = createArenaServer({
      store,
      env: {},
      allowedOrigins: ['http://localhost'],
    });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const port = (app.server.address() as { port: number }).port,
    base = `http://127.0.0.1:${port}`,
    sockets: WebSocket[] = [];

  async function guest(name: string) {
    const response = await fetch(base + '/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    assert.equal(response.status, 201);
    return response.json() as Promise<{ token: string; profile: { id: string } }>;
  }

  try {
    const users = await Promise.all([
        guest('MixedRaceAlice4'),
        guest('MixedRaceBob4'),
        guest('MixedRaceCarol4'),
        guest('MixedRaceDave4'),
      ]),
      clients: Client[] = Array.from({ length: 4 }, () => connectClient(port, sockets));

    await Promise.all(clients.map((client) => client.open()));
    clients.forEach((client, index) =>
      client.send({
        type: 'auth',
        version: PROTOCOL_VERSION,
        token: users[index].token,
      }),
    );
    await Promise.all(clients.map((client) => client.next((message) => message.type === 'ready')));

    clients[0].send({
      type: 'create-room',
      gameId: 'digitalGame',
      playerCount: 4,
      turnSeconds: 30,
    });
    const room = await clients[0].next((message) => message.type === 'room');
    assert.equal(room.type, 'room');
    if (room.type !== 'room') throw new Error('expected room message');

    clients[1].send({ type: 'join-room', code: room.code });
    await clients[1].next((message) => message.type === 'room');
    clients[2].send({ type: 'join-room', code: room.code });
    await clients[2].next((message) => message.type === 'room');
    clients[3].send({ type: 'join-room', code: room.code });

    const initial = (
      await Promise.all(
        clients.map((client) =>
          client.next((message) => message.type === 'match' && message.match.revision === 0),
        ),
      )
    ).map(asMatch);
    const matchId = initial[0].id;
    assert.ok(initial.every((match) => match.id === matchId && match.revision === 0));

    const stored = store.loadMatch(matchId),
      state = stored.state as DigitalGameState;
    assert.equal(state.playerCount, 4);
    assert.equal(state.turn, 0);
    assert.ok(state.drawPool.length > 0);

    // Preserve the full tile inventory while making the timeout action an empty-pool pass.
    state.racks[3].push(...state.drawPool);
    state.drawPool = [];
    state.rackCounts = state.racks.map((rack) => rack.length);
    assertInventoryConsistent(state);
    stored.turnStartedAt = Date.now() - 30001;
    store.saveMatch(stored);

    const timeoutMessages = await Promise.all(
      clients.map((client) =>
        client.next(
          (message) =>
            message.type === 'match' &&
            message.match.id === matchId &&
            message.match.revision === 1,
        ),
      ),
    );
    const afterTimeout = timeoutMessages.map(asMatch),
      timeoutBaseline = sharedSnapshot(afterTimeout[0]);
    for (const match of afterTimeout) assert.deepEqual(sharedSnapshot(match), timeoutBaseline);

    const timeoutCanonical = store.loadMatch(matchId),
      timeoutState = timeoutCanonical.state as DigitalGameState;
    assert.equal(timeoutCanonical.revision, 1);
    assert.equal(timeoutState.turn, 1);
    assert.equal(timeoutState.ply, 1);
    assert.equal(timeoutState.lastAction, 'draw');
    assert.equal(timeoutState.emptyPoolPasses, 1);
    assert.equal(timeoutState.drawPool.length, 0);
    assert.equal(timeoutCanonical.drawOffer, null);
    assert.deepEqual(timeoutCanonical.drawAccepts, []);
    assertInventoryConsistent(timeoutState);

    // Seed a valid draw offer from the active seat. The mixed-command race starts at revision 2.
    const seedCommandId = randomUUID();
    const seedWaiters = clients.map((client) =>
      client.next(
        (message) =>
          message.type === 'match' &&
          message.match.id === matchId &&
          message.match.revision === 2 &&
          message.ack === seedCommandId,
      ),
    );
    clients[1].send({
      type: 'draw-offer',
      matchId,
      commandId: seedCommandId,
      expectedRevision: 1,
    });
    await Promise.all(seedWaiters);

    const seeded = store.loadMatch(matchId);
    assert.equal(seeded.revision, 2);
    assert.equal(seeded.state.turn, 1);
    assert.equal(seeded.drawOffer, 1);
    assert.deepEqual(seeded.drawAccepts, [1]);

    // All four commands are distinct and are individually valid/non-terminal at revision 2:
    // - seat 0 accepts the draw offer
    // - active seat 1 performs a Digital draw/pass move
    // - seat 2 rejects the draw offer
    // - seat 3 accepts the draw offer with its own command identity
    // Exactly one may advance revision 2 -> 3; the remaining three must be stale.
    const actions = [
      {
        clientIndex: 0,
        commandId: randomUUID(),
        message: {
          type: 'draw-answer' as const,
          matchId,
          expectedRevision: 2,
          accept: true,
        },
      },
      {
        clientIndex: 1,
        commandId: randomUUID(),
        message: {
          type: 'move' as const,
          matchId,
          expectedRevision: 2,
          move: { type: 'draw' as const },
        },
      },
      {
        clientIndex: 2,
        commandId: randomUUID(),
        message: {
          type: 'draw-answer' as const,
          matchId,
          expectedRevision: 2,
          accept: false,
        },
      },
      {
        clientIndex: 3,
        commandId: randomUUID(),
        message: {
          type: 'draw-answer' as const,
          matchId,
          expectedRevision: 2,
          accept: true,
        },
      },
    ];

    const revisionThreeWaiters = clients.map((client) =>
      client.next(
        (message) =>
          message.type === 'match' &&
          message.match.id === matchId &&
          message.match.revision === 3 &&
          actions.some((action) => action.commandId === message.ack),
      ),
    );

    await Promise.all(
      actions.map(
        (action) =>
          new Promise<void>((resolve) =>
            setImmediate(() => {
              clients[action.clientIndex].send({
                ...action.message,
                commandId: action.commandId,
              });
              resolve();
            }),
          ),
      ),
    );

    const revisionThreeMessages = await Promise.all(revisionThreeWaiters),
      synchronized = revisionThreeMessages.map(asMatch),
      acknowledgements = revisionThreeMessages.map((message) => {
        assert.equal(message.type, 'match');
        if (message.type !== 'match') throw new Error('expected match message');
        return message.ack;
      });
    assert.ok(acknowledgements.every((ack) => ack === acknowledgements[0]));
    const acceptedCommandId = acknowledgements[0];
    assert.ok(acceptedCommandId);
    const acceptedAction = actions.find((action) => action.commandId === acceptedCommandId);
    assert.ok(acceptedAction);
    const rejectedActions = actions.filter((action) => action.commandId !== acceptedCommandId);
    assert.equal(rejectedActions.length, 3);

    await waitUntil(() =>
      rejectedActions.every((action) =>
        clients.some((client) =>
          client.observed.some(
            (message) =>
              message.type === 'error' &&
              message.code === 'stale-revision' &&
              message.commandId === action.commandId,
          ),
        ),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 25));

    const contenderErrors = clients.flatMap((client) =>
      client.observed.filter(
        (message) =>
          message.type === 'error' &&
          actions.some((action) => action.commandId === message.commandId),
      ),
    );
    assert.equal(contenderErrors.length, 3);
    for (const error of contenderErrors) {
      assert.equal(error.type, 'error');
      if (error.type !== 'error') throw new Error('expected error message');
      assert.equal(error.code, 'stale-revision');
    }
    assert.deepEqual(
      new Set(
        contenderErrors.map((error) => {
          assert.equal(error.type, 'error');
          if (error.type !== 'error') throw new Error('expected error message');
          return error.commandId;
        }),
      ),
      new Set(rejectedActions.map((action) => action.commandId)),
    );
    assert.ok(
      !clients.some((client) =>
        client.observed.some(
          (message) => message.type === 'error' && message.commandId === acceptedCommandId,
        ),
      ),
    );

    const canonical = store.loadMatch(matchId),
      canonicalState = canonical.state as DigitalGameState;
    assert.equal(canonical.revision, 3);
    assert.equal(canonical.result, null);
    assert.equal(canonical.endedAt, null);
    assert.equal(canonicalState.drawPool.length, 0);
    assertInventoryConsistent(canonicalState);

    if (acceptedAction!.message.type === 'move') {
      assert.equal(acceptedAction!.clientIndex, 1);
      assert.equal(canonicalState.turn, 2);
      assert.equal(canonicalState.ply, 2);
      assert.equal(canonicalState.lastAction, 'draw');
      assert.equal(canonicalState.emptyPoolPasses, 2);
      assert.equal(canonical.drawOffer, null);
      assert.deepEqual(canonical.drawAccepts, []);
    } else if (acceptedAction!.message.accept) {
      assert.equal(canonicalState.turn, 1);
      assert.equal(canonicalState.ply, 1);
      assert.equal(canonicalState.lastAction, 'draw');
      assert.equal(canonicalState.emptyPoolPasses, 1);
      assert.equal(canonical.drawOffer, 1);
      assert.deepEqual(canonical.drawAccepts, [1, acceptedAction!.clientIndex]);
    } else {
      assert.equal(acceptedAction!.clientIndex, 2);
      assert.equal(canonicalState.turn, 1);
      assert.equal(canonicalState.ply, 1);
      assert.equal(canonicalState.lastAction, 'draw');
      assert.equal(canonicalState.emptyPoolPasses, 1);
      assert.equal(canonical.drawOffer, null);
      assert.deepEqual(canonical.drawAccepts, []);
    }

    const baseline = sharedSnapshot(synchronized[0]);
    for (const match of synchronized) {
      assert.deepEqual(sharedSnapshot(match), baseline);
      assert.equal(match.revision, 3);
      const projected = match.state as DigitalGameState;
      assert.equal(projected.turn, canonicalState.turn);
      assert.equal(projected.ply, canonicalState.ply);
      assert.equal(projected.lastAction, canonicalState.lastAction);
      assert.equal(projected.emptyPoolPasses, canonicalState.emptyPoolPasses);
      assert.equal(match.drawOffer, canonical.drawOffer);
      assert.deepEqual(match.drawAccepts, canonical.drawAccepts);
    }
    assert.deepEqual(baseline, {
      id: matchId,
      revision: canonical.revision,
      turn: canonicalState.turn,
      ply: canonicalState.ply,
      rackCounts: canonicalState.rackCounts,
      drawPoolCount: canonicalState.drawPool.length,
      table: canonicalState.table,
      lastAction: canonicalState.lastAction,
      emptyPoolPasses: canonicalState.emptyPoolPasses,
      clockMs: canonical.clockMs,
      turnStartedAt: canonical.turnStartedAt,
      drawOffer: canonical.drawOffer,
      drawAccepts: canonical.drawAccepts,
      result: canonical.result,
      endedAt: canonical.endedAt,
    });

    for (let clientIndex = 0; clientIndex < synchronized.length; clientIndex++) {
      const match = synchronized[clientIndex],
        projected = match.state as DigitalGameState,
        seat = match.players.findIndex((player) => player.id === users[clientIndex].profile.id);
      assert.ok(seat >= 0);
      assert.equal(projected.viewerSeat, seat);
      assert.deepEqual(projected.rackCounts, canonicalState.rackCounts);
      assert.deepEqual(projected.racks[seat], canonicalState.racks[seat]);
    }

    const resultRows = store.db
      .prepare('SELECT reason FROM results WHERE match_id=?')
      .all(matchId) as { reason: string }[];
    assert.deepEqual(resultRows, []);
  } finally {
    sockets.forEach((socket) => socket.terminate());
    await app.close();
    store.close();
  }
});

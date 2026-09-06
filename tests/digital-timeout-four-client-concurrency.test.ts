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

test('four Digital clients accept only one concurrent action after an empty-pool timeout and stay synchronized', async () => {
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
        guest('RaceAlice4'),
        guest('RaceBob4'),
        guest('RaceCarol4'),
        guest('RaceDave4'),
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

    // Exhaust the draw pool without losing any authoritative tile.
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
    const afterTimeout = timeoutMessages.map(asMatch);
    const timeoutBaseline = sharedSnapshot(afterTimeout[0]);
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

    // Two different clients submit revision-1 actions in the same event-loop phase.
    // Draw offers are intentionally turn-independent, so either contender can win the race;
    // optimistic revision control must accept exactly one and reject the other as stale.
    const contenderIndexes = [1, 2] as const,
      actions = contenderIndexes.map((clientIndex) => ({
        type: 'draw-offer' as const,
        matchId,
        commandId: randomUUID(),
        expectedRevision: 1,
        clientIndex,
      }));

    const revisionTwoWaiters = clients.map((client) =>
      client.next(
        (message) =>
          message.type === 'match' &&
          message.match.id === matchId &&
          message.match.revision === 2,
      ),
    );

    await Promise.all(
      actions.map(
        (action) =>
          new Promise<void>((resolve) =>
            setImmediate(() => {
              clients[action.clientIndex].send({
                type: action.type,
                matchId: action.matchId,
                commandId: action.commandId,
                expectedRevision: action.expectedRevision,
              });
              resolve();
            }),
          ),
      ),
    );

    const revisionTwoMessages = await Promise.all(revisionTwoWaiters),
      synchronized = revisionTwoMessages.map(asMatch),
      acknowledgements = revisionTwoMessages.map((message) => {
        assert.equal(message.type, 'match');
        if (message.type !== 'match') throw new Error('expected match message');
        return message.ack;
      });
    assert.ok(acknowledgements.every((ack) => ack === acknowledgements[0]));
    const acceptedCommandId = acknowledgements[0];
    assert.ok(acceptedCommandId);
    assert.ok(actions.some((action) => action.commandId === acceptedCommandId));
    const acceptedAction = actions.find((action) => action.commandId === acceptedCommandId)!;
    const rejectedAction = actions.find((action) => action.commandId !== acceptedCommandId)!;

    await waitUntil(() =>
      clients.some((client) =>
        client.observed.some(
          (message) =>
            message.type === 'error' &&
            message.code === 'stale-revision' &&
            message.commandId === rejectedAction.commandId,
        ),
      ),
    );
    // Give the server one extra turn to expose any accidental second rejection/acceptance.
    await new Promise((resolve) => setTimeout(resolve, 25));

    const contenderOutcomes = clients.flatMap((client) =>
      client.observed.filter(
        (message) =>
          message.type === 'error' &&
          actions.some((action) => action.commandId === message.commandId),
      ),
    );
    assert.equal(contenderOutcomes.length, 1);
    assert.equal(contenderOutcomes[0].type, 'error');
    if (contenderOutcomes[0].type !== 'error') throw new Error('expected error message');
    assert.equal(contenderOutcomes[0].code, 'stale-revision');
    assert.equal(contenderOutcomes[0].commandId, rejectedAction.commandId);
    assert.ok(
      !clients.some((client) =>
        client.observed.some(
          (message) => message.type === 'error' && message.commandId === acceptedAction.commandId,
        ),
      ),
    );

    const canonical = store.loadMatch(matchId),
      canonicalState = canonical.state as DigitalGameState,
      acceptedSeat = canonical.players.findIndex(
        (player) => player.id === users[acceptedAction.clientIndex].profile.id,
      );
    assert.ok(acceptedSeat >= 0);
    assert.equal(canonical.revision, 2);
    assert.equal(canonicalState.turn, 1);
    assert.equal(canonicalState.ply, 1);
    assert.equal(canonicalState.lastAction, 'draw');
    assert.equal(canonicalState.emptyPoolPasses, 1);
    assert.equal(canonicalState.drawPool.length, 0);
    assert.equal(canonical.drawOffer, acceptedSeat);
    assert.deepEqual(canonical.drawAccepts, [acceptedSeat]);
    assert.equal(canonical.result, null);
    assert.equal(canonical.endedAt, null);
    assertInventoryConsistent(canonicalState);

    const baseline = sharedSnapshot(synchronized[0]);
    for (const match of synchronized) {
      const projected = match.state as DigitalGameState;
      assert.deepEqual(sharedSnapshot(match), baseline);
      assert.equal(match.revision, 2);
      assert.equal(projected.turn, 1);
      assert.equal(projected.ply, 1);
      assert.equal(projected.lastAction, 'draw');
      assert.equal(projected.emptyPoolPasses, 1);
      assert.equal(match.drawOffer, acceptedSeat);
      assert.deepEqual(match.drawAccepts, [acceptedSeat]);
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

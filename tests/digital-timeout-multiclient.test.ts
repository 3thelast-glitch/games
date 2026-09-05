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

type TestClient = ReturnType<typeof connectClient>;

function connectClient(port: number, sockets: WebSocket[]) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    origin: 'http://localhost',
  });
  sockets.push(ws);
  const messages: ServerMessage[] = [];
  const waiters: {
    predicate: (message: ServerMessage) => boolean;
    resolve: (message: ServerMessage) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];

  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString()) as ServerMessage;
    const index = waiters.findIndex((waiter) => waiter.predicate(message));
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else messages.push(message);
  });

  return {
    ws,
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
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
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

function sharedDigitalSnapshot(match: MatchSnapshot) {
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
    result: match.result,
    endedAt: match.endedAt,
  };
}

test('Digital empty-pool timeout broadcasts the same revision, turn and shared state to every client', async () => {
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
    const users = await Promise.all([guest('Alice'), guest('Bob'), guest('Carol')]),
      clients: TestClient[] = [
        connectClient(port, sockets),
        connectClient(port, sockets),
        connectClient(port, sockets),
      ];

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
      playerCount: 3,
      turnSeconds: 30,
    });
    const roomMessage = await clients[0].next((message) => message.type === 'room');
    assert.equal(roomMessage.type, 'room');
    if (roomMessage.type !== 'room') throw new Error('expected room message');

    clients[1].send({ type: 'join-room', code: roomMessage.code });
    await clients[1].next((message) => message.type === 'room');
    clients[2].send({ type: 'join-room', code: roomMessage.code });

    const initialMatches = (
      await Promise.all(
        clients.map((client) =>
          client.next((message) => message.type === 'match' && message.match.revision === 0),
        ),
      )
    ).map(asMatch);
    const matchId = initialMatches[0].id;
    assert.ok(initialMatches.every((match) => match.id === matchId && match.revision === 0));

    const stored = store.loadMatch(matchId),
      state = stored.state as DigitalGameState;
    assert.equal(state.turn, 0);
    assert.ok(state.drawPool.length > 0);

    // Empty the pool without losing any tile: move the remaining pool into the last rack.
    state.racks[2].push(...state.drawPool);
    state.drawPool = [];
    state.rackCounts = state.racks.map((rack) => rack.length);
    const racksBefore = state.racks.map((rack) => [...rack]);
    stored.turnStartedAt = Date.now() - 30001;
    store.saveMatch(stored);

    const synchronized = (
      await Promise.all(
        clients.map((client) =>
          client.next(
            (message) =>
              message.type === 'match' &&
              message.match.id === matchId &&
              message.match.revision === 1,
          ),
        ),
      )
    ).map(asMatch);

    const canonical = store.loadMatch(matchId),
      canonicalState = canonical.state as DigitalGameState;
    assert.equal(canonical.revision, 1);
    assert.equal(canonical.result, null);
    assert.equal(canonical.endedAt, null);
    assert.equal(canonicalState.turn, 1);
    assert.equal(canonicalState.ply, 1);
    assert.equal(canonicalState.lastAction, 'draw');
    assert.equal(canonicalState.emptyPoolPasses, 1);
    assert.equal(canonicalState.drawPool.length, 0);
    assert.deepEqual(canonicalState.racks, racksBefore);
    assert.deepEqual(canonical.clockMs, [30000, 30000, 30000]);

    const baseline = sharedDigitalSnapshot(synchronized[0]);
    for (const match of synchronized) assert.deepEqual(sharedDigitalSnapshot(match), baseline);
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
      assert.ok(projected.racks.every((rack, index) => rack.length === canonicalState.rackCounts[index]));
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

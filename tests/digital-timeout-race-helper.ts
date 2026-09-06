import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { createArenaServer } from '../apps/server/src/server.ts';
import { Store } from '../apps/server/src/store.ts';
import {
  PROTOCOL_VERSION,
  type MatchSnapshot,
  type ServerMessage,
} from '../packages/core/src/protocol.ts';
import type { DigitalGameState } from '../packages/games/digital-game/state.ts';

interface User {
  token: string;
  profile: { id: string };
}

type ArenaApp = ReturnType<typeof createArenaServer>;
type Client = ReturnType<typeof connectClient>;

interface Fixture {
  store: Store;
  app: ArenaApp;
  sockets: WebSocket[];
  users: User[];
  clients: Client[];
  matchId: string;
  startingSeat: number;
  activeSeat: number;
  canonical: ReturnType<Store['loadMatch']>;
  state: DigitalGameState;
}

function connectClient(port: number, sockets: WebSocket[]) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'http://localhost' });
  sockets.push(ws);
  const queued: ServerMessage[] = [],
    observed: ServerMessage[] = [],
    waiters: Array<{
      predicate: (message: ServerMessage) => boolean;
      resolve: (message: ServerMessage) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }> = [];

  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString()) as ServerMessage;
    observed.push(message);
    const index = waiters.findIndex((waiter) => waiter.predicate(message));
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else queued.push(message);
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
      const index = queued.findIndex(predicate);
      if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0]);
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

async function waitUntil(predicate: () => boolean, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('condition timeout');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function setupEmptyPoolTimeout(playerCount: 3 | 4, prefix: string): Promise<Fixture> {
  const store = new Store(),
    app = createArenaServer({ store, env: {}, allowedOrigins: ['http://localhost'] });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const port = (app.server.address() as { port: number }).port,
    base = `http://127.0.0.1:${port}`,
    sockets: WebSocket[] = [];

  const guest = async (name: string): Promise<User> => {
    const response = await fetch(base + '/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    assert.equal(response.status, 201);
    return response.json() as Promise<User>;
  };

  try {
    const users = await Promise.all(
        Array.from({ length: playerCount }, (_, index) => guest(`${prefix}-${index + 1}`)),
      ),
      clients = Array.from({ length: playerCount }, () => connectClient(port, sockets));

    await Promise.all(clients.map((client) => client.open()));
    clients.forEach((client, index) =>
      client.send({ type: 'auth', version: PROTOCOL_VERSION, token: users[index].token }),
    );
    await Promise.all(clients.map((client) => client.next((message) => message.type === 'ready')));

    clients[0].send({
      type: 'create-room',
      gameId: 'digitalGame',
      playerCount,
      turnSeconds: 60,
    });
    const room = await clients[0].next((message) => message.type === 'room');
    assert.equal(room.type, 'room');
    if (room.type !== 'room') throw new Error('expected room message');
    assert.equal(room.turnSeconds, 60);

    for (let index = 1; index < playerCount; index++) {
      clients[index].send({ type: 'join-room', code: room.code });
      if (index < playerCount - 1)
        await clients[index].next((message) => message.type === 'room');
    }

    const initial = (
      await Promise.all(
        clients.map((client) =>
          client.next((message) => message.type === 'match' && message.match.revision === 0),
        ),
      )
    ).map(asMatch);
    const matchId = initial[0].id;
    assert.ok(initial.every((match) => match.id === matchId && match.revision === 0));
    assert.ok(initial.every((match) => match.timeControl.mode === 'turn' && match.timeControl.turnMs === 60000));

    const stored = store.loadMatch(matchId),
      state = stored.state as DigitalGameState,
      startingSeat = state.turn;
    assert.equal(state.playerCount, playerCount);
    assert.equal(state.startingSeat, startingSeat);
    assert.ok(state.drawPool.length > 0);

    const poolHolder = (startingSeat + playerCount - 1) % playerCount;
    state.racks[poolHolder].push(...state.drawPool);
    state.drawPool = [];
    state.rackCounts = state.racks.map((rack) => rack.length);
    assertInventoryConsistent(state);

    const tableBefore = structuredClone(state.table),
      racksBefore = structuredClone(state.racks);
    stored.turnStartedAt = Date.now() - 60001;
    store.saveMatch(stored);

    const timeoutMatches = (
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
      timeoutState = canonical.state as DigitalGameState,
      activeSeat = (startingSeat + 1) % playerCount,
      baseline = sharedSnapshot(timeoutMatches[0]);

    assert.equal(canonical.revision, 1);
    assert.equal(canonical.result, null);
    assert.equal(canonical.endedAt, null);
    assert.equal(timeoutState.turn, activeSeat);
    assert.equal(timeoutState.ply, 1);
    assert.equal(timeoutState.lastAction, 'timeout');
    assert.equal(timeoutState.emptyPoolPasses, 1);
    assert.equal(timeoutState.drawPool.length, 0);
    assert.deepEqual(timeoutState.table, tableBefore);
    assert.deepEqual(timeoutState.racks, racksBefore);
    assert.equal(canonical.drawOffer, null);
    assert.deepEqual(canonical.drawAccepts, []);
    assertInventoryConsistent(timeoutState);

    for (const match of timeoutMatches) assert.deepEqual(sharedSnapshot(match), baseline);
    for (let clientIndex = 0; clientIndex < timeoutMatches.length; clientIndex++) {
      const match = timeoutMatches[clientIndex],
        projected = match.state as DigitalGameState,
        seat = match.players.findIndex((player) => player.id === users[clientIndex].profile.id);
      assert.ok(seat >= 0);
      assert.equal(projected.viewerSeat, seat);
      assert.deepEqual(projected.rackCounts, timeoutState.rackCounts);
      assert.deepEqual(projected.racks[seat], timeoutState.racks[seat]);
    }

    return { store, app, sockets, users, clients, matchId, startingSeat, activeSeat, canonical, state: timeoutState };
  } catch (error) {
    sockets.forEach((socket) => socket.terminate());
    await app.close();
    store.close();
    throw error;
  }
}

async function cleanup(fixture: Fixture) {
  fixture.sockets.forEach((socket) => socket.terminate());
  await fixture.app.close();
  fixture.store.close();
}

function clientIndexForSeat(fixture: Fixture, seat: number): number {
  const playerId = fixture.canonical.players[seat].id,
    index = fixture.users.findIndex((user) => user.profile.id === playerId);
  assert.ok(index >= 0);
  return index;
}

export async function assertEmptyPoolTimeoutBroadcast(playerCount: 3 | 4, prefix: string) {
  const fixture = await setupEmptyPoolTimeout(playerCount, prefix);
  try {
    const rows = fixture.store.db
      .prepare('SELECT reason FROM results WHERE match_id=?')
      .all(fixture.matchId) as { reason: string }[];
    assert.deepEqual(rows, []);
    assert.equal(fixture.state.lastAction, 'timeout');
  } finally {
    await cleanup(fixture);
  }
}

export async function assertDrawOfferRevisionRace(contenderCount: 2 | 3 | 4, prefix: string) {
  const fixture = await setupEmptyPoolTimeout(4, prefix);
  try {
    const actions = Array.from({ length: contenderCount }, (_, clientIndex) => ({
      clientIndex,
      commandId: randomUUID(),
    }));

    const revisionTwoWaiters = fixture.clients.map((client) =>
      client.next(
        (message) =>
          message.type === 'match' &&
          message.match.id === fixture.matchId &&
          message.match.revision === 2 &&
          actions.some((action) => action.commandId === message.ack),
      ),
    );

    await Promise.all(
      actions.map(
        (action) =>
          new Promise<void>((resolve) =>
            setImmediate(() => {
              fixture.clients[action.clientIndex].send({
                type: 'draw-offer',
                matchId: fixture.matchId,
                commandId: action.commandId,
                expectedRevision: 1,
              });
              resolve();
            }),
          ),
      ),
    );

    const messages = await Promise.all(revisionTwoWaiters),
      matches = messages.map(asMatch),
      ack = messages[0].type === 'match' ? messages[0].ack : undefined;
    assert.ok(ack);
    assert.ok(messages.every((message) => message.type === 'match' && message.ack === ack));
    const accepted = actions.find((action) => action.commandId === ack);
    assert.ok(accepted);
    const rejected = actions.filter((action) => action.commandId !== ack);

    await waitUntil(() =>
      rejected.every((action) =>
        fixture.clients.some((client) =>
          client.observed.some(
            (message) =>
              message.type === 'error' &&
              message.code === 'stale-revision' &&
              message.commandId === action.commandId,
          ),
        ),
      ),
    );

    const canonical = fixture.store.loadMatch(fixture.matchId),
      state = canonical.state as DigitalGameState,
      acceptedSeat = canonical.players.findIndex(
        (player) => player.id === fixture.users[accepted!.clientIndex].profile.id,
      );
    assert.equal(canonical.revision, 2);
    assert.equal(state.turn, fixture.activeSeat);
    assert.equal(state.ply, 1);
    assert.equal(state.lastAction, 'timeout');
    assert.equal(canonical.drawOffer, acceptedSeat);
    assert.deepEqual(canonical.drawAccepts, [acceptedSeat]);
    assert.equal(rejected.length, contenderCount - 1);

    const baseline = sharedSnapshot(matches[0]);
    for (const match of matches) assert.deepEqual(sharedSnapshot(match), baseline);
  } finally {
    await cleanup(fixture);
  }
}

export async function assertMixedRevisionRace(prefix: string) {
  const fixture = await setupEmptyPoolTimeout(4, prefix);
  try {
    const activeClient = clientIndexForSeat(fixture, fixture.activeSeat),
      seedId = randomUUID(),
      seedWaiters = fixture.clients.map((client) =>
        client.next(
          (message) =>
            message.type === 'match' &&
            message.match.id === fixture.matchId &&
            message.match.revision === 2 &&
            message.ack === seedId,
        ),
      );
    fixture.clients[activeClient].send({
      type: 'draw-offer',
      matchId: fixture.matchId,
      commandId: seedId,
      expectedRevision: 1,
    });
    await Promise.all(seedWaiters);

    const otherClients = [0, 1, 2, 3].filter((index) => index !== activeClient),
      actions = [
        {
          clientIndex: activeClient,
          commandId: randomUUID(),
          payload: { type: 'move', move: { type: 'pass' } },
        },
        {
          clientIndex: otherClients[0],
          commandId: randomUUID(),
          payload: { type: 'draw-answer', accept: true },
        },
        {
          clientIndex: otherClients[1],
          commandId: randomUUID(),
          payload: { type: 'draw-answer', accept: false },
        },
        {
          clientIndex: otherClients[2],
          commandId: randomUUID(),
          payload: { type: 'draw-answer', accept: true },
        },
      ];

    const revisionThreeWaiters = fixture.clients.map((client) =>
      client.next(
        (message) =>
          message.type === 'match' &&
          message.match.id === fixture.matchId &&
          message.match.revision === 3 &&
          actions.some((action) => action.commandId === message.ack),
      ),
    );

    await Promise.all(
      actions.map(
        (action) =>
          new Promise<void>((resolve) =>
            setImmediate(() => {
              fixture.clients[action.clientIndex].send({
                ...action.payload,
                matchId: fixture.matchId,
                commandId: action.commandId,
                expectedRevision: 2,
              });
              resolve();
            }),
          ),
      ),
    );

    const messages = await Promise.all(revisionThreeWaiters),
      matches = messages.map(asMatch),
      ack = messages[0].type === 'match' ? messages[0].ack : undefined;
    assert.ok(ack);
    const accepted = actions.find((action) => action.commandId === ack);
    assert.ok(accepted);
    const rejected = actions.filter((action) => action.commandId !== ack);

    await waitUntil(() =>
      rejected.every((action) =>
        fixture.clients.some((client) =>
          client.observed.some(
            (message) =>
              message.type === 'error' &&
              message.code === 'stale-revision' &&
              message.commandId === action.commandId,
          ),
        ),
      ),
    );

    const canonical = fixture.store.loadMatch(fixture.matchId),
      state = canonical.state as DigitalGameState;
    assert.equal(canonical.revision, 3);
    assert.equal(canonical.result, null);
    assert.equal(state.drawPool.length, 0);
    assertInventoryConsistent(state);

    if (accepted!.payload.type === 'move') {
      assert.equal(state.turn, (fixture.activeSeat + 1) % 4);
      assert.equal(state.ply, 2);
      assert.equal(state.lastAction, 'pass');
      assert.equal(canonical.drawOffer, null);
      assert.deepEqual(canonical.drawAccepts, []);
    } else if (accepted!.payload.accept === true) {
      const acceptedSeat = canonical.players.findIndex(
        (player) => player.id === fixture.users[accepted!.clientIndex].profile.id,
      );
      assert.equal(state.turn, fixture.activeSeat);
      assert.equal(state.ply, 1);
      assert.equal(state.lastAction, 'timeout');
      assert.equal(canonical.drawOffer, fixture.activeSeat);
      assert.deepEqual(canonical.drawAccepts, [fixture.activeSeat, acceptedSeat]);
    } else {
      assert.equal(state.turn, fixture.activeSeat);
      assert.equal(state.ply, 1);
      assert.equal(state.lastAction, 'timeout');
      assert.equal(canonical.drawOffer, null);
      assert.deepEqual(canonical.drawAccepts, []);
    }

    const baseline = sharedSnapshot(matches[0]);
    for (const match of matches) assert.deepEqual(sharedSnapshot(match), baseline);
    assert.equal(rejected.length, 3);
  } finally {
    await cleanup(fixture);
  }
}
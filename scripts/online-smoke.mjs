#!/usr/bin/env node
// NAQLA HTTPS/WSS smoke test.
// --mutating creates four guest accounts and two matches; use STAGING only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

const argv = process.argv.slice(2);
const mutating = argv.includes('--mutating');
const timeout = 15000;
function serverOrigin() {
  const i = argv.indexOf('--url');
  const raw = i < 0 ? process.env.NAQLA_SERVER_URL : argv[i + 1];
  if (!raw || raw.startsWith('--')) throw Error('Specify --url https://ACTUAL-HOST');
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.pathname !== '/' || u.search || u.hash ||
      u.username || u.password || (u.port && u.port !== '443') ||
      u.hostname === 'localhost' || u.hostname.endsWith('.localhost') ||
      u.hostname === 'example.com' || u.hostname.endsWith('.example.com') ||
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname))
    throw Error('Use a real public HTTPS origin without paths or credentials');
  return u.origin;
}
class Client {
  constructor(ws) {
    this.ws = ws;
    this.inbox = [];
    this.waiters = [];
    ws.on('message', (bytes) => {
      let msg;
      try { msg = JSON.parse(bytes.toString()); } catch { return; }
      const i = this.waiters.findIndex((item) => item.match(msg));
      if (i === -1) this.inbox.push(msg);
      else {
        const [item] = this.waiters.splice(i, 1);
        clearTimeout(item.timer);
        item.resolve(msg);
      }
    });
    ws.on('close', () => {
      for (const item of this.waiters.splice(0)) {
        clearTimeout(item.timer);
        item.reject(Error('WebSocket closed unexpectedly'));
      }
    });
  }
  static async open(origin, token) {
    const ws = new WebSocket(origin.replace(/^https:/, 'wss:') + '/ws', {
      origin, handshakeTimeout: timeout,
    });
    const conn = new Client(ws);
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('WSS upgrade timed out')), timeout);
        const opened = () => {
          clearTimeout(timer);
          ws.off('error', failed);
          resolve();
        };
        const failed = (e) => {
          clearTimeout(timer);
          ws.off('open', opened);
          reject(e);
        };
        ws.once('open', opened);
        ws.once('error', failed);
      });
      if (token) {
        conn.send({ type: 'auth', version: 3, token });
        await conn.next((m) => m.type === 'ready');
      }
      return conn;
    } catch (e) { ws.terminate(); throw e; }
  }
  send(payload) {
    assert.equal(this.ws.readyState, WebSocket.OPEN);
    this.ws.send(JSON.stringify(payload));
  }
  next(match) {
    const i = this.inbox.findIndex(match);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const item = { match, resolve, reject, timer: null };
      item.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== item);
        reject(Error('Expected server message timed out'));
      }, timeout);
      this.waiters.push(item);
    });
  }
  close() { this.ws.terminate(); }
}
async function api(origin, path, body) {
  const response = await fetch(origin + path, {
    method: body ? 'POST' : 'GET',
    headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const payload = await response.json();
  assert.ok(response.ok, path + ' HTTP ' + response.status + ' ' + JSON.stringify(payload));
  return payload;
}
async function smoke(origin) {
  const health = await api(origin, '/api/health');
  assert.equal(health.ok, true);
  assert.equal(health.protocol, 3);
  assert.ok(health.games.includes('connectFour'));
  console.log('PASS HTTPS health and protocol');
  const probe = await Client.open(origin);
  probe.close();
  console.log('PASS TLS WSS /ws upgrade and Origin');
  if (!mutating) {
    console.log('Read-only checks complete; --mutating is staging-only.');
    return;
  }
  const clients = [];
  const connect = async (token) => {
    const client = await Client.open(origin, token);
    clients.push(client);
    return client;
  };
  const guest = async (prefix) => {
    const data = await api(origin, '/api/auth/guest', {
      name: prefix + randomUUID().slice(0, 6),
    });
    assert.ok(data.token && data.profile?.id);
    return data;
  };
  try {
    const first = await guest('SmokeA');
    const second = await guest('SmokeB');
    assert.notEqual(first.profile.id, second.profile.id);
    const a = await connect(first.token);
    const b = await connect(second.token);
    console.log('PASS two authenticated accounts');
    a.send({ type: 'create-room', gameId: 'connectFour', playerCount: 2 });
    const room = await a.next((m) => m.type === 'room' && m.joined === 1);
    assert.match(room.code, /^[A-Z2-9]{6}$/);
    b.send({ type: 'join-room', code: room.code });
    const ma = await a.next((m) => m.type === 'match' && m.match.gameId === 'connectFour');
    const mb = await b.next((m) => m.type === 'match' && m.match.id === ma.match.id);
    assert.equal(ma.match.revision, 0);
    assert.equal(ma.match.players[0].id, first.profile.id);
    assert.equal(mb.match.players[1].id, second.profile.id);
    console.log('PASS private-room join and sync');
    b.send({ type: 'move', matchId: ma.match.id, commandId: randomUUID(),
      expectedRevision: 0, move: { column: 4 } });
    assert.equal((await b.next((m) => m.type === 'error')).code, 'not-your-turn');
    a.send({ type: 'move', matchId: ma.match.id, commandId: randomUUID(),
      expectedRevision: 0, move: { column: 3 } });
    const a1 = await a.next((m) => m.type === 'match' && m.match.id === ma.match.id && m.match.revision === 1);
    const b1 = await b.next((m) => m.type === 'match' && m.match.id === ma.match.id && m.match.revision === 1);
    assert.deepEqual(a1.match.state.board, b1.match.state.board);
    b.send({ type: 'move', matchId: ma.match.id, commandId: randomUUID(),
      expectedRevision: 1, move: { column: 4 } });
    const a2 = await a.next((m) => m.type === 'match' && m.match.id === ma.match.id && m.match.revision === 2);
    const b2 = await b.next((m) => m.type === 'match' && m.match.id === ma.match.id && m.match.revision === 2);
    assert.deepEqual(a2.match.state.board, b2.match.state.board);
    console.log('PASS out-of-turn rejection and synchronized moves');
    b.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const recovered = await connect(second.token);
    recovered.send({ type: 'resume', matchId: ma.match.id });
    const resumed = await recovered.next((m) => m.type === 'match' &&
      m.match.id === ma.match.id && m.match.revision === 2);
    assert.deepEqual(resumed.match.state.board, a2.match.state.board);
    console.log('PASS reconnection and resume');
    const third = await guest('SmokeC');
    const fourth = await guest('SmokeD');
    const c = await connect(third.token);
    const d = await connect(fourth.token);
    c.send({ type: 'queue', gameId: 'connectFour', ranked: false, playerCount: 2 });
    d.send({ type: 'queue', gameId: 'connectFour', ranked: false, playerCount: 2 });
    const quickC = await c.next((m) => m.type === 'match' && m.match.gameId === 'connectFour');
    const quickD = await d.next((m) => m.type === 'match' && m.match.id === quickC.match.id);
    assert.notEqual(quickC.match.id, ma.match.id);
    assert.deepEqual(quickC.match.players.map((p) => p.id), quickD.match.players.map((p) => p.id));
    console.log('PASS casual Quick Match between independent clients');
    console.log('STAGING SMOKE COMPLETE. Real devices/networks and ranked Elo remain separate QA.');
  } finally {
    for (const client of clients) client.close();
  }
}
if (argv.includes('--help')) {
  console.log('Usage: node scripts/online-smoke.mjs --url https://HOST [--mutating]');
} else {
  const unknown = argv.filter((arg, i) => arg !== '--url' &&
    arg !== '--mutating' && argv[i - 1] !== '--url');
  if (unknown.length) throw Error('Unknown arguments: ' + unknown.join(', '));
  await smoke(serverOrigin());
}

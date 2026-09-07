import { z } from 'zod';
import { RuleError, isGameOver, opponent, type GamePlugin, type Seat } from './game.ts';
import { isTurnTimerMs, type TurnTimerSeconds } from './timing.ts';
export type { TurnTimerSeconds } from './timing.ts';

export const LAN_PROTOCOL_VERSION = 1;
export const LAN_RULESET_VERSION = 1;
export const LAN_SERVICE_TYPE = '_boardarena._tcp.';
export const LAN_DEFAULT_PORT = 8765;
export const LAN_GRACE_MS = 60_000;

const id = z.string().min(8).max(96);
const name = z.string().trim().min(1).max(24);
const move = z.object({ row: z.number().int().min(0).max(7), col: z.number().int().min(0).max(7) }).strict();

export const lanClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), protocolVersion: z.literal(LAN_PROTOCOL_VERSION), rulesetVersion: z.literal(LAN_RULESET_VERSION), roomId: id, name, resumeToken: z.string().min(16).max(128).optional() }).strict(),
  z.object({ type: z.literal('ready'), ready: z.boolean() }).strict(),
  z.object({ type: z.literal('move'), matchId: id, actionId: id, expectedRevision: z.number().int().nonnegative(), move }).strict(),
  z.object({ type: z.literal('sync'), matchId: id.optional() }).strict(),
  z.object({ type: z.literal('rematch'), matchId: id }).strict(),
  z.object({ type: z.literal('leave') }).strict(),
  z.object({ type: z.literal('ping'), nonce: z.string().max(80).optional() }).strict(),
]);

export type LanClientMessage = z.infer<typeof lanClientMessageSchema>;

export interface LanPlayer {
  id: string;
  name: string;
  seat: Seat;
  connected: boolean;
  ready: boolean;
}

export type LanStatus = 'lobby' | 'playing' | 'finished' | 'interrupted';

export interface LanSnapshot {
  protocolVersion: typeof LAN_PROTOCOL_VERSION;
  rulesetVersion: typeof LAN_RULESET_VERSION;
  roomId: string;
  roomName: string;
  gameId: 'reversi';
  matchId: string | null;
  revision: number;
  status: LanStatus;
  players: LanPlayer[];
  state: ReturnType<GamePlugin['create']> | null;
  result: { winner: Seat | null; reason: string } | null;
  turnSeconds: TurnTimerSeconds | null;
  turnStartedAt: number | null;
  graceMs: number;
  disconnectedAt: [number | null, number | null];
  rematchVotes: Seat[];
  serverNow: number;
}

export type LanServerMessage =
  | { type: 'welcome'; resumeToken: string; self: 0 | 1; snapshot: LanSnapshot }
  | { type: 'snapshot'; snapshot: LanSnapshot; ack?: string }
  | { type: 'error'; code: string; actionId?: string; snapshot?: LanSnapshot }
  | { type: 'pong'; nonce?: string; serverNow: number };

export const lanServerMessageSchema: z.ZodType<LanServerMessage> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('welcome'), resumeToken: z.string().min(16).max(128), self: z.union([z.literal(0), z.literal(1)]), snapshot: z.unknown() }).strict(),
  z.object({ type: z.literal('snapshot'), snapshot: z.unknown(), ack: z.string().optional() }).strict(),
  z.object({ type: z.literal('error'), code: z.string().min(1).max(80), actionId: z.string().optional(), snapshot: z.unknown().optional() }).strict(),
  z.object({ type: z.literal('pong'), nonce: z.string().optional(), serverNow: z.number() }).strict(),
]) as z.ZodType<LanServerMessage>;

export interface LanAdvertisement {
  roomId: string;
  roomName: string;
  gameId: 'reversi';
  protocolVersion: typeof LAN_PROTOCOL_VERSION;
  rulesetVersion: typeof LAN_RULESET_VERSION;
  occupancy: 1 | 2;
  capacity: 2;
  port: number;
}

export const lanAdvertisementSchema = z.object({
  roomId: id,
  roomName: z.string().trim().min(1).max(32),
  gameId: z.literal('reversi'),
  protocolVersion: z.literal(LAN_PROTOCOL_VERSION),
  rulesetVersion: z.literal(LAN_RULESET_VERSION),
  occupancy: z.union([z.literal(1), z.literal(2)]),
  capacity: z.literal(2),
  port: z.number().int().min(1).max(65535),
}).strict();

export interface ParsedLanEndpoint { host: string; port: number }

export function parseLanEndpoint(value: string, defaultPort = LAN_DEFAULT_PORT): ParsedLanEndpoint {
  const input = value.trim();
  if (!input || input.length > 260 || /[\s/@?#\\]/.test(input)) throw new RuleError('invalid-lan-address');
  let host = '';
  let port = defaultPort;
  if (input.startsWith('[')) {
    const end = input.indexOf(']');
    if (end < 2) throw new RuleError('invalid-lan-address');
    host = input.slice(1, end);
    const rest = input.slice(end + 1);
    if (rest) {
      if (!/^:\d{1,5}$/.test(rest)) throw new RuleError('invalid-lan-address');
      port = Number(rest.slice(1));
    }
  } else {
    const colons = (input.match(/:/g) ?? []).length;
    if (colons === 1) {
      const [candidateHost, candidatePort] = input.split(':');
      host = candidateHost;
      if (!/^\d{1,5}$/.test(candidatePort)) throw new RuleError('invalid-lan-address');
      port = Number(candidatePort);
    } else host = input;
  }
  if (!host || host.length > 253 || port < 1 || port > 65535) throw new RuleError('invalid-lan-address');
  if (!/^[A-Za-z0-9:._%-]+$/.test(host)) throw new RuleError('invalid-lan-address');
  return { host, port };
}

interface Session {
  token: string;
  id: string;
  name: string;
  seat: 0 | 1;
  connected: boolean;
  ready: boolean;
  disconnectedAt: number | null;
}
interface Receipt { fingerprint: string; message: LanServerMessage }

export interface LanAuthorityOptions {
  game: GamePlugin;
  hostName: string;
  roomName?: string;
  roomId?: string;
  hostSeat?: 0 | 1;
  turnSeconds?: TurnTimerSeconds | null;
  graceMs?: number;
  now?: () => number;
  randomId?: () => string;
}

/** Friendly-LAN host authority. Membership tokens authenticate seats but do not encrypt the transport. */
export class LanAuthority {
  readonly roomId: string;
  readonly roomName: string;
  readonly graceMs: number;
  readonly hostToken: string;
  private readonly now: () => number;
  private readonly randomId: () => string;
  private readonly sessions = new Map<string, Session>();
  private readonly receipts = new Map<string, Receipt>();
  private state: ReturnType<GamePlugin['create']> | null = null;
  private matchId: string | null = null;
  private revision = 0;
  private status: LanStatus = 'lobby';
  private result: LanSnapshot['result'] = null;
  private turnStartedAt: number | null = null;
  private rematchVotes = new Set<Seat>();
  readonly turnSeconds: TurnTimerSeconds | null;

  constructor(private readonly options: LanAuthorityOptions) {
    if (options.game.id !== 'reversi' || options.game.minPlayers !== 2 || options.game.maxPlayers !== 2) throw new RuleError('lan-game-not-supported');
    this.now = options.now ?? Date.now;
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
    this.roomId = options.roomId ?? this.randomId();
    this.roomName = (options.roomName ?? `${options.hostName}'s Room`).slice(0, 32);
    this.graceMs = options.graceMs ?? LAN_GRACE_MS;
    const requested = options.turnSeconds ?? null;
    if (requested !== null && !isTurnTimerMs(requested * 1000)) throw new RuleError('invalid-time-control');
    this.turnSeconds = requested;
    const hostSeat = options.hostSeat ?? 0;
    this.hostToken = this.randomId() + this.randomId();
    this.sessions.set(this.hostToken, { token: this.hostToken, id: this.randomId(), name: options.hostName.trim().slice(0, 24) || 'Host', seat: hostSeat, connected: true, ready: false, disconnectedAt: null });
  }

  get hostSeat(): 0 | 1 { return this.session(this.hostToken).seat }

  advertisement(port: number): LanAdvertisement {
    return { roomId: this.roomId, roomName: this.roomName, gameId: 'reversi', protocolVersion: LAN_PROTOCOL_VERSION, rulesetVersion: LAN_RULESET_VERSION, occupancy: this.sessions.size === 1 ? 1 : 2, capacity: 2, port };
  }

  snapshot(): LanSnapshot {
    this.expire();
    const bySeat = [...this.sessions.values()].sort((a, b) => a.seat - b.seat);
    return {
      protocolVersion: LAN_PROTOCOL_VERSION,
      rulesetVersion: LAN_RULESET_VERSION,
      roomId: this.roomId,
      roomName: this.roomName,
      gameId: 'reversi',
      matchId: this.matchId,
      revision: this.revision,
      status: this.status,
      players: bySeat.map((session) => ({ id: session.id, name: session.name, seat: session.seat, connected: session.connected, ready: session.ready })),
      state: this.state,
      result: this.result,
      turnSeconds: this.turnSeconds,
      turnStartedAt: this.turnStartedAt,
      graceMs: this.graceMs,
      disconnectedAt: [this.bySeat(0)?.disconnectedAt ?? null, this.bySeat(1)?.disconnectedAt ?? null],
      rematchVotes: [...this.rematchVotes],
      serverNow: this.now(),
    };
  }

  join(input: Extract<LanClientMessage, { type: 'hello' }>): LanServerMessage {
    if (input.roomId !== this.roomId) return { type: 'error', code: 'room-not-found' };
    if (input.protocolVersion !== LAN_PROTOCOL_VERSION || input.rulesetVersion !== LAN_RULESET_VERSION) return { type: 'error', code: 'incompatible-version' };
    this.expire();
    let session = input.resumeToken ? this.sessions.get(input.resumeToken) : undefined;
    if (session) {
      if (session.token === this.hostToken) return { type: 'error', code: 'invalid-resume-token' };
      session.connected = true;
      session.disconnectedAt = null;
      session.name = input.name.trim().slice(0, 24) || session.name;
    } else {
      if (input.resumeToken) return { type: 'error', code: 'invalid-resume-token' };
      if (this.sessions.size >= 2 || this.status !== 'lobby') return { type: 'error', code: 'room-full' };
      const seat = opponent(this.hostSeat) as 0 | 1;
      const token = this.randomId() + this.randomId();
      session = { token, id: this.randomId(), name: input.name.trim().slice(0, 24) || 'Guest', seat, connected: true, ready: false, disconnectedAt: null };
      this.sessions.set(token, session);
    }
    return { type: 'welcome', resumeToken: session.token, self: session.seat, snapshot: this.snapshot() };
  }

  handle(token: string, raw: unknown): LanServerMessage {
    let message: LanClientMessage;
    try { message = lanClientMessageSchema.parse(raw) } catch { return { type: 'error', code: 'invalid-message' } }
    if (message.type === 'hello') return this.join(message);
    const session = this.sessions.get(token);
    if (!session || !session.connected) return { type: 'error', code: 'unauthorized' };
    this.expire();
    if (message.type === 'ping') return { type: 'pong', nonce: message.nonce, serverNow: this.now() };
    if (message.type === 'sync') {
      if (message.matchId && message.matchId !== this.matchId) return { type: 'error', code: 'old-match', snapshot: this.snapshot() };
      return { type: 'snapshot', snapshot: this.snapshot() };
    }
    if (message.type === 'leave') { this.leave(token, true); return { type: 'snapshot', snapshot: this.snapshot() } }
    if (message.type === 'ready') {
      if (this.status !== 'lobby') return { type: 'error', code: 'match-already-started', snapshot: this.snapshot() };
      session.ready = message.ready;
      if (this.sessions.size === 2 && [...this.sessions.values()].every((p) => p.ready && p.connected)) this.startMatch();
      return { type: 'snapshot', snapshot: this.snapshot() };
    }
    if (message.type === 'rematch') return this.rematch(session, message.matchId);
    return this.play(session, message);
  }

  hostReady(ready: boolean): LanServerMessage { return this.handle(this.hostToken, { type: 'ready', ready }) }
  hostMove(moveValue: { row: number; col: number }, actionId = this.randomId()): LanServerMessage {
    if (!this.matchId) return { type: 'error', code: 'match-not-started', snapshot: this.snapshot() };
    return this.handle(this.hostToken, { type: 'move', matchId: this.matchId, actionId, expectedRevision: this.revision, move: moveValue });
  }

  disconnect(token: string) {
    const session = this.sessions.get(token);
    if (!session || !session.connected) return this.snapshot();
    session.connected = false;
    session.disconnectedAt = this.now();
    return this.snapshot();
  }

  reconnectHost() { const host = this.session(this.hostToken); host.connected = true; host.disconnectedAt = null; return this.snapshot() }

  leave(token: string, explicit = false) {
    const session = this.sessions.get(token);
    if (!session) return this.snapshot();
    if (this.status === 'lobby' && token !== this.hostToken) { this.sessions.delete(token); return this.snapshot() }
    if (explicit && (this.status === 'playing' || this.status === 'lobby')) {
      this.status = 'interrupted';
      this.result = { winner: null, reason: token === this.hostToken ? 'host-left' : 'opponent-left' };
      this.revision++;
    }
    session.connected = false;
    session.disconnectedAt = this.now();
    return this.snapshot();
  }

  tick() { this.expire(); return this.snapshot() }

  private play(session: Session, message: Extract<LanClientMessage, { type: 'move' }>): LanServerMessage {
    const fingerprint = JSON.stringify(message);
    const receipt = this.receipts.get(message.actionId);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) return { type: 'error', code: 'action-id-reused', actionId: message.actionId, snapshot: this.snapshot() };
      return receipt.message;
    }
    const reject = (code: string): LanServerMessage => ({ type: 'error', code, actionId: message.actionId, snapshot: this.snapshot() });
    if (this.status !== 'playing' || !this.state || !this.matchId) return reject('match-not-active');
    if (message.matchId !== this.matchId) return reject('old-match');
    if (message.expectedRevision !== this.revision) return reject('stale-revision');
    if (this.state.turn !== session.seat) return reject('not-your-turn');
    let next: ReturnType<GamePlugin['create']>;
    try { next = this.options.game.apply(this.state, message.move) } catch (error) { return reject(error instanceof RuleError ? error.code : 'invalid-move') }
    this.state = next;
    this.revision++;
    this.turnStartedAt = this.now();
    if (isGameOver(next)) {
      this.status = 'finished';
      this.result = { winner: next.winner, reason: next.drawReason ?? this.options.game.winReason };
    }
    const accepted: LanServerMessage = { type: 'snapshot', snapshot: this.snapshot(), ack: message.actionId };
    this.receipts.set(message.actionId, { fingerprint, message: accepted });
    return accepted;
  }

  private rematch(session: Session, matchId: string): LanServerMessage {
    if (this.status !== 'finished' || !this.matchId) return { type: 'error', code: 'match-still-active', snapshot: this.snapshot() };
    if (matchId !== this.matchId) return { type: 'error', code: 'old-match', snapshot: this.snapshot() };
    this.rematchVotes.add(session.seat);
    if (this.rematchVotes.size === 2) {
      for (const player of this.sessions.values()) player.seat = opponent(player.seat) as 0 | 1;
      this.startMatch();
    }
    return { type: 'snapshot', snapshot: this.snapshot() };
  }

  private startMatch() {
    this.state = this.options.game.create(2);
    this.matchId = this.randomId();
    this.revision = 0;
    this.status = 'playing';
    this.result = null;
    this.turnStartedAt = this.now();
    this.receipts.clear();
    this.rematchVotes.clear();
    for (const session of this.sessions.values()) session.ready = false;
  }

  private expire() {
    if (this.status !== 'playing') return;
    const now = this.now();
    for (const session of this.sessions.values()) {
      if (!session.connected && session.disconnectedAt !== null && now - session.disconnectedAt >= this.graceMs) {
        this.status = 'interrupted';
        this.result = { winner: null, reason: 'connection-lost' };
        this.revision++;
        return;
      }
    }
    if (this.turnSeconds !== null && this.turnStartedAt !== null && now - this.turnStartedAt >= this.turnSeconds * 1000) {
      if (!this.state) return;
      this.status = 'finished';
      this.result = { winner: opponent(this.state.turn as 0 | 1), reason: 'timeout' };
      this.revision++;
    }
  }

  private session(token: string): Session { const session = this.sessions.get(token); if (!session) throw new RuleError('unauthorized'); return session }
  private bySeat(seat: 0 | 1) { return [...this.sessions.values()].find((session) => session.seat === seat) }
}

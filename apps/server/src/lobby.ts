import { randomInt } from 'node:crypto';
import { RuleError, type PlayerCount } from '../../../packages/core/src/game.ts';
import type { MatchSnapshot } from '../../../packages/core/src/protocol.ts';
import {
  CLASSIC_DIGITAL_TURN_SECONDS,
  turnTimeControl,
  type TurnTimerSeconds,
} from '../../../packages/core/src/timing.ts';
import { MatchService } from './matches.ts';
interface QueueEntry {
  userId: string;
  gameId: string;
  ranked: boolean;
  playerCount: PlayerCount;
  turnSeconds: TurnTimerSeconds | null;
  at: number;
}
export interface Room {
  owner: string;
  members: string[];
  code: string;
  gameId: string;
  playerCount: PlayerCount;
  turnSeconds: TurnTimerSeconds | null;
  expiresAt: number;
}
export interface RoomJoinResult {
  room: Room;
  match: MatchSnapshot | null;
}
export class Lobby {
  queue: QueueEntry[] = [];
  rooms = new Map<string, Room>();
  constructor(readonly matches: MatchService) {}
  cancel(userId: string): Room[] {
    this.queue = this.queue.filter((q) => q.userId !== userId);
    const changed: Room[] = [];
    for (const [code, room] of [...this.rooms]) {
      if (room.owner === userId) {
        this.rooms.delete(code);
        const remaining = room.members.filter((id) => id !== userId);
        if (remaining.length) {
          // The existing WebSocket room message is also the safest backwards-
          // compatible closure signal: clients already dismiss rooms whose
          // expiresAt is in the past.
          changed.push({ ...room, members: remaining, expiresAt: 0 });
        }
      } else if (room.members.includes(userId)) {
        room.members = room.members.filter((id) => id !== userId);
        changed.push(room);
      }
    }
    return changed;
  }
  private normalizePlayerCount(gameId: string, value: number): PlayerCount {
    const game = this.matches.games.get(gameId);
    if (!Number.isInteger(value) || value < game.minPlayers || value > game.maxPlayers)
      throw new RuleError('player-count-not-supported');
    return value as PlayerCount;
  }
  canonicalTurnSeconds(gameId: string, value?: TurnTimerSeconds): TurnTimerSeconds | null {
    if (gameId !== 'digitalGame') {
      if (value !== undefined) throw new RuleError('turn-timer-not-supported');
      return null;
    }
    // Rummikub Classic uses one fixed minute per turn. Legacy clients may still
    // submit 30/45/90, but all Digital Classic lobbies are canonicalized to 60.
    void value;
    return CLASSIC_DIGITAL_TURN_SECONDS;
  }
  private eligible(userId: string, gameId: string, ranked = false) {
    this.matches.games.get(gameId);
    if (this.matches.activeFor(userId) && !this.matches.activeFor(userId)!.result)
      throw new RuleError('already-in-match');
    if (ranked && this.matches.store.user(userId).guest)
      throw new RuleError('ranked-requires-account');
  }
  private shuffled(users: string[]): string[] {
    const out = [...users];
    for (let i = out.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  private group(
    gameId: string,
    users: string[],
    ranked: boolean,
    turnSeconds: TurnTimerSeconds | null,
  ) {
    return this.matches.create(
      gameId,
      this.shuffled(users),
      ranked,
      turnSeconds === null ? undefined : turnTimeControl(turnSeconds),
    );
  }
  enqueue(
    userId: string,
    gameId: string,
    ranked: boolean,
    requestedPlayerCount: PlayerCount = 2,
    requestedTurnSeconds?: TurnTimerSeconds,
  ): MatchSnapshot | null {
    this.eligible(userId, gameId, ranked);
    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount),
      turnSeconds = this.canonicalTurnSeconds(gameId, requestedTurnSeconds);
    this.cancel(userId);
    const entry: QueueEntry = {
      userId,
      gameId,
      ranked,
      playerCount,
      turnSeconds,
      at: this.matches.options.now(),
    };
    this.queue.push(entry);
    return this.tryGroup(entry);
  }
  private samePool(a: QueueEntry, b: QueueEntry) {
    return (
      a.gameId === b.gameId &&
      a.ranked === b.ranked &&
      a.playerCount === b.playerCount &&
      a.turnSeconds === b.turnSeconds
    );
  }
  private pairCompatible(a: QueueEntry, b: QueueEntry, now: number) {
    if (!this.samePool(a, b)) return false;
    if (!a.ranked) return true;
    const ratingA = this.matches.store.rating(a.userId, a.gameId),
      ratingB = this.matches.store.rating(b.userId, b.gameId),
      spread = 150 + Math.floor((now - Math.min(a.at, b.at)) / 10000) * 50;
    return Math.abs(ratingA - ratingB) <= spread;
  }
  private tryGroup(entry: QueueEntry): MatchSnapshot | null {
    if (!this.queue.includes(entry)) return null;
    const now = this.matches.options.now();
    const candidates = this.queue
      .filter((candidate) => candidate !== entry && this.samePool(entry, candidate))
      .sort((a, b) => a.at - b.at);
    const selected: QueueEntry[] = [entry];
    const findGroup = (start: number): QueueEntry[] | null => {
      if (selected.length === entry.playerCount) return [...selected];
      for (let index = start; index < candidates.length; index++) {
        const candidate = candidates[index];
        if (!selected.every((other) => this.pairCompatible(other, candidate, now))) continue;
        selected.push(candidate);
        const group = findGroup(index + 1);
        if (group) return group;
        selected.pop();
      }
      return null;
    };
    const group = findGroup(0);
    if (!group) return null;
    const match = this.group(
      entry.gameId,
      group.map((item) => item.userId),
      entry.ranked,
      entry.turnSeconds,
    );
    for (const item of group) this.cancel(item.userId);
    return match;
  }
  tick(): MatchSnapshot[] {
    const result: MatchSnapshot[] = [];
    for (const entry of [...this.queue]) {
      const match = this.tryGroup(entry);
      if (match) result.push(match);
    }
    for (const [code, room] of this.rooms)
      if (room.expiresAt < this.matches.options.now()) this.rooms.delete(code);
    return result;
  }
  createRoom(
    userId: string,
    gameId: string,
    requestedPlayerCount: PlayerCount = 2,
    requestedTurnSeconds?: TurnTimerSeconds,
  ): Room {
    this.eligible(userId, gameId);
    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount),
      turnSeconds = this.canonicalTurnSeconds(gameId, requestedTurnSeconds);
    this.cancel(userId);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    } while (this.rooms.has(code));
    const room: Room = {
      owner: userId,
      members: [userId],
      gameId,
      playerCount,
      turnSeconds,
      code,
      expiresAt: this.matches.options.now() + 600000,
    };
    this.rooms.set(code, room);
    return room;
  }
  joinRoomResult(userId: string, code: string): RoomJoinResult {
    const room = this.rooms.get(code);
    if (!room || room.expiresAt <= this.matches.options.now()) throw new RuleError('room-not-found');
    if (room.owner === userId) throw new RuleError('cannot-play-yourself');
    this.eligible(userId, room.gameId);
    if (!room.members.includes(userId)) room.members.push(userId);
    this.queue = this.queue.filter((q) => q.userId !== userId);
    if (room.members.length < room.playerCount) return { room, match: null };
    if (room.members.length > room.playerCount) throw new RuleError('room-full');
    const match = this.group(room.gameId, room.members, false, room.turnSeconds);
    this.rooms.delete(code);
    return { room, match };
  }
  /** Backward-compatible helper for existing two-player callers and tests. */
  joinRoom(userId: string, code: string): MatchSnapshot {
    const result = this.joinRoomResult(userId, code);
    if (!result.match) throw new RuleError('room-waiting');
    return result.match;
  }
}

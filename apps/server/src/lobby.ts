import { randomInt } from 'node:crypto';
import { RuleError, type PlayerCount } from '../../../packages/core/src/game.ts';
import type { MatchSnapshot } from '../../../packages/core/src/protocol.ts';
import { MatchService } from './matches.ts';
interface QueueEntry {
  userId: string;
  gameId: string;
  ranked: boolean;
  playerCount: PlayerCount;
  at: number;
}
export interface Room {
  owner: string;
  members: string[];
  code: string;
  gameId: string;
  playerCount: PlayerCount;
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
      if (room.owner === userId) this.rooms.delete(code);
      else if (room.members.includes(userId)) {
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
  private group(gameId: string, users: string[], ranked: boolean) {
    return this.matches.create(gameId, this.shuffled(users), ranked);
  }
  enqueue(
    userId: string,
    gameId: string,
    ranked: boolean,
    requestedPlayerCount: PlayerCount = 2,
  ): MatchSnapshot | null {
    this.eligible(userId, gameId, ranked);
    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount);
    this.cancel(userId);
    const entry: QueueEntry = { userId, gameId, ranked, playerCount, at: this.matches.options.now() };
    this.queue.push(entry);
    return this.tryGroup(entry);
  }
  private tryGroup(entry: QueueEntry): MatchSnapshot | null {
    if (!this.queue.includes(entry)) return null;
    const now = this.matches.options.now(),
      rating = this.matches.store.rating(entry.userId, entry.gameId);
    const compatible = this.queue
      .filter(
        (q) =>
          q.gameId === entry.gameId &&
          q.ranked === entry.ranked &&
          q.playerCount === entry.playerCount &&
          (!entry.ranked ||
            Math.abs(this.matches.store.rating(q.userId, q.gameId) - rating) <=
              150 + Math.floor((now - Math.min(q.at, entry.at)) / 10000) * 50),
      )
      .sort((a, b) => a.at - b.at);
    if (compatible.length < entry.playerCount) return null;
    const selected = compatible.slice(0, entry.playerCount);
    const match = this.group(entry.gameId, selected.map((item) => item.userId), entry.ranked);
    for (const item of selected) this.cancel(item.userId);
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
  createRoom(userId: string, gameId: string, requestedPlayerCount: PlayerCount = 2): Room {
    this.eligible(userId, gameId);
    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount);
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
    const match = this.group(room.gameId, room.members, false);
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

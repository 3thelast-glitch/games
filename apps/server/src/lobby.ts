import { randomInt } from 'node:crypto';
import { RuleError } from '../../../packages/core/src/game.ts';
import type { MatchSnapshot } from '../../../packages/core/src/protocol.ts';
import { MatchService } from './matches.ts';
interface QueueEntry {
  userId: string;
  gameId: string;
  ranked: boolean;
  at: number;
}
interface Room {
  owner: string;
  code: string;
  gameId: string;
  expiresAt: number;
}
export class Lobby {
  queue: QueueEntry[] = [];
  rooms = new Map<string, Room>();
  constructor(readonly matches: MatchService) {}
  cancel(userId: string) {
    this.queue = this.queue.filter((q) => q.userId !== userId);
    for (const [code, room] of this.rooms) if (room.owner === userId) this.rooms.delete(code);
  }
  private eligible(userId: string, gameId: string, ranked = false) {
    this.matches.games.get(gameId);
    if (this.matches.activeFor(userId) && !this.matches.activeFor(userId)!.result)
      throw new RuleError('already-in-match');
    if (ranked && this.matches.store.user(userId).guest)
      throw new RuleError('ranked-requires-account');
  }
  private pair(gameId: string, a: string, b: string, ranked: boolean) {
    return this.matches.create(gameId, randomInt(2) ? [a, b] : [b, a], ranked);
  }
  enqueue(userId: string, gameId: string, ranked: boolean): MatchSnapshot | null {
    this.eligible(userId, gameId, ranked);
    this.cancel(userId);
    const entry: QueueEntry = {
      userId,
      gameId,
      ranked,
      at: this.matches.options.now(),
    };
    this.queue.push(entry);
    return this.tryPair(entry);
  }
  private tryPair(entry: QueueEntry): MatchSnapshot | null {
    const now = this.matches.options.now(),
      rating = this.matches.store.rating(entry.userId, entry.gameId);
    const candidate = this.queue.find(
      (q) =>
        q.userId !== entry.userId &&
        q.gameId === entry.gameId &&
        q.ranked === entry.ranked &&
        (!entry.ranked ||
          Math.abs(this.matches.store.rating(q.userId, q.gameId) - rating) <=
            150 + Math.floor((now - Math.min(q.at, entry.at)) / 10000) * 50),
    );
    if (!candidate) return null;
    const match = this.pair(entry.gameId, candidate.userId, entry.userId, entry.ranked);
    this.cancel(candidate.userId);
    this.cancel(entry.userId);
    return match;
  }
  tick(): MatchSnapshot[] {
    const result: MatchSnapshot[] = [];
    for (const entry of [...this.queue])
      if (this.queue.includes(entry)) {
        const match = this.tryPair(entry);
        if (match) result.push(match);
      }
    for (const [code, room] of this.rooms)
      if (room.expiresAt < this.matches.options.now()) this.rooms.delete(code);
    return result;
  }
  createRoom(userId: string, gameId: string): Room {
    this.eligible(userId, gameId);
    this.cancel(userId);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    } while (this.rooms.has(code));
    const room = {
      owner: userId,
      gameId,
      code,
      expiresAt: this.matches.options.now() + 600000,
    };
    this.rooms.set(code, room);
    return room;
  }
  joinRoom(userId: string, code: string): MatchSnapshot {
    const room = this.rooms.get(code);
    if (!room || room.expiresAt <= this.matches.options.now())
      throw new RuleError('room-not-found');
    if (room.owner === userId) throw new RuleError('cannot-play-yourself');
    this.eligible(userId, room.gameId);
    const match = this.pair(room.gameId, room.owner, userId, false);
    this.cancel(userId);
    this.cancel(room.owner);
    return match;
  }
}

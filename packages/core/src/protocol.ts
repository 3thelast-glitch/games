import { z } from 'zod';
import type { BaseState, PlayerCount, Seat } from './game.ts';
import type { TimeControl, TurnTimerSeconds } from './timing.ts';
export const PROTOCOL_VERSION = 3;
const id = z.string().min(1).max(80);
const playerCount = z.union([z.literal(2), z.literal(3), z.literal(4)]);
const turnTimerSeconds = z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]);
const matchCommand = {
  matchId: id,
  commandId: z.string().min(8).max(80),
  expectedRevision: z.number().int().nonnegative(),
};
export const clientMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('auth'),
      token: z.string().min(20).max(256),
      // v1 remains accepted during the migration window; new clients send v2.
      version: z.union([z.literal(1), z.literal(2), z.literal(PROTOCOL_VERSION)]),
    })
    .strict(),
  z.object({ type: z.literal('ping') }).strict(),
  z
    .object({
      type: z.literal('queue'),
      gameId: id,
      ranked: z.boolean(),
      playerCount: playerCount.default(2),
      turnSeconds: turnTimerSeconds.optional(),
    })
    .strict(),
  z.object({ type: z.literal('cancel') }).strict(),
  z
    .object({
      type: z.literal('create-room'),
      gameId: id,
      playerCount: playerCount.default(2),
      turnSeconds: turnTimerSeconds.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('join-room'),
      code: z.string().regex(/^[A-Z2-9]{6}$/),
    })
    .strict(),
  z.object({ type: z.literal('resume'), matchId: id }).strict(),
  z.object({ type: z.literal('move'), ...matchCommand, move: z.unknown() }).strict(),
  z.object({ type: z.literal('resign'), ...matchCommand }).strict(),
  z.object({ type: z.literal('draw-offer'), ...matchCommand }).strict(),
  z
    .object({
      type: z.literal('draw-answer'),
      ...matchCommand,
      accept: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal('rematch'), matchId: id }).strict(),
  z
    .object({
      type: z.literal('emote'),
      matchId: id,
      emote: z.enum(['👋', '👏', '🤔', '🔥', '🤝', '🎯']),
    })
    .strict(),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type MatchCommand = Extract<ClientMessage, { commandId: string }>;
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  rank: string;
}
export type ResultReason = string;
export interface MatchResult {
  winner: Seat | null;
  reason: ResultReason;
  ratingDelta: number[];
}
export interface MatchSnapshot {
  id: string;
  gameId: string;
  players: PublicPlayer[];
  state: BaseState;
  ranked: boolean;
  revision: number;
  clockMs: number[];
  /** Optional for persisted v1/v2 snapshots; new matches always include it. */
  timeControl?: TimeControl;
  turnStartedAt: number;
  createdAt: number;
  endedAt: number | null;
  result: MatchResult | null;
  serverNow: number;
  disconnectedAt: (number | null)[];
  graceMs: number;
  drawOffer: Seat | null;
  drawAccepts: Seat[];
  rematchVotes: Seat[];
  rematchId: string | null;
}
export interface HistoryEntry {
  matchId: string;
  gameId: string;
  opponent: string;
  opponents: string[];
  playerCount: number;
  result: 'win' | 'loss' | 'draw';
  reason: ResultReason;
  durationMs: number;
  ratingDelta: number;
  ranked: boolean;
  endedAt: number;
}
export interface Profile {
  id: string;
  name: string;
  avatar: string;
  guest: boolean;
  level: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  favorites: string[];
  ratings: Record<string, { rating: number; rank: string; position: number | null }>;
  history: HistoryEntry[];
  friendCode: string;
  friends: PublicPlayer[];
}
export type ServerMessage =
  | { type: 'ready'; userId: string; serverNow: number }
  | { type: 'pong'; serverNow: number }
  | {
      type: 'queued';
      gameId: string;
      ranked: boolean;
      playerCount: PlayerCount;
      turnSeconds: TurnTimerSeconds | null;
    }
  | {
      type: 'room';
      code: string;
      expiresAt: number;
      gameId: string;
      playerCount: PlayerCount;
      turnSeconds: TurnTimerSeconds | null;
      joined: number;
    }
  | { type: 'cancelled' }
  | { type: 'match'; match: MatchSnapshot; ack?: string }
  | { type: 'error'; code: string; commandId?: string }
  | { type: 'emote'; matchId: string; player: Seat; emote: string };

import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { eloChange, periodStart, rankFor } from '../../../packages/core/src/ranking.ts';
import { RuleError } from '../../../packages/core/src/game.ts';
import type { Profile, PublicPlayer, HistoryEntry } from '../../../packages/core/src/protocol.ts';
import type { StoredMatch } from './matches.ts';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');

const loadedMatchRevisions = new WeakMap<StoredMatch, number>();

export interface User {
  id: string;
  name: string;
  avatar: string;
  guest: number;
  provider: string;
  subject: string;
  email: string | null;
  password: string | null;
  favorites: string;
  friend_code: string;
  created_at: number;
}

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,avatar TEXT NOT NULL,guest INTEGER NOT NULL,provider TEXT NOT NULL,subject TEXT NOT NULL,email TEXT,password TEXT,favorites TEXT NOT NULL DEFAULT '[]',friend_code TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL, UNIQUE(provider,subject));
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ratings(user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,rating INTEGER NOT NULL DEFAULT 1000,played INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,game_id));
      CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,body TEXT NOT NULL,finished INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS results(match_id TEXT NOT NULL REFERENCES matches(id),user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,opponent TEXT NOT NULL,result TEXT NOT NULL,reason TEXT NOT NULL,duration_ms INTEGER NOT NULL,delta INTEGER NOT NULL,ranked INTEGER NOT NULL,ended_at INTEGER NOT NULL,opponents_json TEXT NOT NULL DEFAULT '[]',player_count INTEGER NOT NULL DEFAULT 2,PRIMARY KEY(match_id,user_id));
      CREATE INDEX IF NOT EXISTS results_period ON results(game_id,ended_at);
      CREATE TABLE IF NOT EXISTS friends(user_id TEXT NOT NULL REFERENCES users(id),friend_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(user_id,friend_id));
      CREATE TABLE IF NOT EXISTS oauth_flows(state TEXT PRIMARY KEY,body TEXT NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_codes(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),challenge TEXT NOT NULL,expires_at INTEGER NOT NULL);`);
    const resultColumns = new Set(
      (this.db.prepare('PRAGMA table_info(results)').all() as { name: string }[]).map((column) => column.name),
    );
    if (!resultColumns.has('opponents_json'))
      this.db.exec("ALTER TABLE results ADD COLUMN opponents_json TEXT NOT NULL DEFAULT '[]'");
    if (!resultColumns.has('player_count'))
      this.db.exec('ALTER TABLE results ADD COLUMN player_count INTEGER NOT NULL DEFAULT 2');
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private trackMatch(match: StoredMatch, revision = match.revision): StoredMatch {
    loadedMatchRevisions.set(match, revision);
    return match;
  }

  compareAndSwapMatch(match: StoredMatch, expectedRevision: number): boolean {
    const result = this.db
      .prepare(
        `UPDATE matches
         SET body=?, finished=?
         WHERE id=?
           AND CAST(json_extract(body, '$.revision') AS INTEGER)=?`,
      )
      .run(JSON.stringify(match), match.result ? 1 : 0, match.id, expectedRevision);
    if (Number(result.changes) !== 1) return false;
    this.trackMatch(match);
    return true;
  }

  user(id: string): User {
    const user = this.db.prepare('SELECT * FROM users WHERE id=?').get(id) as unknown as
      User | undefined;
    if (!user) throw new RuleError('account-not-found');
    return user;
  }

  identity(provider: string, subject: string) {
    return this.db
      .prepare('SELECT * FROM users WHERE provider=? AND subject=?')
      .get(provider, subject) as unknown as User | undefined;
  }

  createUser(
    name: string,
    provider = 'guest',
    subject: string = randomUUID(),
    email: string | null = null,
    password: string | null = null,
  ): User {
    const id = randomUUID(),
      code = randomBytes(6).toString('hex').toUpperCase();
    this.db
      .prepare(
        'INSERT INTO users(id,name,avatar,guest,provider,subject,email,password,friend_code,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        name,
        'orbit',
        provider === 'guest' ? 1 : 0,
        provider,
        subject,
        email,
        password,
        code,
        Date.now(),
      );
    return this.user(id);
  }

  newSession(userId: string, now = Date.now()) {
    const token = randomBytes(32).toString('base64url');
    this.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(digest(token), userId, now + 30 * 86400000);
    return token;
  }

  authenticate(token: string, now = Date.now()): User {
    const session = this.db
      .prepare('SELECT user_id FROM sessions WHERE hash=? AND expires_at>?')
      .get(digest(token), now) as { user_id: string } | undefined;
    if (!session) throw new RuleError('unauthorized');
    return this.user(session.user_id);
  }

  logout(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));
  }

  cleanup(now = Date.now()) {
    for (const table of ['sessions', 'oauth_flows', 'auth_codes'])
      this.db.prepare(`DELETE FROM ${table} WHERE expires_at<=?`).run(now);
  }

  rating(userId: string, gameId: string): number {
    return (
      (
        this.db
          .prepare('SELECT rating FROM ratings WHERE user_id=? AND game_id=?')
          .get(userId, gameId) as { rating: number } | undefined
      )?.rating ?? 1000
    );
  }

  publicPlayer(userId: string, gameId: string): PublicPlayer {
    const u = this.user(userId),
      rating = this.rating(userId, gameId);
    return {
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      rating,
      rank: rankFor(rating),
    };
  }

  saveMatch(match: StoredMatch) {
    const expectedRevision = loadedMatchRevisions.get(match),
      body = JSON.stringify(match),
      finished = match.result ? 1 : 0;

    if (expectedRevision !== undefined) {
      if (!this.compareAndSwapMatch(match, expectedRevision)) throw new RuleError('stale-revision');
      return;
    }

    const existing = this.db
      .prepare("SELECT CAST(json_extract(body, '$.revision') AS INTEGER) AS revision FROM matches WHERE id=?")
      .get(match.id) as { revision: number } | undefined;
    if (!existing) {
      this.db.prepare('INSERT INTO matches(id,body,finished) VALUES(?,?,?)').run(match.id, body, finished);
      this.trackMatch(match);
      return;
    }

    if (!this.compareAndSwapMatch(match, match.revision)) throw new RuleError('stale-revision');
  }

  loadMatch(id: string): StoredMatch {
    const row = this.db.prepare('SELECT body FROM matches WHERE id=?').get(id) as { body: string } | undefined;
    if (!row) throw new RuleError('match-not-found');
    const match = JSON.parse(row.body) as StoredMatch;
    match.drawAccepts ??= match.drawOffer === null ? [] : [match.drawOffer];
    match.state.playerCount ??= match.players.length as 2 | 3 | 4;
    return this.trackMatch(match);
  }

  activeMatches(): StoredMatch[] {
    return (
      this.db.prepare('SELECT body FROM matches WHERE finished=0').all() as {
        body: string;
      }[]
    ).map((r) => this.trackMatch(JSON.parse(r.body) as StoredMatch));
  }

  settle(match: StoredMatch) {
    if (!match.result || match.endedAt === null) throw new Error('Cannot settle active match');
    this.transaction(() => {
      // Claim the terminal revision before touching ratings/results. A stale
      // server instance fails here and the whole transaction rolls back.
      this.saveMatch(match);

      const existing = this.db.prepare('SELECT match_id FROM results WHERE match_id=? LIMIT 1').get(match.id);
      if (existing) return;

      const result = match.result!;
      if (match.ranked && result.reason !== 'abandoned') {
        const ratings = match.players.map((player) => this.rating(player.id, match.gameId));
        const raw = ratings.map(() => 0);
        for (let left = 0; left < ratings.length; left++)
          for (let right = left + 1; right < ratings.length; right++) {
            const score =
              result.winner === null ? 0.5 : result.winner === left ? 1 : result.winner === right ? 0 : 0.5;
            const change = eloChange(ratings[left], ratings[right], score);
            raw[left] += change;
            raw[right] -= change;
          }
        const divisor = Math.max(1, ratings.length - 1);
        result.ratingDelta = raw.map((delta) => Math.round(delta / divisor));
        const drift = result.ratingDelta.reduce((sum, delta) => sum + delta, 0);
        if (drift) result.ratingDelta[result.winner ?? 0] -= drift;
        for (let seat = 0; seat < match.players.length; seat++)
          this.db
            .prepare(
              'INSERT INTO ratings(user_id,game_id,rating,played) VALUES(?,?,?,1) ON CONFLICT(user_id,game_id) DO UPDATE SET rating=excluded.rating,played=ratings.played+1',
            )
            .run(match.players[seat].id, match.gameId, ratings[seat] + result.ratingDelta[seat]);
      }

      // Persist the final rating deltas at the already-claimed terminal revision.
      this.saveMatch(match);
      for (let seat = 0; seat < match.players.length; seat++) {
        const opponents = match.players.filter((_, index) => index !== seat).map((player) => player.name);
        this.db
          .prepare(
            'INSERT INTO results(match_id,user_id,game_id,opponent,result,reason,duration_ms,delta,ranked,ended_at,opponents_json,player_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
          )
          .run(
            match.id,
            match.players[seat].id,
            match.gameId,
            opponents.join(', '),
            result.winner === null ? 'draw' : result.winner === seat ? 'win' : 'loss',
            result.reason,
            match.endedAt! - match.createdAt,
            result.ratingDelta[seat] ?? 0,
            match.ranked ? 1 : 0,
            match.endedAt!,
            JSON.stringify(opponents),
            match.players.length,
          );
      }
    });
  }

  profile(userId: string, gameIds: string[]): Profile {
    const user = this.user(userId),
      stats = this.db
        .prepare(
          "SELECT COUNT(*) AS total,SUM(result='win') AS wins,SUM(result='loss') AS losses,SUM(result='draw') AS draws FROM results WHERE user_id=?",
        )
        .get(userId) as {
        total: number;
        wins: number;
        losses: number;
        draws: number;
      };
    const history = (
      this.db
        .prepare('SELECT * FROM results WHERE user_id=? ORDER BY ended_at DESC LIMIT 30')
        .all(userId) as Record<string, unknown>[]
    ).map((row) => ({
      matchId: row.match_id,
      gameId: row.game_id,
      opponent: row.opponent,
      opponents: JSON.parse(String(row.opponents_json ?? '[]')),
      playerCount: Number(row.player_count ?? 2),
      result: row.result,
      reason: row.reason,
      durationMs: row.duration_ms,
      ratingDelta: row.delta,
      ranked: !!row.ranked,
      endedAt: row.ended_at,
    })) as HistoryEntry[];
    const ratings: Profile['ratings'] = {};
    for (const game of gameIds) {
      const rating = this.rating(userId, game),
        entry = this.db
          .prepare('SELECT played FROM ratings WHERE user_id=? AND game_id=?')
          .get(userId, game);
      const better = this.db
        .prepare('SELECT COUNT(*) AS n FROM ratings WHERE game_id=? AND played>0 AND rating>?')
        .get(game, rating) as { n: number };
      ratings[game] = {
        rating,
        rank: rankFor(rating),
        position: entry ? better.n + 1 : null,
      };
    }
    const friends = (
      this.db.prepare('SELECT friend_id FROM friends WHERE user_id=?').all(userId) as {
        friend_id: string;
      }[]
    ).map((f) => this.publicPlayer(f.friend_id, gameIds[0]));
    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      guest: !!user.guest,
      level: 1 + Math.floor((stats.total * 30 + (stats.wins || 0) * 50) / 500),
      totalMatches: stats.total,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      draws: stats.draws || 0,
      winRate: stats.total ? Math.round(((stats.wins || 0) / stats.total) * 100) : 0,
      favorites: JSON.parse(user.favorites),
      ratings,
      history,
      friendCode: user.friend_code,
      friends,
    };
  }

  addFriend(userId: string, code: string) {
    const friend = this.db.prepare('SELECT id FROM users WHERE friend_code=?').get(code) as
      { id: string } | undefined;
    if (!friend || friend.id === userId) throw new RuleError('friend-not-found');
    this.db.prepare('INSERT OR IGNORE INTO friends VALUES(?,?)').run(userId, friend.id);
  }

  leaderboard(
    gameId: string,
    period: 'global' | 'weekly' | 'monthly' | 'friends',
    userId: string,
    now = Date.now(),
  ) {
    const start = periodStart(period, now),
      friendIds = new Set([
        userId,
        ...(
          this.db.prepare('SELECT friend_id FROM friends WHERE user_id=?').all(userId) as {
            friend_id: string;
          }[]
        ).map((f) => f.friend_id),
      ]);
    const rows = (
      period === 'weekly' || period === 'monthly'
        ? this.db
            .prepare(
              'SELECT user_id,SUM(delta) AS score,COUNT(*) AS played FROM results WHERE game_id=? AND ranked=1 AND ended_at>=? GROUP BY user_id ORDER BY score DESC,played DESC,user_id ASC LIMIT 500',
            )
            .all(gameId, start)
        : this.db
            .prepare(
              'SELECT user_id,rating AS score,played FROM ratings WHERE game_id=? AND played>0 ORDER BY rating DESC,user_id ASC',
            )
            .all(gameId)
    ) as { user_id: string; score: number; played: number }[];
    return rows
      .filter((r) => period !== 'friends' || friendIds.has(r.user_id))
      .slice(0, 100)
      .map((row, i) => ({
        ...this.publicPlayer(row.user_id, gameId),
        position: i + 1,
        score: row.score,
        played: row.played,
      }));
  }

  close() {
    this.db.close();
  }
}

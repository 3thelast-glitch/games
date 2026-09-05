import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import { games } from '../../../packages/games/registry.ts';
import {
  clientMessageSchema,
  PROTOCOL_VERSION,
  type ServerMessage,
  type MatchSnapshot,
} from '../../../packages/core/src/protocol.ts';
import { RuleError } from '../../../packages/core/src/game.ts';
import { AuthService } from './auth.ts';
import { Store, type User } from './store.ts';
import { MatchService } from './matches.ts';
import { Lobby } from './lobby.ts';
export class RateLimiter {
  private buckets = new Map<string, { start: number; count: number }>();
  allow(key: string, limit: number, windowMs: number, now = Date.now()) {
    let b = this.buckets.get(key);
    if (!b || now - b.start >= windowMs) {
      b = { start: now, count: 0 };
      this.buckets.set(key, b);
    }
    b.count++;
    return b.count <= limit;
  }
  prune(now = Date.now()) {
    for (const [key, b] of this.buckets) if (now - b.start > 3600000) this.buckets.delete(key);
  }
}
export interface ServerOptions {
  store?: Store;
  env?: NodeJS.ProcessEnv;
  clockMs?: number;
  graceMs?: number;
  staticDir?: string;
  allowedOrigins?: string[];
}
export function createArenaServer(options: ServerOptions = {}) {
  const env = options.env ?? process.env,
    store = options.store ?? new Store(env.DATABASE_PATH ?? 'data/board-arena.db');
  const auth = new AuthService(store, env),
    matches = new MatchService(store, games, {
      clockMs: options.clockMs ?? Number(env.MATCH_CLOCK_MS ?? 600000),
      graceMs: options.graceMs ?? Number(env.RECONNECT_GRACE_MS ?? 60000),
    }),
    lobby = new Lobby(matches),
    limits = new RateLimiter();
  if (
    !Number.isFinite(matches.options.clockMs) ||
    matches.options.clockMs < 1000 ||
    !Number.isFinite(matches.options.graceMs) ||
    matches.options.graceMs < 1000
  )
    throw new Error('Invalid match time configuration');
  const origins = new Set(
    options.allowedOrigins ??
      (
        env.ALLOWED_ORIGINS ??
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787,https://localhost,capacitor://localhost'
      )
        .split(',')
        .map((s) => s.trim()),
  );
  const sockets = new Map<string, Set<WebSocket>>(),
    userBySocket = new Map<WebSocket, string>(),
    tokenBySocket = new Map<WebSocket, string>();
  const send = (ws: WebSocket, message: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };
  const sendUser = (id: string, message: ServerMessage) => {
    for (const ws of sockets.get(id) ?? []) send(ws, message);
  };
  const broadcast = (match: MatchSnapshot, ack?: string) => {
    for (const player of match.players)
      sendUser(player.id, { type: 'match', match: matches.forUser(match, player.id), ack });
  };
  const broadcastRoom = (room: ReturnType<Lobby['createRoom']>) => {
    for (const userId of room.members)
      sendUser(userId, {
        type: 'room',
        code: room.code,
        expiresAt: room.expiresAt,
        gameId: room.gameId,
        playerCount: room.playerCount,
        turnSeconds: room.turnSeconds,
        joined: room.members.length,
      });
  };
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(body));
  };
  const tokenOf = (req: IncomingMessage) =>
    req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  const userOf = (req: IncomingMessage) => store.authenticate(tokenOf(req));
  const nameSchema = z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[\p{L}\p{N} _.-]+$/u);
  const emailSchema = z.string().trim().toLowerCase().email().max(254);
  const passwordSchema = z.string().min(12).max(128);
  async function body(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 16384) throw new RuleError('request-too-large');
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString();
    if (!text) return {};
    if (req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))
      return Object.fromEntries(new URLSearchParams(text));
    return JSON.parse(text);
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'",
    );
    const origin = req.headers.origin;
    if (origin && origins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const callback = /^\/api\/auth\/oauth\/(google|apple)\/callback$/.exec(url.pathname);
    if (origin && !origins.has(origin) && url.pathname.startsWith('/api') && !callback)
      return json(res, 403, { error: 'origin-not-allowed' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    const ip = req.socket.remoteAddress ?? 'unknown';
    // Trust the socket address. Configure a dedicated authenticated proxy before honoring forwarded headers.
    if (!limits.allow(`http:${ip}`, 600, 60000)) return json(res, 429, { error: 'rate-limited' });
    try {
      if (url.pathname === '/api/health')
        return json(res, 200, { ok: true, protocol: PROTOCOL_VERSION, games: games.ids() });
      if (url.pathname === '/api/auth/providers' && req.method === 'GET')
        return json(res, 200, auth.capabilities());
      if (url.pathname.startsWith('/api/auth/') && !limits.allow(`auth:${ip}`, 80, 60000))
        return json(res, 429, { error: 'rate-limited' });
      if (url.pathname === '/api/auth/guest' && req.method === 'POST') {
        const data = z
          .object({ name: nameSchema.default('Guest') })
          .strict()
          .parse(await body(req));
        const user = store.createUser(data.name);
        return json(res, 201, {
          token: store.newSession(user.id),
          profile: store.profile(user.id, games.ids()),
        });
      }
      if (url.pathname === '/api/auth/register' && req.method === 'POST') {
        const data = z
          .object({
            email: emailSchema,
            password: passwordSchema,
            name: nameSchema,
          })
          .strict()
          .parse(await body(req));
        let guest: User | undefined;
        if (tokenOf(req)) guest = userOf(req);
        const user = await auth.register(
          data.email,
          data.password,
          data.name,
          guest?.guest ? guest.id : undefined,
        );
        return json(res, 201, {
          token: store.newSession(user.id),
          profile: store.profile(user.id, games.ids()),
        });
      }
      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const data = z
          .object({ email: emailSchema, password: z.string().min(1).max(128) })
          .strict()
          .parse(await body(req));
        if (!limits.allow(`login:${ip}:${data.email}`, 10, 300000))
          return json(res, 429, { error: 'rate-limited' });
        const user = await auth.login(data.email, data.password);
        return json(res, 200, {
          token: store.newSession(user.id),
          profile: store.profile(user.id, games.ids()),
        });
      }
      if (url.pathname === '/api/auth/exchange' && req.method === 'POST') {
        const data = z
          .object({
            code: z.string().min(20).max(256),
            verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
          })
          .strict()
          .parse(await body(req));
        const user = auth.exchange(data.code, data.verifier);
        return json(res, 200, {
          token: store.newSession(user.id),
          profile: store.profile(user.id, games.ids()),
        });
      }
      const start = /^\/api\/auth\/oauth\/(google|apple)\/start$/.exec(url.pathname);
      if (start && req.method === 'GET') {
        res.writeHead(302, {
          Location: auth.start(
            start[1] as 'google' | 'apple',
            url.searchParams.get('challenge') ?? '',
            url.searchParams.get('native') === '1',
          ),
        });
        return res.end();
      }
      if (callback && (req.method === 'GET' || req.method === 'POST')) {
        const data = z
          .object({ state: z.string().max(256), code: z.string().max(4096) })
          .passthrough()
          .parse(req.method === 'POST' ? await body(req) : Object.fromEntries(url.searchParams));
        const redirect = await auth.callback(
          callback[1] as 'google' | 'apple',
          data.state,
          data.code,
        );
        res.writeHead(302, { Location: redirect });
        return res.end();
      }
      if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
        const user = userOf(req);
        store.logout(tokenOf(req));
        for (const ws of sockets.get(user.id) ?? []) ws.close(4001, 'Signed out');
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/profile' && req.method === 'GET')
        return json(res, 200, store.profile(userOf(req).id, games.ids()));
      if (url.pathname === '/api/profile' && req.method === 'PATCH') {
        const user = userOf(req),
          data = z
            .object({
              name: nameSchema.optional(),
              avatar: z.enum(['orbit', 'rook', 'comet', 'hex', 'crown', 'moon']).optional(),
              favorites: z.array(z.string()).max(30).optional(),
            })
            .strict()
            .parse(await body(req));
        if (data.favorites?.some((id) => !games.ids().includes(id)))
          throw new RuleError('unknown-game');
        store.db
          .prepare('UPDATE users SET name=?,avatar=?,favorites=? WHERE id=?')
          .run(
            data.name ?? user.name,
            data.avatar ?? user.avatar,
            JSON.stringify(data.favorites ?? JSON.parse(user.favorites)),
            user.id,
          );
        return json(res, 200, store.profile(user.id, games.ids()));
      }
      if (url.pathname === '/api/friends' && req.method === 'POST') {
        const user = userOf(req),
          data = z
            .object({ code: z.string().regex(/^[A-F0-9]{12}$/) })
            .strict()
            .parse(await body(req));
        store.addFriend(user.id, data.code);
        return json(res, 200, store.profile(user.id, games.ids()));
      }
      if (url.pathname.startsWith('/api/friends/') && req.method === 'DELETE') {
        const user = userOf(req);
        store.db
          .prepare('DELETE FROM friends WHERE user_id=? AND friend_id=?')
          .run(user.id, url.pathname.split('/').at(-1)!);
        return json(res, 200, store.profile(user.id, games.ids()));
      }
      if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
        const user = userOf(req),
          gameId = url.searchParams.get('gameId') ?? 'abalone';
        games.get(gameId);
        const period = z
          .enum(['global', 'weekly', 'monthly', 'friends'])
          .parse(url.searchParams.get('period') ?? 'global');
        return json(res, 200, {
          entries: store.leaderboard(gameId, period, user.id),
          period,
        });
      }
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not-found' });
      if (req.method !== 'GET' && req.method !== 'HEAD')
        return json(res, 405, { error: 'method-not-allowed' });
      const root = resolve(options.staticDir ?? 'dist/mobile'),
        pathname = decodeURIComponent(url.pathname),
        path = resolve(root, '.' + pathname);
      if (path !== root && !path.startsWith(root + sep))
        return json(res, 403, { error: 'forbidden' });
      let bytes: Buffer,
        extension = extname(path);
      try {
        bytes = await readFile(path);
      } catch {
        if (extension) return json(res, 404, { error: 'not-found' });
        bytes = await readFile(resolve(root, 'index.html'));
        extension = '.html';
      }
      const types: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
      };
      res.writeHead(200, {
        'Content-Type': types[extension] ?? 'application/octet-stream',
        'Cache-Control':
          extension === '.html'
            ? 'no-cache'
            : pathname.startsWith('/assets/')
              ? 'public,max-age=31536000,immutable'
              : 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      const code =
        error instanceof RuleError
          ? error.code
          : error instanceof z.ZodError || error instanceof SyntaxError
            ? 'invalid-request'
            : 'server-error';
      if (code === 'server-error')
        console.error('Request failed', error instanceof Error ? error.name : 'unknown');
      json(res, code === 'unauthorized' ? 401 : code === 'server-error' ? 500 : 400, {
        error: code,
      });
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16384,
    perMessageDeflate: false,
  });
  server.on('upgrade', (req, socket, head) => {
    if (
      req.url !== '/ws' ||
      (req.headers.origin && !origins.has(req.headers.origin)) ||
      !limits.allow(`upgrade:${req.socket.remoteAddress}`, 60, 60000)
    ) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  const alive = new WeakMap<WebSocket, boolean>();
  wss.on('connection', (ws, req) => {
    alive.set(ws, true);
    const authTimeout = setTimeout(() => {
      if (!userBySocket.has(ws)) ws.close(4001, 'Authentication required');
    }, 5000);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('message', (raw) => {
      let commandId: string | undefined, matchId: string | undefined;
      try {
        if (!limits.allow(`ws:${userBySocket.get(ws) ?? req.socket.remoteAddress}`, 120, 10000))
          throw new RuleError('rate-limited');
        const message = clientMessageSchema.parse(JSON.parse(raw.toString()));
        if ('commandId' in message) commandId = message.commandId;
        if ('matchId' in message) matchId = message.matchId;
        if (message.type === 'auth') {
          if (userBySocket.has(ws)) throw new RuleError('already-authenticated');
          const user = store.authenticate(message.token);
          clearTimeout(authTimeout);
          if ((sockets.get(user.id)?.size ?? 0) >= 4) throw new RuleError('too-many-connections');
          userBySocket.set(ws, user.id);
          tokenBySocket.set(ws, message.token);
          if (!sockets.has(user.id)) sockets.set(user.id, new Set());
          sockets.get(user.id)!.add(ws);
          send(ws, { type: 'ready', userId: user.id, serverNow: Date.now() });
          for (const match of matches.connection(user.id, true)) broadcast(match);
          return;
        }
        const userId = userBySocket.get(ws);
        if (!userId) throw new RuleError('unauthorized');
        store.authenticate(tokenBySocket.get(ws)!);
        if (message.type === 'ping') return send(ws, { type: 'pong', serverNow: Date.now() });
        if (message.type === 'queue') {
          const match = lobby.enqueue(
            userId,
            message.gameId,
            message.ranked,
            message.playerCount,
            message.turnSeconds,
          );
          if (match) broadcast(match);
          else
            send(ws, {
              type: 'queued',
              gameId: message.gameId,
              ranked: message.ranked,
              playerCount: message.playerCount,
              turnSeconds:
                message.gameId === 'digitalGame' ? (message.turnSeconds ?? 60) : null,
            });
          return;
        }
        if (message.type === 'cancel') {
          for (const room of lobby.cancel(userId)) broadcastRoom(room);
          return send(ws, { type: 'cancelled' });
        }
        if (message.type === 'create-room') {
          const room = lobby.createRoom(
            userId,
            message.gameId,
            message.playerCount,
            message.turnSeconds,
          );
          broadcastRoom(room);
          return;
        }
        if (message.type === 'join-room') {
          const joined = lobby.joinRoomResult(userId, message.code);
          if (joined.match) broadcast(joined.match);
          else broadcastRoom(joined.room);
          return;
        }
        if (message.type === 'resume')
          return send(ws, {
            type: 'match',
            match: matches.forUser(matches.get(message.matchId, userId), userId),
          });
        if (message.type === 'rematch') {
          const match = matches.rematch(userId, message.matchId);
          broadcast(match);
          for (const p of match.players)
            if (!sockets.get(p.id)?.size)
              for (const disconnected of matches.connection(p.id, false)) broadcast(disconnected);
          return;
        }
        if (message.type === 'emote') {
          const m = store.loadMatch(message.matchId),
            player = matches.seat(m, userId);
          if (m.result) throw new RuleError('game-over');
          if (!limits.allow(`emote:${userId}`, 4, 5000)) throw new RuleError('rate-limited');
          for (const p of m.players)
            sendUser(p.id, {
              type: 'emote',
              matchId: m.id,
              player,
              emote: message.emote,
            });
          return;
        }
        broadcast(matches.command(userId, message), message.commandId);
      } catch (error) {
        const code =
          error instanceof RuleError
            ? error.code
            : error instanceof z.ZodError || error instanceof SyntaxError
              ? 'invalid-message'
              : 'server-error';
        send(ws, { type: 'error', code, commandId });
        if ((code === 'stale-revision' || code === 'game-over') && matchId) {
          const user = userBySocket.get(ws);
          if (user)
            try {
              broadcast(matches.get(matchId, user));
            } catch {}
        }
        if (code === 'unauthorized') ws.close(4001, 'Authentication required');
      }
    });
    ws.on('error', () => {});
    ws.on('close', () => {
      clearTimeout(authTimeout);
      const id = userBySocket.get(ws);
      userBySocket.delete(ws);
      tokenBySocket.delete(ws);
      if (!id) return;
      sockets.get(id)?.delete(ws);
      if (!sockets.get(id)?.size) {
        sockets.delete(id);
        for (const room of lobby.cancel(id)) broadcastRoom(room);
        for (const match of matches.connection(id, false)) broadcast(match);
      }
    });
  });
  matches.recoverAfterRestart();
  const tick = setInterval(() => {
    try {
      for (const match of [...matches.tick(), ...lobby.tick()]) broadcast(match);
    } catch (error) {
      console.error('Match maintenance failed', error instanceof Error ? error.name : 'unknown');
    }
  }, 1000);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
    store.cleanup();
    limits.prune();
  }, 15000);
  return {
    server,
    wss,
    store,
    matches,
    lobby,
    async close() {
      clearInterval(tick);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

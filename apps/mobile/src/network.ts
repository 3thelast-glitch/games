import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type MatchCommand,
  type ServerMessage,
} from '../../../packages/core/src/protocol.ts';
import { storage } from './platform.ts';
const configured = (import.meta.env?.VITE_SERVER_URL ?? '').replace(/\/$/, '');
if (configured && !/^https?:\/\//.test(configured))
  throw new Error('VITE_SERVER_URL must be an HTTP(S) origin');
export const serverURL = configured || location.origin;
export async function api<T>(
  path: string,
  token: string | null = null,
  body?: unknown,
  method?: string,
): Promise<T> {
  try {
    const response = await fetch(serverURL + path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error('network-error');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'server-error');
    return data as T;
  } catch (error) {
    if (
      error instanceof Error &&
      !(error instanceof TypeError) &&
      error.name !== 'TimeoutError' &&
      error.name !== 'AbortError'
    )
      throw error;
    throw new Error('network-error');
  }
}
export class ArenaConnection {
  private ws: WebSocket | null = null;
  private token = '';
  private stopped = true;
  private ready = false;
  private retry = 0;
  private generation = 0;
  private lastReceivedAt = 0;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private pending = new Map<string, MatchCommand>();
  private listeners = new Set<(m: ServerMessage) => void>();
  private statusListeners = new Set<(s: string) => void>();
  lastMatch: string | null = null;
  subscribe(listener: (m: ServerMessage) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  status(listener: (s: string) => void) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }
  private emitStatus(status: string) {
    this.statusListeners.forEach((fn) => fn(status));
  }
  get isReady() {
    return this.ready;
  }
  get hasPending() {
    return this.pending.size > 0;
  }
  async start(token: string) {
    if (this.token === token && !this.stopped) return;
    this.stop();
    const generation = this.generation;
    this.token = token;
    this.stopped = false;
    this.retry = 0;
    const lastMatch = await storage.get<string | null>(`last-match:${token.slice(0, 12)}`, null);
    const pending = await storage.get<MatchCommand[]>(`pending:${token.slice(0, 12)}`, []);
    if (generation !== this.generation || this.stopped) return;
    this.lastMatch = lastMatch;
    this.pending = new Map(pending.map((m) => [m.commandId, m]));
    this.connect();
  }
  private persist() {
    void storage.set(`pending:${this.token.slice(0, 12)}`, [...this.pending.values()]);
  }
  private connect() {
    if (this.stopped) return;
    this.emitStatus(this.retry ? 'reconnecting' : 'connecting');
    const url = new URL('/ws', serverURL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(url);
    const ws = this.ws;
    this.connectTimeout = setTimeout(() => {
      if (this.ws === ws && !this.ready) ws.close();
    }, 12000);
    ws.onopen = () => {
      if (this.ws === ws) ws.send(JSON.stringify({ type: 'auth', token: this.token, version: PROTOCOL_VERSION }));
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.lastReceivedAt = Date.now();
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'ready') {
        if (this.connectTimeout) clearTimeout(this.connectTimeout);
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.ready = true;
        this.retry = 0;
        this.emitStatus('connected');
        if (this.lastMatch) this.send({ type: 'resume', matchId: this.lastMatch });
        for (const command of this.pending.values()) this.send(command);
        this.heartbeat = setInterval(() => {
          if (Date.now() - this.lastReceivedAt > 25000) ws.close();
          else if (this.ready) this.send({ type: 'ping' });
        }, 10000);
      }
      if (message.type === 'match') {
        if (message.ack) {
          this.pending.delete(message.ack);
          this.persist();
        }
        this.lastMatch = message.match.id;
        void storage.set(`last-match:${this.token.slice(0, 12)}`, this.lastMatch);
      }
      if (message.type === 'error') {
        if (message.commandId) {
          this.pending.delete(message.commandId);
          this.persist();
        }
        if (message.code === 'unauthorized') {
          this.stopped = true;
          ws.close();
          this.emitStatus('offline');
        }
      }
      this.listeners.forEach((fn) => fn(message));
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (this.connectTimeout) clearTimeout(this.connectTimeout);
      this.ready = false;
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      if (this.stopped) {
        this.emitStatus('offline');
        return;
      }
      this.retry++;
      this.emitStatus('reconnecting');
      this.timer = setTimeout(
        () => this.connect(),
        Math.min(15000, 500 * 2 ** Math.min(this.retry, 5)) + Math.random() * 250,
      );
    };
    ws.onerror = () => {};
  }
  async waitReady() {
    if (this.ready) return;
    return new Promise<void>((resolve, reject) => {
      const unsubscribe = this.subscribe((m) => {
        if (m.type === 'ready') {
          cleanup();
          resolve();
        } else if (m.type === 'error' && m.code === 'unauthorized') {
          cleanup();
          reject(new Error(m.code));
        }
      });
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('network-error'));
      }, 10000);
      const cleanup = () => {
        unsubscribe();
        clearTimeout(timeout);
      };
    });
  }
  send(message: ClientMessage) {
    if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) throw new Error('network-error');
    this.ws.send(JSON.stringify(message));
  }
  submit(message: MatchCommand) {
    if (this.pending.size) throw new Error('pendingMove');
    this.pending.set(message.commandId, message);
    this.persist();
    try {
      this.send(message);
    } catch (error) {
      this.pending.delete(message.commandId);
      this.persist();
      throw error;
    }
  }
  forgetMatch() {
    this.lastMatch = null;
    void storage.set(`last-match:${this.token.slice(0, 12)}`, null);
  }
  stop() {
    this.generation++;
    this.stopped = true;
    this.ready = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.ws?.close();
    this.ws = null;
    this.emitStatus('offline');
  }
}
export const connection = new ArenaConnection();

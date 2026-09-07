import { games } from '../../../packages/games/registry.ts';
import {
  LAN_DEFAULT_PORT,
  LAN_PROTOCOL_VERSION,
  LAN_RULESET_VERSION,
  LAN_SERVICE_TYPE,
  LanAuthority,
  lanClientMessageSchema,
  type LanClientMessage,
  type LanServerMessage,
  type LanSnapshot,
  type TurnTimerSeconds,
} from '../../../packages/core/src/lan.ts';
import {
  lanMetadata,
  lanNativeAvailable,
  normalizeNativeService,
  requireLanNative,
  type NativeLanService,
} from './lan-native.ts';

export type LanConnectionStatus =
  | 'idle'
  | 'hosting'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed';

export interface LanView {
  role: 'host' | 'guest' | null;
  status: LanConnectionStatus;
  snapshot: LanSnapshot | null;
  self: 0 | 1 | null;
  endpoint: string | null;
  rooms: NativeLanService[];
  error: string | null;
}

type Listener = (view: LanView) => void;

type NativeHandle = { remove: () => Promise<void> };

export class ReversiLanController {
  private listeners = new Set<Listener>();
  private handles: NativeHandle[] = [];
  private authority: LanAuthority | null = null;
  private guestConnectionId: string | null = null;
  private guestResumeToken: string | null = null;
  private guestTarget: { host: string; port: number; roomId: string; roomName: string } | null = null;
  private hostConnectionTokens = new Map<string, string>();
  private reconnectAbort = 0;
  private view: LanView = {
    role: null,
    status: 'idle',
    snapshot: null,
    self: null,
    endpoint: null,
    rooms: [],
    error: null,
  };

  get available() {
    return lanNativeAvailable;
  }

  get current() {
    return this.view;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.view);
    return () => this.listeners.delete(listener);
  }

  async createHost(options: { name: string; roomName?: string; turnSeconds: TurnTimerSeconds | null }) {
    await this.reset();
    if (!this.available) throw new Error('lan-native-only');
    await this.ensureNativeListeners();
    const hostSeat = crypto.getRandomValues(new Uint8Array(1))[0] & 1 ? 1 : 0;
    this.authority = new LanAuthority({
      game: games.get('reversi'),
      hostName: options.name,
      roomName: options.roomName,
      hostSeat,
      turnSeconds: options.turnSeconds,
    });
    this.patch({ role: 'host', status: 'connecting', self: hostSeat, snapshot: this.authority.snapshot(), error: null });
    const native = requireLanNative();
    try {
      const result = await native.startHost({
        port: LAN_DEFAULT_PORT,
        serviceType: LAN_SERVICE_TYPE,
        serviceName: this.authority.roomName,
        metadata: lanMetadata(this.authority.advertisement(LAN_DEFAULT_PORT)),
      });
      await native.updateHost({ metadata: lanMetadata(this.authority.advertisement(result.port)) });
      this.patch({
        status: 'hosting',
        endpoint: formatEndpoint(result.host, result.port),
        snapshot: this.authority.snapshot(),
      });
    } catch (error) {
      this.patch({ status: 'error', error: errorCode(error) });
      throw error;
    }
  }

  async discover() {
    if (!this.available) throw new Error('lan-native-only');
    await this.ensureNativeListeners();
    this.patch({ role: 'guest', status: 'discovering', rooms: [], error: null });
    await requireLanNative().startDiscovery({ serviceType: LAN_SERVICE_TYPE });
  }

  async stopDiscovery() {
    if (!this.available) return;
    await requireLanNative().stopDiscovery().catch(() => {});
    if (this.view.status === 'discovering') this.patch({ status: 'idle' });
  }

  async joinDiscovered(room: NativeLanService, name: string) {
    await this.joinTarget({ host: room.host, port: room.port, roomId: room.roomId, roomName: room.roomName }, name);
  }

  async joinManual(target: { host: string; port: number }, roomId: string, name: string, roomName = 'Board Arena LAN') {
    await this.joinTarget({ ...target, roomId, roomName }, name);
  }

  async setReady(ready: boolean) {
    if (this.view.role === 'host') {
      if (!this.authority) throw new Error('lan-host-not-running');
      const reply = this.authority.hostReady(ready);
      await this.publishHostReply(reply);
      return;
    }
    await this.sendGuest({ type: 'ready', ready });
  }

  async move(move: { row: number; col: number }, actionId = crypto.randomUUID()) {
    const snapshot = this.view.snapshot;
    if (!snapshot?.matchId) throw new Error('match-not-started');
    const message: Extract<LanClientMessage, { type: 'move' }> = {
      type: 'move',
      matchId: snapshot.matchId,
      actionId,
      expectedRevision: snapshot.revision,
      move,
    };
    if (this.view.role === 'host') {
      if (!this.authority) throw new Error('lan-host-not-running');
      await this.publishHostReply(this.authority.handle(this.authority.hostToken, message));
      return;
    }
    await this.sendGuest(message);
  }

  async rematch() {
    const matchId = this.view.snapshot?.matchId;
    if (!matchId) throw new Error('match-not-started');
    if (this.view.role === 'host') {
      if (!this.authority) throw new Error('lan-host-not-running');
      await this.publishHostReply(this.authority.handle(this.authority.hostToken, { type: 'rematch', matchId }));
      return;
    }
    await this.sendGuest({ type: 'rematch', matchId });
  }

  async leave() {
    this.reconnectAbort++;
    if (this.view.role === 'host' && this.authority) {
      this.authority.leave(this.authority.hostToken, true);
      await this.broadcastSnapshot();
      await requireLanNative().stopHost().catch(() => {});
    } else if (this.view.role === 'guest' && this.guestConnectionId) {
      await this.sendGuest({ type: 'leave' }).catch(() => {});
      await requireLanNative().disconnect({ connectionId: this.guestConnectionId }).catch(() => {});
    }
    await this.reset();
  }

  async close() {
    await this.leave().catch(() => {});
    for (const handle of this.handles.splice(0)) await handle.remove().catch(() => {});
    this.patch({ status: 'closed' });
  }

  private async joinTarget(target: { host: string; port: number; roomId: string; roomName: string }, name: string) {
    if (!this.available) throw new Error('lan-native-only');
    await this.ensureNativeListeners();
    await requireLanNative().stopDiscovery().catch(() => {});
    this.guestTarget = target;
    this.patch({ role: 'guest', status: 'connecting', endpoint: formatEndpoint(target.host, target.port), error: null });
    try {
      const { connectionId } = await requireLanNative().connect({ host: target.host, port: target.port });
      this.guestConnectionId = connectionId;
      await this.sendRaw(connectionId, {
        type: 'hello',
        protocolVersion: LAN_PROTOCOL_VERSION,
        rulesetVersion: LAN_RULESET_VERSION,
        roomId: target.roomId,
        name,
        ...(this.guestResumeToken ? { resumeToken: this.guestResumeToken } : {}),
      });
    } catch (error) {
      this.patch({ status: 'error', error: errorCode(error) });
      throw error;
    }
  }

  private async ensureNativeListeners() {
    if (this.handles.length) return;
    const native = requireLanNative();
    this.handles.push(
      await native.addListener('serviceFound', (event) => {
        try {
          const room = normalizeNativeService(event);
          const rooms = [...this.view.rooms.filter((item) => item.roomId !== room.roomId), room].sort((a, b) => a.roomName.localeCompare(b.roomName));
          this.patch({ rooms });
        } catch {}
      }),
      await native.addListener('serviceLost', (event) => {
        const rooms = this.view.rooms.filter(
          (item) => (event.roomId ? item.roomId !== event.roomId : item.name !== event.name),
        );
        this.patch({ rooms });
      }),
      await native.addListener('clientConnected', () => {
        if (this.view.role === 'host') this.patch({ status: 'hosting' });
      }),
      await native.addListener('message', (event) => void this.onNativeMessage(event.connectionId, event.data)),
      await native.addListener('disconnected', (event) => void this.onNativeDisconnect(event.connectionId)),
    );
  }

  private async onNativeMessage(connectionId: string, data: string) {
    let raw: unknown;
    try {
      raw = JSON.parse(data);
    } catch {
      if (this.view.role === 'host') await this.sendRaw(connectionId, { type: 'error', code: 'invalid-message' });
      return;
    }
    if (this.view.role === 'host') {
      if (!this.authority) return;
      let reply: LanServerMessage;
      const token = this.hostConnectionTokens.get(connectionId);
      if (!token) {
        let hello: Extract<LanClientMessage, { type: 'hello' }>;
        try {
          const parsed = lanClientMessageSchema.parse(raw);
          if (parsed.type !== 'hello') throw new Error('hello-required');
          hello = parsed;
        } catch {
          await this.sendRaw(connectionId, { type: 'error', code: 'hello-required' });
          return;
        }
        reply = this.authority.join(hello);
        if (reply.type === 'welcome') this.hostConnectionTokens.set(connectionId, reply.resumeToken);
      } else {
        reply = this.authority.handle(token, raw);
      }
      if (reply.type === 'snapshot') await this.publishHostReply(reply);
      else {
        await this.sendRaw(connectionId, reply);
        this.patch({ snapshot: this.authority.snapshot() });
      }
      return;
    }
    let message: LanServerMessage;
    try {
      message = raw as LanServerMessage;
      if (!message || typeof message !== 'object' || !('type' in message)) throw new Error('invalid-message');
    } catch {
      this.patch({ status: 'error', error: 'invalid-message' });
      return;
    }
    if (message.type === 'welcome') {
      this.guestResumeToken = message.resumeToken;
      this.patch({ status: 'connected', self: message.self, snapshot: message.snapshot, error: null });
    } else if (message.type === 'snapshot') {
      if (this.view.snapshot?.matchId === message.snapshot.matchId && this.view.snapshot.revision > message.snapshot.revision) return;
      this.patch({ status: 'connected', snapshot: message.snapshot, error: null });
    } else if (message.type === 'error') {
      if (message.snapshot) this.patch({ snapshot: message.snapshot });
      this.patch({ error: message.code });
    }
  }

  private async onNativeDisconnect(connectionId: string) {
    if (this.view.role === 'host') {
      const token = this.hostConnectionTokens.get(connectionId);
      this.hostConnectionTokens.delete(connectionId);
      if (token && this.authority) {
        this.authority.disconnect(token);
        this.patch({ snapshot: this.authority.snapshot() });
      }
      return;
    }
    if (connectionId !== this.guestConnectionId) return;
    this.guestConnectionId = null;
    if (!this.guestTarget || !this.guestResumeToken || this.view.status === 'closed' || this.view.status === 'idle') return;
    const generation = ++this.reconnectAbort;
    this.patch({ status: 'reconnecting' });
    const started = Date.now();
    let delay = 500;
    while (generation === this.reconnectAbort && Date.now() - started < 60_000) {
      await sleep(delay + Math.floor(Math.random() * 200));
      try {
        const { connectionId: next } = await requireLanNative().connect({ host: this.guestTarget.host, port: this.guestTarget.port });
        if (generation !== this.reconnectAbort) {
          await requireLanNative().disconnect({ connectionId: next }).catch(() => {});
          return;
        }
        this.guestConnectionId = next;
        await this.sendRaw(next, {
          type: 'hello',
          protocolVersion: LAN_PROTOCOL_VERSION,
          rulesetVersion: LAN_RULESET_VERSION,
          roomId: this.guestTarget.roomId,
          name: this.view.snapshot?.players.find((player) => player.seat === this.view.self)?.name ?? 'Guest',
          resumeToken: this.guestResumeToken,
        });
        return;
      } catch {}
      delay = Math.min(5_000, delay * 2);
    }
    if (generation === this.reconnectAbort) this.patch({ status: 'error', error: 'lan-reconnect-expired' });
  }

  private async publishHostReply(reply: LanServerMessage) {
    if (reply.type === 'snapshot') {
      this.patch({ snapshot: reply.snapshot, status: 'hosting', error: null });
      await this.broadcast(reply);
    } else if (reply.type === 'error') {
      this.patch({ error: reply.code, snapshot: reply.snapshot ?? this.authority?.snapshot() ?? this.view.snapshot });
    }
  }

  private async broadcastSnapshot() {
    if (!this.authority) return;
    const message: LanServerMessage = { type: 'snapshot', snapshot: this.authority.snapshot() };
    this.patch({ snapshot: message.snapshot });
    await this.broadcast(message);
  }

  private async broadcast(message: LanServerMessage) {
    await Promise.all(
      [...this.hostConnectionTokens.keys()].map((connectionId) => this.sendRaw(connectionId, message).catch(() => {})),
    );
  }

  private async sendGuest(message: Exclude<LanClientMessage, { type: 'hello' }>) {
    if (!this.guestConnectionId) throw new Error('lan-not-connected');
    await this.sendRaw(this.guestConnectionId, message);
  }

  private async sendRaw(connectionId: string, message: unknown) {
    const data = JSON.stringify(message);
    if (data.length > 16_384) throw new Error('lan-message-too-large');
    await requireLanNative().send({ connectionId, data });
  }

  private async reset() {
    this.reconnectAbort++;
    if (this.available) {
      await requireLanNative().stopDiscovery().catch(() => {});
      await requireLanNative().stopHost().catch(() => {});
      if (this.guestConnectionId) await requireLanNative().disconnect({ connectionId: this.guestConnectionId }).catch(() => {});
    }
    this.authority = null;
    this.guestConnectionId = null;
    this.guestResumeToken = null;
    this.guestTarget = null;
    this.hostConnectionTokens.clear();
    this.patch({ role: null, status: 'idle', snapshot: null, self: null, endpoint: null, rooms: [], error: null });
  }

  private patch(patch: Partial<LanView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener(this.view);
  }
}

export const lan = new ReversiLanController();

function formatEndpoint(host: string, port: number) {
  return `${host.includes(':') ? `[${host}]` : host}:${port}`;
}

function errorCode(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

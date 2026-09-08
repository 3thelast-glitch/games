import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import {
  LAN_DEFAULT_PORT,
  LAN_PROTOCOL_VERSION,
  LAN_RULESET_VERSION,
  LAN_SERVICE_TYPE,
  lanAdvertisementSchema,
  parseLanEndpoint,
  type LanAdvertisement,
} from '../../../packages/core/src/lan.ts';

export interface NativeLanService extends LanAdvertisement {
  name: string;
  host: string;
}

interface NativeLanServiceEvent {
  name: string;
  host: string;
  port: number | string;
  id?: string;
  room?: string;
  game?: string;
  pv?: number | string;
  rv?: number | string;
  occ?: number | string;
  cap?: number | string;
}

interface NativeLanPlugin {
  startHost(options: { port: number; serviceType: string; serviceName: string; metadata: Record<string, string> }): Promise<{ host: string; port: number }>;
  updateHost(options: { metadata: Record<string, string> }): Promise<void>;
  stopHost(): Promise<void>;
  startDiscovery(options: { serviceType: string }): Promise<void>;
  stopDiscovery(): Promise<void>;
  connect(options: { host: string; port: number }): Promise<{ connectionId: string }>;
  disconnect(options: { connectionId: string }): Promise<void>;
  send(options: { connectionId: string; data: string }): Promise<void>;
  addListener(eventName: 'clientConnected', listener: (event: { connectionId: string; host?: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'message', listener: (event: { connectionId: string; data: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'disconnected', listener: (event: { connectionId: string; reason?: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'serviceFound', listener: (event: NativeLanServiceEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'serviceLost', listener: (event: { roomId?: string; name?: string; host?: string; port?: number }) => void): Promise<PluginListenerHandle>;
}

const plugin = registerPlugin<NativeLanPlugin>('BoardArenaLan');

export const lanNativeAvailable = Capacitor.isNativePlatform();

export function requireLanNative() {
  if (!lanNativeAvailable) throw new Error('lan-native-only');
  return plugin;
}

export function normalizeNativeService(event: NativeLanServiceEvent): NativeLanService {
  const advertisement = lanAdvertisementSchema.parse({
    roomId: event.id,
    roomName: event.room,
    gameId: event.game,
    protocolVersion: Number(event.pv),
    rulesetVersion: Number(event.rv),
    occupancy: Number(event.occ),
    capacity: Number(event.cap),
    port: Number(event.port),
  });
  if (!event.host || event.host.length > 253) throw new Error('invalid-lan-address');
  return { ...advertisement, name: event.name, host: event.host };
}

/** DNS-SD TXT keys stay <= 9 ASCII characters and never carry endpoint ports or secrets. */
export function lanMetadata(advertisement: LanAdvertisement): Record<string, string> {
  return {
    id: advertisement.roomId,
    room: advertisement.roomName,
    game: advertisement.gameId,
    pv: String(advertisement.protocolVersion),
    rv: String(advertisement.rulesetVersion),
    occ: String(advertisement.occupancy),
    cap: String(advertisement.capacity),
  };
}

export function manualLanTarget(value: string) {
  return parseLanEndpoint(value, LAN_DEFAULT_PORT);
}

export const lanNativeConstants = {
  serviceType: LAN_SERVICE_TYPE,
  protocolVersion: LAN_PROTOCOL_VERSION,
  rulesetVersion: LAN_RULESET_VERSION,
};

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
  addListener(eventName: 'serviceFound', listener: (event: NativeLanService) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'serviceLost', listener: (event: { roomId?: string; name?: string; host?: string; port?: number }) => void): Promise<PluginListenerHandle>;
}

const plugin = registerPlugin<NativeLanPlugin>('BoardArenaLan');

export const lanNativeAvailable = Capacitor.isNativePlatform();

export function requireLanNative() {
  if (!lanNativeAvailable) throw new Error('lan-native-only');
  return plugin;
}

export function normalizeNativeService(event: NativeLanService): NativeLanService {
  const advertisement = lanAdvertisementSchema.parse({
    roomId: event.roomId,
    roomName: event.roomName,
    gameId: event.gameId,
    protocolVersion: Number(event.protocolVersion),
    rulesetVersion: Number(event.rulesetVersion),
    occupancy: Number(event.occupancy),
    capacity: Number(event.capacity),
    port: Number(event.port),
  });
  if (!event.host || event.host.length > 253) throw new Error('invalid-lan-address');
  return { ...advertisement, name: event.name, host: event.host };
}

export function lanMetadata(advertisement: LanAdvertisement): Record<string, string> {
  return Object.fromEntries(Object.entries(advertisement).map(([key, value]) => [key, String(value)]));
}

export function manualLanTarget(value: string) {
  return parseLanEndpoint(value, LAN_DEFAULT_PORT);
}

export const lanNativeConstants = {
  serviceType: LAN_SERVICE_TYPE,
  protocolVersion: LAN_PROTOCOL_VERSION,
  rulesetVersion: LAN_RULESET_VERSION,
};

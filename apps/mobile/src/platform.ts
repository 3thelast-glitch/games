import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Browser } from '@capacitor/browser';
import { App as NativeApp } from '@capacitor/app';
export interface Settings {
  lang: 'en' | 'ar';
  sound: boolean;
  haptics: boolean;
  reduceMotion: boolean;
  notifications: boolean;
}
export const defaults: Settings = {
  lang: navigator.language.startsWith('ar') ? 'ar' : 'en',
  sound: true,
  haptics: true,
  reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  notifications: true,
};
export const storage = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const { value } = await Preferences.get({ key: `arena:${key}` });
      return value ? (JSON.parse(value) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  async set(key: string, value: unknown) {
    await Preferences.set({
      key: `arena:${key}`,
      value: JSON.stringify(value),
    });
  },
  async remove(key: string) {
    await Preferences.remove({ key: `arena:${key}` });
  },
};
let context: AudioContext | undefined;
export function feedback(settings: Settings, kind: 'move' | 'win' = 'move') {
  if (settings.haptics) {
    if (Capacitor.isNativePlatform())
      void (
        kind === 'win'
          ? Haptics.notification({ type: NotificationType.Success })
          : Haptics.impact({ style: ImpactStyle.Light })
      ).catch(() => {});
    else navigator.vibrate?.(kind === 'win' ? [35, 60, 35] : 15);
  }
  if (!settings.sound) return;
  try {
    context ??= new AudioContext();
    void context.resume();
    for (let i = 0; i < (kind === 'win' ? 3 : 1); i++) {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = kind === 'win' ? [523, 659, 784][i] : 430;
      gain.gain.setValueAtTime(0.08, context.currentTime + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + i * 0.13 + 0.15);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + i * 0.13);
      oscillator.stop(context.currentTime + i * 0.13 + 0.16);
    }
  } catch {}
}
export async function openAuth(url: string) {
  if (Capacitor.isNativePlatform()) await Browser.open({ url });
  else location.assign(url);
}
export async function listenAuth(callback: (code: string) => void) {
  const accept = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'com.boardarena.app:' && parsed.host === 'auth') {
        const code = parsed.searchParams.get('code');
        if (code) {
          void Browser.close().catch(() => {});
          callback(code);
        }
      }
    } catch {}
  };
  const launch = await NativeApp.getLaunchUrl().catch(() => undefined);
  if (launch?.url) accept(launch.url);
  const listener = await NativeApp.addListener('appUrlOpen', (event) => accept(event.url));
  return () => {
    void listener.remove();
  };
}
export const isNative = Capacitor.isNativePlatform();

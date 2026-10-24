import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeOrientation {
  landscape(): Promise<void>;
  restore(): Promise<void>;
}
const native = registerPlugin<NativeOrientation>('NaqlaOrientation');
type LockOrientation = ScreenOrientation & {
  lock?: (mode: 'landscape') => Promise<void>;
  unlock?: () => void;
};
let enteredFullscreen = false;

/** Run on explicit play tap so browser fullscreen permission retains user activation. */
export function requestGameFullscreen(): void {
  if (Capacitor.isNativePlatform() || !document.fullscreenEnabled || document.fullscreenElement) return;
  try {
    const pending = document.documentElement.requestFullscreen?.();
    if (pending) void pending.then(() => { enteredFullscreen = true; }).catch(() => {});
  } catch { /* Inline landscape remains playable when browser denies fullscreen. */ }
}
export async function enterGameLandscape(gameId = 'appleWorm'): Promise<void> {
  document.documentElement.dataset.immersiveGame = gameId;
  document.documentElement.style.overflow = 'hidden';
  if (Capacitor.isNativePlatform()) {
    try { await native.landscape(); return; } catch { /* Rotate prompt is fallback. */ }
  }
  const orientation = screen.orientation as LockOrientation | undefined;
  try { await orientation?.lock?.('landscape'); } catch { /* iOS Safari may not support lock. */ }
}
export async function leaveGameLandscape(): Promise<void> {
  delete document.documentElement.dataset.immersiveGame;
  document.documentElement.style.overflow = '';
  if (Capacitor.isNativePlatform()) {
    try { await native.restore(); } catch { /* Restore UI regardless of plugin support. */ }
  } else {
    try { (screen.orientation as LockOrientation | undefined)?.unlock?.(); } catch {}
    if (enteredFullscreen && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
  }
  enteredFullscreen = false;
}

/** Portrait-friendly immersive games share browser fullscreen but do not lock orientation. */
export function enterFullscreenOnlyGame(gameId: string): void {
  document.documentElement.dataset.immersiveGame = gameId;
  document.documentElement.style.overflow = 'hidden';
}
export async function leaveFullscreenOnlyGame(): Promise<void> {
  delete document.documentElement.dataset.immersiveGame;
  document.documentElement.style.overflow = '';
  if (enteredFullscreen && document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch { /* Safe inline fallback. */ }
  }
  enteredFullscreen = false;
}

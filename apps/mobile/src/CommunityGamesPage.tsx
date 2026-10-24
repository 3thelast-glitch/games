import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { enterFullscreenOnlyGame, leaveFullscreenOnlyGame, enterGameLandscape, leaveGameLandscape, requestGameFullscreen } from './immersive-game.ts';
import { useI18n } from './i18n.tsx';

export type CommunityGameId = 'supertux' | 'freecivWeb' | 'mindustry';
export const communityGameIds: readonly CommunityGameId[] = ['supertux', 'freecivWeb', 'mindustry'];
export function isCommunityGameId(id: string): id is CommunityGameId {
  return communityGameIds.some((value) => value === id);
}

interface MindustryNative {
  available(): Promise<{ available: boolean }>;
  launch(): Promise<void>;
}
const mindustry = registerPlugin<MindustryNative>('NaqlaMindustry');

type Availability = { kind: 'checking' } | { kind: 'unavailable' } | { kind: 'ready'; url?: string };
const supertuxFolder = `${(import.meta.env?.BASE_URL ?? '/')}third-party/supertux/`;
const mindustryFolder = `${(import.meta.env?.BASE_URL ?? '/')}third-party/mindustry/`;
const freecivWebUrl = import.meta.env?.VITE_FREECIV_WEB_URL as string | undefined;

function secureConfiguredUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || (import.meta.env?.DEV && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      return url.toString();
    }
  } catch { /* Invalid URLs are never launched. */ }
  return null;
}

export function CommunityGamesPage({ gameId, onExit }: { gameId: CommunityGameId; onExit: () => void }) {
  const { t } = useI18n();
  const [availability, setAvailability] = useState<Availability>({ kind: 'checking' });
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setAvailability({ kind: 'checking' });
    setStarted(false);
    setError(false);
    async function check() {
      let next: Availability = { kind: 'unavailable' };
      if (gameId === 'supertux') {
        try {
          // An explicit manifest avoids Vite/SPA catch-all 200s posing as a working game.
          const response = await fetch(`${supertuxFolder}naqla-runtime.json`, { cache: 'no-store' });
          if (response.ok) {
            const json: unknown = await response.json();
            if (json && typeof json === 'object' && 'id' in json && json.id === 'supertux' &&
              'entry' in json && json.entry === 'supertux2.html') {
              next = { kind: 'ready', url: `${supertuxFolder}supertux2.html` };
            }
          }
        } catch { /* Upstream Emscripten output has not been packaged. */ }
      } else if (gameId === 'freecivWeb') {
        const url = secureConfiguredUrl(freecivWebUrl);
        if (url) next = { kind: 'ready', url };
      } else if (gameId === 'mindustry') {
        try {
          // A separately compiled real TeaVM game, embedded as static NAQLA assets.
          const response = await fetch(`${mindustryFolder}naqla-runtime.json`, { cache: 'no-store' });
          if (response.ok) {
            const json: unknown = await response.json();
            if (json && typeof json === 'object' && 'id' in json && json.id === 'mindustry' &&
              'entry' in json && json.entry === 'index.html' &&
              'runtime' in json && json.runtime === 'teavm' &&
              'offline' in json && json.offline === true &&
              'requiresRemoteServer' in json && json.requiresRemoteServer === false) {
              next = { kind: 'ready', url: `${mindustryFolder}index.html` };
            }
          }
        } catch { /* Preview web runtime not bundled. */ }
        // Retain native-engine path for a future first-party native integration.
        if (next.kind === 'unavailable' && Capacitor.isNativePlatform() &&
          Capacitor.isPluginAvailable('NaqlaMindustry')) {
          try {
            if ((await mindustry.available()).available) next = { kind: 'ready' };
          } catch { /* Native runtime is not installed. */ }
        }
      }
      if (active) setAvailability(next);
    }
    void check();
    return () => { active = false; };
  }, [gameId]);

  useEffect(() => {
    if (!started) return;
    if (gameId === 'mindustry') {
      // Original Mindustry's menus need landscape width to remain fully usable.
      void enterGameLandscape(gameId);
      return () => { void leaveGameLandscape(); };
    }
    enterFullscreenOnlyGame(gameId);
    return () => { void leaveFullscreenOnlyGame(); };
  }, [started, gameId]);

  async function start() {
    if (availability.kind !== 'ready') return;
    setError(false);
    if (gameId === 'mindustry' && !availability.url) {
      try { await mindustry.launch(); } catch { setError(true); }
    } else {
      if (gameId === 'mindustry') requestGameFullscreen();
      setStarted(true);
    }
  }

  const instructions = gameId === 'supertux'
    ? 'communitySupertuxNeedsBuild'
    : gameId === 'freecivWeb'
      ? 'communityFreecivNeedsServer'
      : 'communityMindustryNeedsNative';

  return (
    <section className={`community-game community-game-${gameId} ${started ? 'community-game-playing' : ''}`} aria-label={t(gameId)}>
      <header className="community-game-header">
        <button type="button" onClick={onExit} className="community-game-back">{t('communityBack')}</button>
        <h1>{t(gameId)}</h1>
        <span className="community-game-source">{t('communityUpstream')}</span>
      </header>
      {!started ? (
        <div className="community-game-intro">
          <p>{t(`${gameId}Desc`)}</p>
          <p className="community-game-status" role="status">
            {availability.kind === 'checking' ? t('communityChecking') :
              availability.kind === 'ready' ? t('communityReady') : t('communityNotPackaged')}
          </p>
          {availability.kind === 'ready' ? (
            <button type="button" className="community-game-start" onClick={() => void start()}>{t('play')}</button>
          ) : availability.kind === 'unavailable' ? (
            <p className="community-game-help">{t(instructions)}</p>
          ) : null}
          {error && <p role="alert">{t('communityLaunchFailed')}</p>}
          <p className="community-game-note">{t('communityOriginalOnly')}</p>
        </div>
      ) : (
        <div className="community-game-stage">
          <button type="button" className="community-game-exit" onClick={onExit}>{t('communityBack')}</button>
          <iframe
            title={t(gameId)}
            className="community-game-frame"
            src={availability.kind === 'ready' ? availability.url : undefined}
            referrerPolicy="no-referrer"
            allow="fullscreen; gamepad"
            allowFullScreen
            onError={() => setError(true)}
          />
          {error && <p role="alert">{t('communityLaunchFailed')}</p>}
        </div>
      )}
    </section>
  );
}

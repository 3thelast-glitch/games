import { useCallback, useEffect, useRef, useState } from 'react';
import type { Difficulty, PlayerCount, Seat } from '../../../packages/core/src/game.ts';
import { OfflineMatch, type OfflineSnapshot } from '../../../packages/core/src/offline.ts';
import type {
  MatchCommand,
  MatchSnapshot,
  Profile,
  PublicPlayer,
  ServerMessage,
} from '../../../packages/core/src/protocol.ts';
import { games } from '../../../packages/games/registry.ts';
import { Avatar, Icon, Logo, Modal, NoticeContext } from './components.tsx';
import {
  HomePage,
  ProfilePage,
  LeaderboardPage,
  SettingsPage,
  ModeDialog,
  AuthDialog,
  WaitingDialog,
  type PlayMode,
  type LocalHistory,
} from './pages.tsx';
import { MatchPage } from './MatchPage.tsx';
import { I18n, useI18n } from './i18n.tsx';
import { api, connection, serverURL } from './network.ts';
import {
  defaults,
  feedback,
  isNative,
  listenAuth,
  openAuth,
  storage,
  type Settings,
} from './platform.ts';
type Page = 'library' | 'arena' | 'profile' | 'settings' | 'match';
interface OfflineSession {
  id: string;
  controller: OfflineMatch;
  difficulty: Difficulty;
}
interface SavedOffline {
  id: string;
  gameId: string;
  mode: 'local' | 'ai';
  difficulty: Difficulty;
  current: OfflineSnapshot;
  history: OfflineSnapshot[];
}
export default function App() {
  const [settings, setSettings] = useState<Settings>(defaults);
  useEffect(() => {
    void storage.get('settings', defaults).then(setSettings);
  }, []);
  useEffect(() => {
    document.documentElement.lang = settings.lang;
    document.documentElement.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.reduceMotion = String(settings.reduceMotion);
  }, [settings]);
  return (
    <I18n lang={settings.lang}>
      <ArenaApp
        settings={settings}
        changeSettings={(patch) =>
          setSettings((previous) => {
            const next = { ...previous, ...patch };
            void storage.set('settings', next);
            return next;
          })
        }
      />
    </I18n>
  );
}
function ArenaApp({
  settings,
  changeSettings,
}: {
  settings: Settings;
  changeSettings: (p: Partial<Settings>) => void;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState<Page>('library'),
    [profile, setProfile] = useState<Profile | null>(null),
    [token, setToken] = useState<string | null>(null),
    [notice, setNotice] = useState(''),
    [status, setStatus] = useState('offline'),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState<MatchSnapshot | null>(null),
    [offline, setOffline] = useState<OfflineSession | null>(null),
    [localHistory, setLocalHistory] = useState<LocalHistory[]>([]),
    [clock, setClock] = useState(Date.now()),
    [, render] = useState(0),
    [authOpen, setAuthOpen] = useState(false),
    [providers, setProviders] = useState({ google: false, apple: false }),
    [choice, setChoice] = useState<{ gameId: string; mode?: PlayMode } | null>(null),
    [rules, setRules] = useState<string | null>(null),
    [lobby, setLobby] = useState<Extract<ServerMessage, { type: 'room' | 'queued' }> | null>(null),
    [emote, setEmote] = useState<{ player: Seat; value: string } | null>(null);
  const tokenRef = useRef<string | null>(null),
    onlineRef = useRef<MatchSnapshot | null>(null),
    offlineRef = useRef<OfflineSession | null>(null),
    settingsRef = useRef(settings),
    ignored = useRef(new Set<string>()),
    finished = useRef(new Set<string>()),
    ensurePromise = useRef<Promise<string> | null>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    emoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    serverOffset = useRef(0);
  settingsRef.current = settings;
  const notify = useCallback((value: unknown) => {
    setNotice(value instanceof Error ? value.message : String(value));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotice(''), 6500);
  }, []);
  const acceptSession = useCallback(async (session: { token: string; profile: Profile }) => {
    tokenRef.current = session.token;
    setToken(session.token);
    setProfile(session.profile);
    await storage.set('token', session.token);
    await connection.start(session.token);
  }, []);
  const ensureToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current) {
      await connection.start(tokenRef.current);
      return tokenRef.current;
    }
    if (ensurePromise.current) return ensurePromise.current;
    ensurePromise.current = api<{ token: string; profile: Profile }>('/api/auth/guest', null, {
      name: 'Guest',
    })
      .then(async (session) => {
        await acceptSession(session);
        return session.token;
      })
      .finally(() => {
        ensurePromise.current = null;
      });
    return ensurePromise.current;
  }, [acceptSession]);
  const refreshProfile = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (currentToken) {
      const next = await api<Profile>('/api/profile', currentToken);
      if (tokenRef.current === currentToken) setProfile(next);
    }
  }, []);
  const saveOffline = useCallback((session: OfflineSession) => {
    void storage.set('offline-match', {
      id: session.id,
      gameId: session.controller.game.id,
      mode: session.controller.mode,
      difficulty: session.difficulty,
      current: session.controller.current,
      history: session.controller.history.slice(-200),
    } satisfies SavedOffline);
  }, []);
  const syncOffline = useCallback(() => {
    const session = offlineRef.current;
    if (!session) return;
    render((n) => n + 1);
    saveOffline(session);
    const { result, endedAt, createdAt, state } = session.controller.current;
    if (result && !finished.current.has(session.id)) {
      finished.current.add(session.id);
      const entry: LocalHistory = {
        id: session.id,
        gameId: state.gameId,
        mode: session.controller.mode,
        winner: result.winner,
        durationMs: (endedAt ?? Date.now()) - createdAt,
        endedAt: endedAt ?? Date.now(),
      };
      setLocalHistory((previous) => {
        const next = [entry, ...previous.filter((p) => p.id !== entry.id)].slice(0, 100);
        void storage.set('local-history', next);
        return next;
      });
      if (result.winner !== null && (session.controller.mode === 'local' || result.winner === 0))
        feedback(settingsRef.current, 'win');
    }
  }, [saveOffline]);
  const exchangeOAuth = useCallback(
    async (code: string) => {
      setBusy(true);
      try {
        const verifier = await storage.get<string | null>('oauth-verifier', null);
        if (!verifier) throw new Error('invalid-auth-code');
        const session = await api<{ token: string; profile: Profile }>('/api/auth/exchange', null, {
          code,
          verifier,
        });
        await storage.remove('oauth-verifier');
        await acceptSession(session);
        setAuthOpen(false);
        setPage('profile');
      } catch (e) {
        notify(e);
      } finally {
        setBusy(false);
      }
    },
    [acceptSession, notify],
  );
  useEffect(() => {
    const unsubscribe = connection.subscribe((message) => {
      if (message.type === 'match') {
        const match = message.match;
        if (ignored.current.has(match.id)) return;
        const previous = onlineRef.current;
        if (previous?.id === match.id && previous.revision > match.revision) return;
        serverOffset.current = match.serverNow - Date.now();
        onlineRef.current = match;
        setOnline(match);
        setBusy(connection.hasPending);
        setLobby(null);
        setChoice(null);
        if (previous?.id !== match.id) {
          offlineRef.current = null;
          setOffline(null);
          void storage.remove('offline-match');
          setPage('match');
          if (settingsRef.current.notifications) notify('matchReady');
        }
        if (previous?.id === match.id && previous.state.ply < match.state.ply)
          feedback(settingsRef.current);
        if (match.result && !finished.current.has(match.id)) {
          finished.current.add(match.id);
          const seat = match.players.findIndex((p) => p.id === profileRef.current?.id);
          if (match.result.winner === seat) feedback(settingsRef.current, 'win');
          void refreshProfile().catch(() => {});
        }
      } else if (message.type === 'room' || message.type === 'queued') {
        setLobby(message);
        setChoice(null);
        setBusy(false);
      } else if (message.type === 'error') {
        setBusy(false);
        notify(message.code);
        if (message.code === 'unauthorized') {
          tokenRef.current = null;
          setToken(null);
          void storage.remove('token');
        }
      } else if (message.type === 'emote') {
        if (settingsRef.current.sound && message.matchId === onlineRef.current?.id) {
          setEmote({ player: message.player, value: message.emote });
          if (emoteTimer.current) clearTimeout(emoteTimer.current);
          emoteTimer.current = setTimeout(() => setEmote(null), 3000);
        }
      }
    });
    const unsubscribeStatus = connection.status((next) => {
      setStatus(next);
      if (next === 'reconnecting') setLobby(null);
    });
    void storage.get<string | null>('token', null).then(async (saved) => {
      if (saved && !tokenRef.current) {
        tokenRef.current = saved;
        setToken(saved);
        await connection.start(saved);
        void refreshProfile().catch((e) => {
          if ((e as Error).message === 'unauthorized' && tokenRef.current === saved) {
            tokenRef.current = null;
            setToken(null);
            void storage.remove('token');
          } else notify(e);
        });
      }
    });
    void storage.get<LocalHistory[]>('local-history', []).then(setLocalHistory);
    void storage.get<SavedOffline | null>('offline-match', null).then((saved) => {
      if (saved && !saved.current.result) {
        try {
          const controller = new OfflineMatch(
            games.get(saved.gameId),
            saved.mode,
            Date.now,
            (saved.current.state.playerCount ?? 2) as PlayerCount,
          );
          controller.current = {
            ...saved.current,
            turnStartedAt: Date.now(),
          };
          controller.history = saved.history;
          const session = {
            id: saved.id,
            controller,
            difficulty: saved.difficulty,
          };
          offlineRef.current = session;
          setOffline(session);
        } catch {
          void storage.remove('offline-match');
        }
      }
    });
    void api<typeof providers>('/api/auth/providers')
      .then(setProviders)
      .catch(() => {});
    const code = new URLSearchParams(location.hash.slice(1)).get('auth');
    if (code) {
      history.replaceState(null, '', location.pathname + location.search);
      void exchangeOAuth(code);
    }
    let removeAuth: (() => void) | undefined;
    if (isNative)
      void listenAuth((code) => void exchangeOAuth(code)).then((remove) => {
        removeAuth = remove;
      });
    return () => {
      unsubscribe();
      unsubscribeStatus();
      removeAuth?.();
      connection.stop();
    };
  }, []);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(Date.now());
      const session = offlineRef.current;
      if (session && !session.controller.current.result) {
        session.controller.tick();
        if (session.controller.current.result) syncOffline();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [syncOffline]);
  useEffect(() => {
    if (lobby?.type === 'room' && clock > lobby.expiresAt) {
      setLobby(null);
      notify('room-not-found');
    }
  }, [clock, lobby, notify]);
  const localState = offline?.controller.current.state;
  useEffect(() => {
    if (
      !offline ||
      offline.controller.mode !== 'ai' ||
      offline.controller.current.result ||
      localState?.turn !== 1
    )
      return;
    const sessionId = offline.id,
      ply = localState.ply,
      requestId = crypto.randomUUID();
    const worker = new Worker(new URL('./ai.worker.ts', import.meta.url), {
      type: 'module',
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      notify('ai-error');
    }, 15000);
    worker.onmessage = (event) => {
      if (
        event.data.requestId !== requestId ||
        offlineRef.current?.id !== sessionId ||
        offlineRef.current.controller.current.state.ply !== ply
      )
        return;
      clearTimeout(timeout);
      if (event.data.error) notify(event.data.error);
      else if (event.data.move) {
        try {
          offlineRef.current.controller.move(event.data.move);
          feedback(settingsRef.current);
          syncOffline();
        } catch (e) {
          notify(e);
        }
      }
      worker.terminate();
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      notify('ai-error');
      worker.terminate();
    };
    worker.postMessage({
      state: localState,
      difficulty: offline.difficulty,
      requestId,
    });
    return () => {
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [offline?.id, localState?.ply, offline?.controller.current.result, notify, syncOffline]);
  const startOffline = (
    gameId: string,
    mode: 'local' | 'ai',
    difficulty: Difficulty,
    playerCount: PlayerCount = 2,
  ) => {
    const session = {
      id: crypto.randomUUID(),
      controller: new OfflineMatch(games.get(gameId), mode, Date.now, mode === 'ai' ? 2 : playerCount),
      difficulty,
    };
    offlineRef.current = session;
    setOffline(session);
    onlineRef.current = null;
    setOnline(null);
    connection.forgetMatch();
    setChoice(null);
    setPage('match');
    saveOffline(session);
  };
  const start = async (
    mode: PlayMode,
    difficulty: Difficulty,
    ranked: boolean,
    playerCount: PlayerCount,
    code?: string,
  ) => {
    if (!choice) return;
    try {
      if (onlineRef.current && !onlineRef.current.result) throw new Error('already-in-match');
      if (mode === 'local' || mode === 'ai') {
        startOffline(choice.gameId, mode, difficulty, playerCount);
        return;
      }
      setBusy(true);
      await ensureToken();
      await connection.waitReady();
      if (mode === 'private')
        connection.send(
          code
            ? { type: 'join-room', code }
            : { type: 'create-room', gameId: choice.gameId, playerCount },
        );
      else connection.send({ type: 'queue', gameId: choice.gameId, ranked, playerCount });
    } catch (e) {
      notify(e);
      setBusy(false);
    }
  };
  const updateProfile = async (data: unknown) => {
    try {
      const current = await ensureToken();
      setProfile(await api<Profile>('/api/profile', current, data, 'PATCH'));
      notify('saved');
    } catch (e) {
      notify(e);
    }
  };
  const submit = (
    type: 'move' | 'resign' | 'draw-offer' | 'draw-answer',
    extra: Record<string, unknown> = {},
  ) => {
    const m = onlineRef.current;
    if (!m) return;
    try {
      connection.submit({
        type,
        matchId: m.id,
        commandId: crypto.randomUUID(),
        expectedRevision: m.revision,
        ...extra,
      } as MatchCommand);
      setBusy(true);
    } catch (e) {
      notify(e);
    }
  };
  const makeMove = (move: unknown) => {
    if (onlineRef.current) {
      submit('move', { move });
      return;
    }
    const local = offlineRef.current;
    if (!local) return;
    try {
      if (local.controller.mode === 'ai' && local.controller.current.state.turn !== 0) return;
      local.controller.move(move);
      feedback(settings);
      syncOffline();
    } catch (e) {
      notify(e);
    }
  };
  const goHome = () => {
    if (onlineRef.current?.result) {
      ignored.current.add(onlineRef.current.id);
      connection.forgetMatch();
      onlineRef.current = null;
      setOnline(null);
    }
    if (offlineRef.current?.controller.current.result) {
      offlineRef.current = null;
      setOffline(null);
      void storage.remove('offline-match');
    }
    setPage('library');
  };
  const oauth = async (provider: 'google' | 'apple') => {
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const encode = (input: Uint8Array) =>
        btoa(String.fromCharCode(...input))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      const verifier = encode(bytes),
        hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      await storage.set('oauth-verifier', verifier);
      await openAuth(
        `${serverURL}/api/auth/oauth/${provider}/start?challenge=${encode(new Uint8Array(hash))}&native=${isNative ? '1' : '0'}`,
      );
    } catch (e) {
      notify(e);
    }
  };
  const signIn = async (create: boolean, name: string, email: string, password: string) => {
    setBusy(true);
    try {
      const session = await api<{ token: string; profile: Profile }>(
        `/api/auth/${create ? 'register' : 'login'}`,
        tokenRef.current,
        create ? { name, email, password } : { email, password },
      );
      await acceptSession(session);
      setAuthOpen(false);
      notify('saved');
    } catch (e) {
      notify(e);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    try {
      if (tokenRef.current) await api('/api/auth/logout', tokenRef.current, {});
    } catch (e) {
      notify(e);
    } finally {
      connection.stop();
      tokenRef.current = null;
      setToken(null);
      setProfile(null);
      setOnline(null);
      onlineRef.current = null;
      await storage.remove('token');
    }
  };
  const isOnline = !!online;
  const current = online?.state ?? offline?.controller.current.state;
  const self = (online ? online.players.findIndex((p) => p.id === profile?.id) : 0) as Seat;
  const localPlayerCount = (offline?.controller.current.state.playerCount ?? 2) as PlayerCount;
  const localPlayers: PublicPlayer[] = Array.from({ length: localPlayerCount }, (_, index) => ({
    id: `local-${index}`,
    name:
      index === 0
        ? profile?.name ?? t('player1')
        : offline?.controller.mode === 'ai' && index === 1
          ? `${t('aiName')} · ${t(offline.difficulty)}`
          : t(`player${index + 1}`),
    avatar: index === 0 ? profile?.avatar ?? 'orbit' : ['comet', 'hex', 'crown'][index - 1] ?? 'moon',
    rating: 1000,
    rank: 'Silver',
  }));
  const navigation: { id: Page; icon: string; label: string }[] = [
    { id: 'library', icon: 'library', label: 'library' },
    { id: 'arena', icon: 'trophy', label: 'arena' },
    { id: 'profile', icon: 'user', label: 'profile' },
    { id: 'settings', icon: 'settings', label: 'settings' },
  ];
  const local = online ? undefined : offline?.controller.current;
  const matchNow = online ? clock + serverOffset.current : clock;
  return (
    <NoticeContext.Provider value={notice}>
      <div className={`app-shell ${page === 'match' ? 'in-match' : ''}`}>
        <aside className="sidebar">
          <button className="brand-button" onClick={() => setPage('library')}>
            <Logo />
          </button>
          <span className="nav-label">{t('navMotto')}</span>
          <nav>
            {navigation.map((item) => (
              <button
                key={item.id}
                className={page === item.id ? 'active' : ''}
                onClick={() => setPage(item.id)}
              >
                <Icon name={item.icon} />
                <span>{t(item.label)}</span>
                {page === item.id && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-promo">
              <span className="promo-mark">✧</span>
              <strong>{t('playYourWay')}</strong>
              <p>{t('noAccount')}</p>
            </div>
            <button className="sidebar-account" onClick={() => setPage('profile')}>
              <Avatar name={profile?.name} avatar={profile?.avatar} />
              <span>
                <strong>{profile?.name ?? t('guest')}</strong>
                <small>
                  {t('level')} {profile?.level ?? 1}
                </small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <button className="mobile-brand brand-button" onClick={() => setPage('library')}>
              <Logo />
            </button>
            <span className="topbar-title">
              {t(page === 'match' ? 'arena' : page === 'arena' ? 'leaderboards' : page)}
            </span>
            <div className="topbar-actions">
              <span className={`connection-status ${status === 'connected' ? 'live' : ''}`}>
                <span />
                {t(status)}
              </span>
              <button
                className="language-button"
                onClick={() => changeSettings({ lang: settings.lang === 'en' ? 'ar' : 'en' })}
                aria-label={t('language')}
              >
                <Icon name="globe" size={17} />
                {settings.lang === 'en' ? 'العربية' : 'EN'}
              </button>
              <button
                className="icon-button desktop-sound"
                onClick={() => changeSettings({ sound: !settings.sound })}
                aria-label={t(settings.sound ? 'mute' : 'unmute')}
              >
                <Icon name={settings.sound ? 'volume' : 'mute'} />
              </button>
              <button
                className="topbar-avatar"
                onClick={() => (profile && !profile.guest ? setPage('profile') : setAuthOpen(true))}
                aria-label={t('profile')}
              >
                <Avatar avatar={profile?.avatar} name={profile?.name} />
              </button>
            </div>
          </header>
          <main className={`main-content ${page === 'match' ? 'match-content' : ''}`}>
            {page === 'library' && (
              <HomePage
                onChoose={(gameId, mode) => setChoice({ gameId, mode })}
                onRules={setRules}
                profile={profile}
                onFavorite={(id) =>
                  void updateProfile({
                    favorites: profile?.favorites.includes(id)
                      ? profile.favorites.filter((x) => x !== id)
                      : [...(profile?.favorites ?? []), id],
                  })
                }
                hasMatch={
                  !!((online && !online.result) || (offline && !offline.controller.current.result))
                }
                onResume={() => setPage('match')}
              />
            )}
            {page === 'profile' && (
              <ProfilePage
                profile={profile}
                localHistory={localHistory}
                onSave={(data) => void updateProfile(data)}
                onSignIn={() => setAuthOpen(true)}
                onAddFriend={(code) => {
                  void ensureToken()
                    .then((token) => api<Profile>('/api/friends', token, { code }))
                    .then(setProfile)
                    .catch(notify);
                }}
                onRemoveFriend={(id) => {
                  void ensureToken()
                    .then((token) => api<Profile>(`/api/friends/${id}`, token, undefined, 'DELETE'))
                    .then(setProfile)
                    .catch(notify);
                }}
              />
            )}
            {page === 'arena' && <LeaderboardPage ensureToken={ensureToken} onError={notify} />}
            {page === 'settings' && (
              <SettingsPage
                settings={settings}
                onChange={changeSettings}
                profile={profile}
                onAuth={() => setAuthOpen(true)}
                onLogout={() => void logout()}
              />
            )}
            {page === 'match' && current && (online || local) && (
              <MatchPage
                id={online?.id ?? offline!.id}
                state={current}
                mode={online ? 'online' : offline!.controller.mode}
                ranked={online?.ranked ?? false}
                players={online?.players ?? localPlayers}
                self={self >= 0 ? self : 0}
                clocks={online?.clockMs ?? local!.clocks}
                turnStartedAt={online?.turnStartedAt ?? local!.turnStartedAt}
                now={matchNow}
                createdAt={online?.createdAt ?? local!.createdAt}
                endedAt={online?.endedAt ?? local?.endedAt ?? null}
                result={online?.result ?? local?.result ?? null}
                disabled={
                  !!(online?.result ?? local?.result) ||
                  (isOnline
                    ? status !== 'connected' || self !== current.turn || busy
                    : offline?.controller.mode === 'ai' && current.turn === 1)
                }
                pending={isOnline && busy}
                canUndo={!isOnline && !!offline?.controller.history.length}
                sound={settings.sound}
                connectionStatus={status}
                disconnected={
                  !!online && online.disconnectedAt.some((at, index) => index !== self && at !== null)
                }
                graceSeconds={
                  online
                    ? Math.max(
                        0,
                        Math.ceil(
                          Math.min(
                            ...online.disconnectedAt
                              .map((at, index) => (index === self || at === null ? Infinity : online.graceMs - (matchNow - at)))
                              .filter(Number.isFinite),
                            online.graceMs,
                          ) / 1000,
                        ),
                      )
                    : 0
                }
                drawOffer={online?.drawOffer ?? null}
                drawAccepts={online?.drawAccepts ?? []}
                rematchWaiting={!!online?.rematchVotes.includes(self)}
                emote={emote}
                onMove={makeMove}
                onUndo={() => {
                  try {
                    offline!.controller.undo();
                    finished.current.delete(offline!.id);
                    setLocalHistory((previous) => {
                      const next = previous.filter((h) => h.id !== offline!.id);
                      void storage.set('local-history', next);
                      return next;
                    });
                    syncOffline();
                  } catch (e) {
                    notify(e);
                  }
                }}
                onRestart={() =>
                  startOffline(
                    offline!.controller.game.id,
                    offline!.controller.mode,
                    offline!.difficulty,
                    (offline!.controller.current.state.playerCount ?? 2) as PlayerCount,
                  )
                }
                onResign={() => {
                  if (online) submit('resign');
                  else {
                    offline!.controller.finish(
                      offline!.controller.mode === 'ai'
                        ? 1
                        : (((current.turn + 1) % (current.playerCount ?? 2)) as Seat),
                      'resignation',
                    );
                    syncOffline();
                  }
                }}
                onDraw={() => {
                  if (online) submit('draw-offer');
                  else {
                    offline!.controller.finish(null, 'agreement');
                    syncOffline();
                  }
                }}
                onDrawAnswer={(accept) => submit('draw-answer', { accept })}
                onRematch={() => {
                  if (online) {
                    try {
                      connection.send({ type: 'rematch', matchId: online.id });
                    } catch (e) {
                      notify(e);
                    }
                  } else
                    startOffline(
                      offline!.controller.game.id,
                      offline!.controller.mode,
                      offline!.difficulty,
                      (offline!.controller.current.state.playerCount ?? 2) as PlayerCount,
                    );
                }}
                onHome={goHome}
                onSound={() => changeSettings({ sound: !settings.sound })}
                onEmote={(value) => {
                  if (online) {
                    try {
                      connection.send({
                        type: 'emote',
                        matchId: online.id,
                        emote: value as '👋',
                      });
                    } catch (e) {
                      notify(e);
                    }
                  } else {
                    setEmote({ player: current.turn, value });
                    setTimeout(() => setEmote(null), 3000);
                  }
                }}
              />
            )}
          </main>
        </div>
        <nav className="mobile-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? 'active' : ''}
              onClick={() => setPage(item.id)}
            >
              <Icon name={item.icon} />
              <span>{t(item.label)}</span>
            </button>
          ))}
        </nav>
        {notice && (
          <div className="toast" role="status">
            <Icon name="info" size={18} />
            <span>{t(notice)}</span>
            <button aria-label={t('close')} onClick={() => setNotice('')}>
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {choice && (
          <ModeDialog
            {...choice}
            initialMode={choice.mode}
            guest={!profile || profile.guest}
            busy={busy}
            onClose={() => setChoice(null)}
            onStart={(...args) => void start(...args)}
            onSignIn={() => {
              setChoice(null);
              setAuthOpen(true);
            }}
          />
        )}
        {lobby && (
          <WaitingDialog
            room={lobby}
            onCancel={() => {
              try {
                connection.send({ type: 'cancel' });
              } catch {}
              setLobby(null);
              setBusy(false);
            }}
            onCopy={(code) => {
              void navigator.clipboard
                .writeText(code)
                .then(() => notify('copied'))
                .catch(() => notify(code));
            }}
          />
        )}
        {authOpen && (
          <AuthDialog
            onClose={() => setAuthOpen(false)}
            onSubmit={(...args) => void signIn(...args)}
            onOAuth={(p) => void oauth(p)}
            onGuest={() => {
              setBusy(true);
              void ensureToken()
                .then(() => setAuthOpen(false))
                .catch(notify)
                .finally(() => setBusy(false));
            }}
            providers={providers}
            busy={busy}
          />
        )}
        {rules && (
          <Modal title={`${t('rules')} · ${t(rules)}`} onClose={() => setRules(null)}>
            <p className="rules-text">{t(`${rules}Rules`)}</p>
          </Modal>
        )}
      </div>
    </NoticeContext.Provider>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import type { Profile, PublicPlayer } from '../../../packages/core/src/protocol.ts';
import type { Difficulty } from '../../../packages/core/src/game.ts';
import { RANKS } from '../../../packages/core/src/ranking.ts';
import { Avatar, avatars, Empty, GameArt, Icon, Modal, formatTime } from './components.tsx';
import { gameInfo, upcoming } from './gameViews.tsx';
import { useI18n } from './i18n.tsx';
import type { Settings } from './platform.ts';
import { api } from './network.ts';
export type PlayMode = 'local' | 'ai' | 'online' | 'private';
export interface LocalHistory {
  id: string;
  gameId: string;
  mode: 'local' | 'ai';
  winner: 0 | 1 | null;
  durationMs: number;
  endedAt: number;
}
export function HomePage({
  onChoose,
  onRules,
  profile,
  onFavorite,
  onResume,
  hasMatch,
}: {
  onChoose: (id: string, mode?: PlayMode) => void;
  onRules: (id: string) => void;
  profile: Profile | null;
  onFavorite: (id: string) => void;
  onResume: () => void;
  hasMatch: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="home-page page-enter">
      <section className="home-heading">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />
            {t('welcome')}
          </div>
          <h1>{t('headline')}</h1>
          <p>{t('subhead')}</p>
        </div>
        <div className="heading-mark" aria-hidden="true">
<<<<<<< HEAD
          ✦<span>01 — 02</span>
=======
          ✦<span>01 — {String(gameInfo.length).padStart(2, '0')}</span>
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
        </div>
      </section>
      {hasMatch && (
        <button className="resume-banner" onClick={onResume}>
          <span className="live-dot" />
          {t('resumeMatch')}
          <Icon name="arrow" />
        </button>
      )}
      <div className="section-heading">
        <h2>
<<<<<<< HEAD
          {t('library')} <span className="count">02</span>
=======
          {t('library')} <span className="count">{String(gameInfo.length).padStart(2, '0')}</span>
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
        </h2>
        <span className="small-muted">{t('strategy')}</span>
      </div>
      <section className="game-grid">
<<<<<<< HEAD
        {gameInfo.map((game) => (
=======
        {gameInfo.map((game, index) => (
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
          <article className={`game-card ${game.id}`} key={game.id}>
            <div className="card-art-wrap">
              <GameArt game={game.id} />
              <span className="availability">
                <span />
                {t('available')}
              </span>
              <button
                className={`favorite-button ${profile?.favorites.includes(game.id) ? 'is-favorite' : ''}`}
                aria-label={`${t('favorites')}: ${t(game.id)}`}
                aria-pressed={profile?.favorites.includes(game.id) ?? false}
                onClick={() => onFavorite(game.id)}
              >
                <Icon name="heart" size={18} />
              </button>
<<<<<<< HEAD
              <span className="art-number">{game.id === 'abalone' ? '01' : '02'}</span>
=======
              <span className="art-number">{String(index + 1).padStart(2, '0')}</span>
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
            </div>
            <div className="game-card-body">
              <div className="game-tag">{t(game.tag)}</div>
              <div className="game-title">
                <h2>{t(game.id)}</h2>
                <button
                  className="icon-button"
                  aria-label={`${t('rules')}: ${t(game.id)}`}
                  onClick={() => onRules(game.id)}
                >
                  <Icon name="info" size={18} />
                </button>
              </div>
              <p>{t(game.description)}</p>
              <div className="game-meta">
                <span>
                  <Icon name="people" size={16} />
                  {t('players')}
                </span>
                <span>
                  <Icon name="clock" size={16} />
                  {game.duration} {t('minutes')}
                </span>
              </div>
              <button className="button play-button" onClick={() => onChoose(game.id)}>
                {t('play')}
                <Icon name="arrow" size={19} />
              </button>
            </div>
          </article>
        ))}
      </section>
      <section className="play-way">
        <div className="section-heading">
          <h2>{t('playYourWay')}</h2>
          <span className="small-muted">{t('noAccount')}</span>
        </div>
        <div className="way-grid">
          <button className="way-card" onClick={() => onChoose('abalone', 'local')}>
            <span className="way-icon">
              <Icon name="people" size={25} />
            </span>
            <span>
              <strong>{t('onePhone')}</strong>
              <small>{t('onePhoneDesc')}</small>
            </span>
            <Icon name="arrow" />
          </button>
          <button className="way-card" onClick={() => onChoose('quoridor', 'ai')}>
            <span className="way-icon mint">
              <Icon name="ai" size={25} />
            </span>
            <span>
              <strong>{t('practice')}</strong>
              <small>{t('practiceDesc')}</small>
            </span>
            <Icon name="arrow" />
          </button>
        </div>
      </section>
      <section className="coming-section">
        <div className="section-heading">
          <div>
            <h2>{t('upNext')}</h2>
            <p>{t('upNextDesc')}</p>
          </div>
          <span className="outline-pill">{t('comingSoon')}</span>
        </div>
        <div className="upcoming-grid">
          {upcoming.map((game, i) => (
            <div className="upcoming-game" key={game}>
<<<<<<< HEAD
              <span aria-hidden="true">{['♞', '◉', '⠿', '◐', '⌘', '✣', '◡'][i]}</span>
=======
              <span aria-hidden="true">{['♞', '◐', '◡'][i]}</span>
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
              <strong>{t(game)}</strong>
              <small>{t('comingSoon')}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
export function ModeDialog({
  gameId,
  initialMode,
  onClose,
  onStart,
  guest,
  onSignIn,
  busy,
}: {
  gameId: string;
  initialMode?: PlayMode;
  onClose: () => void;
  onStart: (mode: PlayMode, difficulty: Difficulty, ranked: boolean, code?: string) => void;
  guest: boolean;
  onSignIn: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<PlayMode>(initialMode ?? 'local'),
    [difficulty, setDifficulty] = useState<Difficulty>('medium'),
    [ranked, setRanked] = useState(false),
    [code, setCode] = useState('');
  return (
    <Modal title={t('chooseMode')} onClose={onClose}>
      <div className="mode-game">
        <GameArt game={gameId} compact />
        <div>
          <span className="eyebrow">BOARD ARENA</span>
          <h3>{t(gameId)}</h3>
          <p>{t('chooseModeDesc')}</p>
        </div>
      </div>
      <div className="mode-grid">
        {(['local', 'ai', 'online', 'private'] as PlayMode[]).map((item, i) => (
          <button
            key={item}
            className={`mode-card ${mode === item ? 'selected' : ''}`}
            onClick={() => setMode(item)}
            aria-pressed={mode === item}
          >
            <Icon name={['people', 'ai', 'globe', 'lock'][i]} />
            <strong>{t(item)}</strong>
            <small>{t(`${item}Desc`)}</small>
            {mode === item && (
              <span className="mode-check">
                <Icon name="check" size={14} />
              </span>
            )}
          </button>
        ))}
      </div>
      {mode === 'ai' && (
        <fieldset>
          <legend>{t('difficulty')}</legend>
          <div className="segmented">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button key={d} aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                {t(d)}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {mode === 'online' && (
        <>
          <div className="segmented">
            <button aria-pressed={!ranked} onClick={() => setRanked(false)}>
              {t('casual')}
            </button>
            <button aria-pressed={ranked} onClick={() => setRanked(true)}>
              {t('ranked')} <Icon name="trophy" size={16} />
            </button>
          </div>
          {ranked && guest && (
            <p className="inline-notice">
              {t('rankedSignIn')}{' '}
              <button className="text-button" onClick={onSignIn}>
                {t('signIn')}
              </button>
            </p>
          )}
        </>
      )}
      {mode === 'private' ? (
        <div className="private-actions">
          <button
            className="button primary"
            disabled={busy}
            onClick={() => onStart(mode, difficulty, false)}
          >
            <Icon name="lock" />
            {t('createRoom')}
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onStart(mode, difficulty, false, code);
            }}
          >
            <label>
              {t('roomCode')}
              <input
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z2-9]/g, '')
                      .slice(0, 6),
                  )
                }
                minLength={6}
                maxLength={6}
                required
                placeholder="ABC234"
                autoCapitalize="characters"
                dir="ltr"
              />
            </label>
            <button className="button secondary" disabled={code.length !== 6 || busy}>
              {t('joinRoom')}
            </button>
          </form>
        </div>
      ) : (
        <button
          className="button primary full"
          disabled={busy || (ranked && guest && mode === 'online')}
          onClick={() => onStart(mode, difficulty, ranked)}
        >
          {t(mode === 'online' ? 'quickMatch' : 'start')}
          <Icon name="arrow" />
        </button>
      )}
    </Modal>
  );
}
export function WaitingDialog({
  room,
  onCancel,
  onCopy,
}: {
  room:
    | { type: 'room'; code: string; gameId: string; expiresAt: number }
    | { type: 'queued'; gameId: string; ranked: boolean };
  onCancel: () => void;
  onCopy: (text: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Modal title={t(room.type === 'room' ? 'private' : 'quickMatch')} onClose={onCancel}>
      <div className="waiting-content">
        <div className="search-orbit">
          <Icon name={room.type === 'room' ? 'lock' : 'globe'} size={35} />
        </div>
        <span className="eyebrow">{t(room.gameId)}</span>
        <h3>{t(room.type === 'room' ? 'waitingFriend' : 'searching')}</h3>
        <p>{t(room.type === 'room' ? 'shareCode' : 'searchHint')}</p>
        {room.type === 'room' && (
          <>
            <div className="room-code" dir="ltr">
              {room.code}
            </div>
            <button className="button secondary" onClick={() => onCopy(room.code)}>
              <Icon name="copy" />
              {t('copy')}
            </button>
            <small>{t('roomExpires')}</small>
          </>
        )}
      </div>
      <button className="button ghost full" onClick={onCancel}>
        {t('cancel')}
      </button>
    </Modal>
  );
}
export function AuthDialog({
  onClose,
  onSubmit,
  onOAuth,
  onGuest,
  providers,
  busy,
}: {
  onClose: () => void;
  onSubmit: (create: boolean, name: string, email: string, password: string) => void;
  onOAuth: (provider: 'google' | 'apple') => void;
  onGuest: () => void;
  providers: { google: boolean; apple: boolean };
  busy: boolean;
}) {
  const { t } = useI18n();
  const [create, setCreate] = useState(false),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  return (
    <Modal title={t('accountTitle')} onClose={onClose}>
      <p className="modal-description">{t('accountDesc')}</p>
      <div className="provider-buttons">
        {(['google', 'apple'] as const).map((p) => (
          <button
            className="button secondary"
            key={p}
            disabled={!providers[p] || busy}
            onClick={() => onOAuth(p)}
          >
            <span className="provider-letter">{p === 'google' ? 'G' : '●'}</span>
            {t(p)}
            {!providers[p] && <small>{t('notConfigured')}</small>}
          </button>
        ))}
      </div>
      <div className="divider-label">{t('email')}</div>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(create, name, email, password);
        }}
      >
        {create && (
          <label>
            {t('name')}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={24}
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          {t('email')}
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          {t('password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={create ? 12 : 1}
            maxLength={128}
            required
            autoComplete={create ? 'new-password' : 'current-password'}
            placeholder={create ? t('passwordHint') : ''}
          />
        </label>
        <button className="button primary" disabled={busy}>
          {t(create ? 'createAccount' : 'signIn')}
        </button>
      </form>
      <button className="text-button auth-switch" onClick={() => setCreate(!create)}>
        {t(create ? 'haveAccount' : 'needAccount')}
      </button>
      <button className="button ghost full" onClick={onGuest} disabled={busy}>
        {t('continueGuest')}
      </button>
      <button className="text-button auth-switch" onClick={onClose}>
        {t('continueOffline')}
      </button>
    </Modal>
  );
}
export function ProfilePage({
  profile,
  localHistory,
  onSave,
  onSignIn,
  onAddFriend,
  onRemoveFriend,
}: {
  profile: Profile | null;
  localHistory: LocalHistory[];
  onSave: (data: unknown) => void;
  onSignIn: () => void;
  onAddFriend: (code: string) => void;
  onRemoveFriend: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(profile?.name ?? ''),
    [avatar, setAvatar] = useState(profile?.avatar ?? 'orbit'),
    [friend, setFriend] = useState('');
  useEffect(() => {
    setName(profile?.name ?? '');
    setAvatar(profile?.avatar ?? 'orbit');
  }, [profile?.name, profile?.avatar]);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <span className="eyebrow">{t('profileEyebrow')}</span>
        <h1>{t('profile')}</h1>
      </div>
      <section className="profile-hero panel">
        <Avatar name={profile?.name ?? t('guest')} avatar={profile?.avatar} large />
        <div>
          <span className="eyebrow">
            {t('level')} {profile?.level ?? 1}
          </span>
          <h2>{profile?.name ?? t('guest')}</h2>
          <p>{profile?.guest || !profile ? t('guestNote') : t('accountDesc')}</p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            if (!profile || profile.guest) onSignIn();
            else setEditing(true);
          }}
        >
          {!profile || profile.guest ? t('signIn') : t('editProfile')}
        </button>
      </section>
      <div className="section-heading">
        <h2>{t('onlineStats')}</h2>
      </div>
      <div className="stats-grid">
        {[
          ['matches', profile?.totalMatches ?? 0],
          ['wins', profile?.wins ?? 0],
          ['losses', profile?.losses ?? 0],
          ['winRate', `${profile?.winRate ?? 0}%`],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <strong>{value}</strong>
            <span>{t(String(label))}</span>
          </div>
        ))}
      </div>
      <div className="profile-columns">
        <section className="panel">
          <h2>{t('ranking')}</h2>
          {gameInfo.map((g) => (
            <div className="rating-row" key={g.id}>
              <span className={`game-glyph ${g.id}`}>{g.icon}</span>
              <div>
                <strong>{t(g.id)}</strong>
                <small>{t(profile?.ratings[g.id]?.rank ?? 'Silver')}</small>
              </div>
              <strong className="rating-number">
                {profile?.ratings[g.id]?.rating ?? 1000}
                <small>
                  {profile?.ratings[g.id]?.position ? `#${profile.ratings[g.id].position}` : '—'}
                </small>
              </strong>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>{t('favorites')}</h2>
          {gameInfo.map((g) => (
            <label className="favorite-row" key={g.id}>
              <span>{t(g.id)}</span>
              <input
                type="checkbox"
                checked={profile?.favorites.includes(g.id) ?? false}
                onChange={() =>
                  onSave({
                    favorites: profile?.favorites.includes(g.id)
                      ? profile.favorites.filter((x) => x !== g.id)
                      : [...(profile?.favorites ?? []), g.id],
                  })
                }
              />
            </label>
          ))}
        </section>
      </div>
      <section className="panel history-panel">
        <h2>{t('recent')}</h2>
        {profile?.history.length ? (
          <div className="history-list">
            {profile.history.map((h) => (
              <div className="history-row" key={h.matchId}>
                <span className={`result-dot ${h.result}`} />
                <div>
                  <strong>{t(h.gameId)}</strong>
                  <small>
                    {h.opponent} · {new Date(h.endedAt).toLocaleDateString(lang)}
                  </small>
                </div>
                <span>
                  {t(
                    h.result === 'win' ? 'victory' : h.result === 'loss' ? 'defeat' : 'drawResult',
                  )}
                </span>
                <strong className={h.ratingDelta >= 0 ? 'mint-text' : 'error-text'}>
                  {h.ranked ? `${h.ratingDelta > 0 ? '+' : ''}${h.ratingDelta}` : '—'}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon="clock">{t('noMatches')}</Empty>
        )}
      </section>
      {localHistory.length > 0 && (
        <section className="panel history-panel">
          <h2>{t('localHistory')}</h2>
          {localHistory.slice(0, 10).map((h) => (
            <div className="history-row" key={h.id}>
              <Icon name={h.mode === 'local' ? 'people' : 'ai'} />
              <div>
                <strong>{t(h.gameId)}</strong>
                <small>{t(h.mode)}</small>
              </div>
              <span>
                {h.winner === null ? t('drawResult') : t(h.winner === 0 ? 'player1' : 'player2')}
              </span>
              <strong>{formatTime(h.durationMs)}</strong>
            </div>
          ))}
        </section>
      )}
      <section className="panel friends-panel">
        <div className="section-heading">
          <h2>{t('friends')}</h2>
          {profile && (
            <small>
              {t('friendCode')}: <b dir="ltr">{profile.friendCode}</b>
            </small>
          )}
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            onAddFriend(friend);
            setFriend('');
          }}
        >
          <label>
            {t('followFriend')}
            <input
              value={friend}
              onChange={(e) =>
                setFriend(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-F0-9]/g, '')
                    .slice(0, 12),
                )
              }
              required
              minLength={12}
              maxLength={12}
              dir="ltr"
              placeholder="A1B2C3D4E5F6"
            />
          </label>
          <button className="button secondary" disabled={friend.length !== 12}>
            {t('addFriend')}
          </button>
        </form>
        {profile?.friends.length ? (
          profile.friends.map((p) => (
            <div className="friend-row" key={p.id}>
              <Avatar name={p.name} avatar={p.avatar} />
              <strong>{p.name}</strong>
              <button className="text-button" onClick={() => onRemoveFriend(p.id)}>
                {t('remove')}
              </button>
            </div>
          ))
        ) : (
          <p className="small-muted">{t('noFriends')}</p>
        )}
      </section>
      {editing && (
        <Modal title={t('profile')} onClose={() => setEditing(false)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              onSave({ name, avatar });
              setEditing(false);
            }}
          >
            <label>
              {t('name')}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={24}
              />
            </label>
            <fieldset>
              <legend>{t('avatar')}</legend>
              <div className="avatar-picker">
                {Object.keys(avatars).map((a) => (
                  <button
                    type="button"
                    aria-pressed={a === avatar}
                    aria-label={a}
                    key={a}
                    onClick={() => setAvatar(a)}
                  >
                    <Avatar avatar={a} />
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="button primary">{t('save')}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function LeaderboardPage({
  ensureToken,
  onError,
}: {
  ensureToken: () => Promise<string>;
  onError: (e: unknown) => void;
}) {
  const { t } = useI18n();
  const [game, setGame] = useState('abalone'),
    [period, setPeriod] = useState('global'),
    [entries, setEntries] = useState<
      (PublicPlayer & { position: number; score: number; played: number })[]
    >([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void ensureToken()
      .then((token) =>
        api<{ entries: typeof entries }>(`/api/leaderboard?gameId=${game}&period=${period}`, token),
      )
      .then((result) => {
        if (active) setEntries(result.entries);
      })
      .catch((error) => {
        if (active) {
          setEntries([]);
          onError(error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [game, period]);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <span className="eyebrow">{t('rankingsEyebrow')}</span>
        <h1>{t('leaderboards')}</h1>
        <p>{t('leaderboardDesc')}</p>
      </div>
      <div className="leaderboard-controls">
        <div className="segmented">
          {gameInfo.map((g) => (
            <button key={g.id} onClick={() => setGame(g.id)} aria-pressed={game === g.id}>
              {t(g.id)}
            </button>
          ))}
        </div>
        <div className="period-tabs">
          {['global', 'weekly', 'monthly', 'friends'].map((p) => (
            <button aria-pressed={p === period} key={p} onClick={() => setPeriod(p)}>
              {t(p === 'friends' ? 'friendsBoard' : p)}
            </button>
          ))}
        </div>
      </div>
      <section className="panel leaderboard-panel">
        {loading ? (
          <div className="loading-state">
            <span className="spinner" />
            {t('connecting')}
          </div>
        ) : entries.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('name')}</th>
                  <th>{t('ranking')}</th>
                  <th>{t(period === 'weekly' || period === 'monthly' ? 'gain' : 'rating')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((player) => (
                  <tr key={player.id}>
                    <td>{String(player.position).padStart(2, '0')}</td>
                    <td>
                      <span className="table-player">
                        <Avatar name={player.name} avatar={player.avatar} />
                        {player.name}
                      </span>
                    </td>
                    <td>
                      <span className={`rank-badge ${player.rank.toLowerCase()}`}>
                        {t(player.rank)}
                      </span>
                    </td>
                    <td>
                      {player.score > 0 && (period === 'weekly' || period === 'monthly') ? '+' : ''}
                      {player.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="trophy">{t('emptyBoard')}</Empty>
        )}
      </section>
      <p className="small-muted">{t('weeklyNote')}</p>
      <section className="rank-ladder">
        <h2>{t('rankLadder')}</h2>
        <div>
          {RANKS.map((rank, i) => (
            <article key={rank}>
              <span className={`rank-emblem rank-${i}`}>
                <Icon name="trophy" size={25} />
              </span>
              <strong>{t(rank)}</strong>
              <small>
                {['< 1000', '1000–1199', '1200–1399', '1400–1599', '1600–1799', '1800+'][i]}
              </small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
export function SettingsPage({
  settings,
  onChange,
  profile,
  onAuth,
  onLogout,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  profile: Profile | null;
  onAuth: () => void;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="page-enter settings-page">
      <div className="page-heading">
        <span className="eyebrow">{t('settingsEyebrow')}</span>
        <h1>{t('preferences')}</h1>
        <p>{t('preferencesDesc')}</p>
      </div>
      <section className="panel">
        <h2>{t('settings')}</h2>
        <div className="setting-row">
          <div>
            <strong>{t('language')}</strong>
          </div>
          <div className="segmented">
            <button aria-pressed={settings.lang === 'en'} onClick={() => onChange({ lang: 'en' })}>
              English
            </button>
            <button aria-pressed={settings.lang === 'ar'} onClick={() => onChange({ lang: 'ar' })}>
              العربية
            </button>
          </div>
        </div>
        {(['sound', 'haptics', 'reduceMotion', 'notifications'] as const).map((key) => (
          <label className="setting-row" key={key}>
            <div>
              <strong>{t(key)}</strong>
              {key === 'notifications' && <small>{t('notificationHint')}</small>}
            </div>
            <input
              role="switch"
              className="switch"
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => onChange({ [key]: e.target.checked })}
            />
          </label>
        ))}
      </section>
      <section className="panel">
        <h2>{t('account')}</h2>
        <div className="setting-row">
          <div className="account-setting">
            <Avatar name={profile?.name} />
            <div>
              <strong>{profile?.name ?? t('guest')}</strong>
              <small>
                {profile?.guest ? t('guest') : profile?.id ? t('connected') : t('offline')}
              </small>
            </div>
          </div>
          <button
            className="button secondary"
            onClick={profile && !profile.guest ? onLogout : onAuth}
          >
            {t(profile && !profile.guest ? 'signOut' : 'signIn')}
          </button>
        </div>
      </section>
      <section className="panel lan-panel">
        <Icon name="globe" />
        <div>
          <h3>{t('lan')}</h3>
          <p>{t('lanDesc')}</p>
        </div>
        <span className="outline-pill">{t('comingSoon')}</span>
      </section>
      <footer className="app-footer">
        <strong>{t('about')}</strong>
        <p>{t('privacyNote')}</p>
      </footer>
    </div>
  );
}

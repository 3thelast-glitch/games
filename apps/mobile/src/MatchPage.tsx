import { useEffect, useState } from 'react';
import type { BaseState, Seat } from '../../../packages/core/src/game.ts';
import type { MatchResult, PublicPlayer } from '../../../packages/core/src/protocol.ts';
import { Avatar, formatTime, Icon, Modal } from './components.tsx';
import { gameResource, gameViews } from './gameViews.tsx';
import { useI18n } from './i18n.tsx';
export interface MatchPageProps {
  id: string;
  state: BaseState;
  mode: 'local' | 'ai' | 'online';
  ranked: boolean;
  players: PublicPlayer[];
  self: Seat;
  clocks: number[];
  turnStartedAt: number;
  now: number;
  createdAt: number;
  endedAt: number | null;
  result: MatchResult | null;
  disabled: boolean;
  pending: boolean;
  canUndo: boolean;
  sound: boolean;
  connectionStatus: string;
  disconnected: boolean;
  graceSeconds: number;
  drawOffer: Seat | null;
  drawAccepts?: Seat[];
  rematchWaiting: boolean;
  emote: { player: Seat; value: string } | null;
  onMove: (move: unknown) => void;
  onUndo: () => void;
  onRestart: () => void;
  onResign: () => void;
  onDraw: () => void;
  onDrawAnswer: (accept: boolean) => void;
  onRematch: () => void;
  onHome: () => void;
  onSound: () => void;
  onEmote: (emote: string) => void;
}
export function MatchPage(p: MatchPageProps) {
  const { t } = useI18n();
  const [confirmation, setConfirmation] = useState<'restart' | 'resign' | 'draw' | null>(null),
    [emotesOpen, setEmotesOpen] = useState(false),
    [resultOpen, setResultOpen] = useState(true),
    [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    setResultOpen(true);
    setConfirmation(null);
  }, [p.id, p.result?.reason]);
  const view = gameViews[p.state.gameId],
    turnText = p.result
      ? t('game-over')
      : p.pending
        ? t('pendingMove')
        : p.mode === 'ai' && p.state.turn === 1
          ? t('thinking')
          : p.mode === 'local'
            ? `${p.players[p.state.turn].name} · ${t('turn')}`
            : p.state.turn === p.self
              ? t('yourTurn')
              : t('theirTurn');
  const panel = (player: Seat) => {
    const person = p.players[player],
      resource = gameResource(p.state, player),
      clock = Math.max(
        0,
        p.clocks[player] - (!p.result && p.state.turn === player ? p.now - p.turnStartedAt : 0),
      );
    return (
      <div
        key={player}
        className={`player-panel player-${player} ${p.state.turn === player && !p.result ? 'active' : ''}`}
      >
        <Avatar name={person.name} avatar={person.avatar} />
        <div className="player-details">
          <strong>{person.name}</strong>
          <span>
            {p.mode === 'online' ? (
              <span className={`rank-badge ${person.rank.toLowerCase()}`}>{t(person.rank)}</span>
            ) : (
              t(player === 0 ? 'player1' : 'player2')
            )}
          </span>
        </div>
        <div className="player-resource">
          <strong>{resource.value}</strong>
          <small>{t(resource.label)}</small>
        </div>
        <div className={`match-clock ${clock < 60000 ? 'low' : ''}`} dir="ltr">
          <Icon name="clock" size={14} />
          {formatTime(clock)}
        </div>
        {p.emote?.player === player && <span className="emote-bubble">{p.emote.value}</span>}
      </div>
    );
  };
  const opponents = p.players
    .map((_, index) => index as Seat)
    .filter((seat) => seat !== p.self);
  return (
    <div className="match-page page-enter">
      <header className="match-header">
        <button className="icon-button" aria-label={t('home')} onClick={p.onHome}>
          <Icon name="back" />
        </button>
        <div>
          <h1>{t(p.state.gameId)}</h1>
          <small>
            {t(p.mode)}
            {p.mode === 'online' ? ` · ${t(p.ranked ? 'ranked' : 'casual')}` : ''}
          </small>
        </div>
        <span className="match-move-number">
          {t('moveNumber')} {p.state.ply + 1}
        </span>
        <button
          className="icon-button"
          onClick={p.onSound}
          aria-label={t(p.sound ? 'mute' : 'unmute')}
        >
          <Icon name={p.sound ? 'volume' : 'mute'} />
        </button>
      </header>
      {p.mode === 'online' && p.connectionStatus !== 'connected' && (
        <div className="connection-banner">
          <span className="spinner" />
          {t('reconnecting')}
        </div>
      )}
      {p.disconnected && !p.result && (
        <div className="connection-banner">
          {t('opponentDisconnected')} <b>{p.graceSeconds}s</b>
        </div>
      )}
      <div className="match-layout">
        <div className="board-column">
          <div className="multiplayer-opponents">{opponents.map((seat) => panel(seat))}</div>
          <div className={`turn-banner player-${p.state.turn}`} role="status">
            <span className="live-dot" />
            {turnText}
          </div>
          {view({ state: p.state, disabled: p.disabled, onMove: p.onMove, t })}
          {panel(p.self)}
        </div>
        <aside className="match-side">
          <section className="panel match-controls">
            <h2>{t('arena')}</h2>
            <div className="match-action-grid">
              {p.mode === 'local' && (
                <button disabled={!p.canUndo} onClick={p.onUndo}>
                  <Icon name="undo" />
                  {t('undo')}
                </button>
              )}
              {p.mode !== 'online' && (
                <button onClick={() => setConfirmation('restart')}>
                  <Icon name="restart" />
                  {t('restart')}
                </button>
              )}
              <button disabled={!!p.result} onClick={() => setConfirmation('resign')}>
                <Icon name="flag" />
                {t('resign')}
              </button>
              <button
                disabled={!!p.result || p.mode === 'ai' || p.drawOffer !== null}
                onClick={() => (p.mode === 'local' ? setConfirmation('draw') : p.onDraw())}
              >
                <Icon name="handshake" />
                {t('draw')}
              </button>
              <button onClick={() => setEmotesOpen(!emotesOpen)}>
                <Icon name="smile" />
                {t('emotes')}
              </button>
              <button onClick={() => setRulesOpen(true)}>
                <Icon name="info" />
                {t('rules')}
              </button>
            </div>
            {emotesOpen && (
              <div className="emote-picker">
                {['👋', '👏', '🤔', '🔥', '🤝', '🎯'].map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      p.onEmote(e);
                      setEmotesOpen(false);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="panel match-guide">
            <span className="eyebrow">{t('rules')}</span>
            <h3>{t(`${p.state.gameId}Tag`)}</h3>
            <p>{t(`${p.state.gameId}Rules`)}</p>
          </section>
          {p.drawOffer !== null && !p.result && (
            <section className="panel draw-panel">
              <p>{t(p.drawOffer === p.self || (p.drawAccepts ?? []).includes(p.self) ? 'drawSent' : 'drawOffered')}</p>
              {p.drawOffer !== p.self && !(p.drawAccepts ?? []).includes(p.self) && (
                <div className="button-row">
                  <button className="button primary" onClick={() => p.onDrawAnswer(true)}>
                    {t('accept')}
                  </button>
                  <button className="button secondary" onClick={() => p.onDrawAnswer(false)}>
                    {t('decline')}
                  </button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
      {confirmation && (
        <Modal
          title={t(
            confirmation === 'restart'
              ? 'confirmRestart'
              : confirmation === 'resign'
                ? 'confirmResign'
                : 'confirmDraw',
          )}
          onClose={() => setConfirmation(null)}
        >
          <p className="modal-description">
            {t(
              confirmation === 'restart'
                ? 'confirmRestartDesc'
                : confirmation === 'resign'
                  ? 'confirmResignDesc'
                  : 'confirmDrawDesc',
            )}
          </p>
          <div className="button-row">
            <button className="button ghost" onClick={() => setConfirmation(null)}>
              {t('cancel')}
            </button>
            <button
              className={`button ${confirmation === 'resign' ? 'danger' : 'primary'}`}
              onClick={() => {
                if (confirmation === 'restart') p.onRestart();
                else if (confirmation === 'resign') p.onResign();
                else p.onDraw();
                setConfirmation(null);
              }}
            >
              {t(confirmation === 'draw' ? 'accept' : confirmation)}
            </button>
          </div>
        </Modal>
      )}
      {rulesOpen && (
        <Modal title={`${t('rules')} · ${t(p.state.gameId)}`} onClose={() => setRulesOpen(false)}>
          <p className="rules-text">{t(`${p.state.gameId}Rules`)}</p>
        </Modal>
      )}
      {p.result && resultOpen && (
        <Modal
          title={t(
            p.result.winner === null
              ? 'drawResult'
              : p.mode === 'local' || p.result.winner === p.self
                ? 'victory'
                : 'defeat',
          )}
          onClose={() => setResultOpen(false)}
        >
          <div
            className={`result-content ${p.result.winner !== null && (p.mode === 'local' || p.result.winner === p.self) ? 'won' : ''}`}
          >
            <div className="victory-symbol">
              <Icon name={p.result.winner === null ? 'handshake' : 'trophy'} size={48} />
              <span>✦</span>
              <span>✧</span>
              <span>✦</span>
            </div>
            <h3>{p.result.winner === null ? t('drawResult') : p.players[p.result.winner].name}</h3>
            {p.result.winner !== null && <span className="small-muted">{t('winsMatch')}</span>}
            <p>{t(p.result.reason)}</p>
            <div className="result-stats">
              <div>
                <small>{t('duration')}</small>
                <strong>{formatTime((p.endedAt ?? p.now) - p.createdAt)}</strong>
              </div>
              <div>
                <small>{t('ratingChange')}</small>
                <strong className="mint-text">
                  {p.ranked
                    ? `${p.result.ratingDelta[p.self] > 0 ? '+' : ''}${p.result.ratingDelta[p.self]}`
                    : t('unrated')}
                </strong>
              </div>
            </div>
            <button
              className="button primary full"
              disabled={p.rematchWaiting}
              onClick={p.onRematch}
            >
              <Icon name="restart" />
              {t(p.rematchWaiting ? 'rematchWaiting' : 'rematch')}
            </button>
            <button className="button ghost full" onClick={p.onHome}>
              {t('returnHome')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

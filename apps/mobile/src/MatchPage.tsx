import { useEffect, useState } from 'react';
import type { BaseState, Seat } from '../../../packages/core/src/game.ts';
import type { MatchResult, PublicPlayer } from '../../../packages/core/src/protocol.ts';
import {
  bankTimeControl,
  remainingTimeMs,
  type TimeControl,
} from '../../../packages/core/src/timing.ts';
import { Avatar, formatTime, Icon, Modal } from './components.tsx';
import { gameResource, gameViews } from './gameViews.tsx';
import {
  summarizeChessReviews,
  type ChessMoveReview,
} from '../../../packages/games/chess/review.ts';
import { useI18n } from './i18n.tsx';
export interface MatchPageProps {
  id: string;
  state: BaseState;
  mode: 'local' | 'ai' | 'online';
  ranked: boolean;
  players: PublicPlayer[];
  self: Seat;
  clocks: number[];
  timeControl?: TimeControl;
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
  chessReviews?: ChessMoveReview[];
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
  const timeControl = p.timeControl ?? bankTimeControl(600000),
    view = gameViews[p.state.gameId],
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
  const clockFor = (player: Seat) =>
    p.result
      ? Math.max(0, p.clocks[player] ?? 0)
      : remainingTimeMs(
          timeControl,
          p.clocks,
          p.state.turn,
          player,
          p.turnStartedAt,
          p.now,
        );
  const lowThreshold =
    timeControl.mode === 'turn' ? Math.min(10000, timeControl.turnMs / 3) : 60000;
  const panel = (player: Seat) => {
    const person = p.players[player],
      resource = gameResource(p.state, player),
      clock = clockFor(player);
    return (
      <div
        key={player}
        className={`player-panel player-${player} ${p.state.turn === player && !p.result ? 'active' : ''} ${p.mode === 'local' && p.state.gameId === 'chess' && player === 1 ? 'tabletop-facing-panel' : ''}`}
      >
        <Avatar name={person.name} avatar={person.avatar} />
        <div className="player-details">
          <strong>{person.name}</strong>
          <span>
            {p.mode === 'online' ? (
              <span className={`rank-badge ${person.rank.toLowerCase()}`}>{t(person.rank)}</span>
            ) : (
              t(`player${player + 1}`)
            )}
          </span>
        </div>
        <div className="player-resource">
          <strong>{resource.value}</strong>
          <small>{t(resource.label)}</small>
        </div>
        <div
          className={`match-clock ${!p.result && p.state.turn === player && clock <= lowThreshold ? 'low' : ''}`}
          dir="ltr"
        >
          <Icon name="clock" size={14} />
          {formatTime(clock)}
        </div>
        {p.emote?.player === player && <span className="emote-bubble">{p.emote.value}</span>}
      </div>
    );
  };
  const localChessTabletop = p.mode === 'local' && p.state.gameId === 'chess';
  const chessReviews = p.state.gameId === 'chess' ? (p.chessReviews ?? []) : [];
  const lastChessReview = chessReviews[chessReviews.length - 1] ?? null;
  const chessReviewPending =
    p.state.gameId === 'chess' && p.state.ply > 0 && (lastChessReview?.ply ?? 0) < p.state.ply;
  const chessReviewSummary =
    p.state.gameId === 'chess' ? summarizeChessReviews(chessReviews) : null;
  const opponents = p.players
    .map((_, index) => index as Seat)
    .filter((seat) => seat !== p.self);
  const topSeats = localChessTabletop ? ([1] as Seat[]) : opponents;
  const bottomSeat = localChessTabletop ? (0 as Seat) : p.self;
  return (
    <div className="match-page page-enter" data-game={p.state.gameId} data-mode={p.mode}>
      <header className="match-header">
        <button className="icon-button" aria-label={t('home')} onClick={p.onHome}>
          <Icon name="back" />
        </button>
        <div>
          <h1>{t(p.state.gameId)}</h1>
          <small>
            {t(p.mode)}
            {p.mode === 'online' ? ` · ${t(p.ranked ? 'ranked' : 'casual')}` : ''}
            {timeControl.mode === 'turn'
              ? ` · ${timeControl.turnMs / 1000}s`
              : p.state.gameId === 'reversi'
                ? ` · ${t('turn')}: ${t('off')}`
                : ''}
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
          <div className="multiplayer-opponents">{topSeats.map((seat) => panel(seat))}</div>
          <div
            className={`turn-banner player-${p.state.turn} ${localChessTabletop && p.state.turn === 1 ? 'tabletop-facing-banner' : ''}`}
            role="status"
          >
            <span className="live-dot" />
            {turnText}
          </div>
          {view({ state: p.state, disabled: p.disabled, onMove: p.onMove, t, mode: p.mode })}
          {panel(bottomSeat)}
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
          {localChessTabletop ? (
            <section className="panel chess-tabletop-clocks" aria-label={t('chess')}>
              <div
                className={`chess-tabletop-clock chess-black-clock ${p.state.turn === 1 && !p.result ? 'active' : ''}`}
              >
                <div className="chess-clock-player">
                  <span className="chess-clock-piece" aria-hidden="true">♚</span>
                  <div>
                    <strong>{t('chessBlack')}</strong>
                    <small>{p.players[1].name}</small>
                  </div>
                </div>
                <div
                  className={`chess-clock-time ${!p.result && p.state.turn === 1 && clockFor(1) <= lowThreshold ? 'low' : ''}`}
                  dir="ltr"
                >
                  <Icon name="clock" size={18} />
                  <strong>{formatTime(clockFor(1))}</strong>
                </div>
              </div>
              <div
                className={`chess-tabletop-clock chess-white-clock ${p.state.turn === 0 && !p.result ? 'active' : ''}`}
              >
                <div className="chess-clock-player">
                  <span className="chess-clock-piece" aria-hidden="true">♔</span>
                  <div>
                    <strong>{t('chessWhite')}</strong>
                    <small>{p.players[0].name}</small>
                  </div>
                </div>
                <div
                  className={`chess-clock-time ${!p.result && p.state.turn === 0 && clockFor(0) <= lowThreshold ? 'low' : ''}`}
                  dir="ltr"
                >
                  <Icon name="clock" size={18} />
                  <strong>{formatTime(clockFor(0))}</strong>
                </div>
              </div>
            </section>
          ) : (
            <section className="panel match-guide">
              <span className="eyebrow">{t('rules')}</span>
              <h3>{t(`${p.state.gameId}Tag`)}</h3>
              <p>{t(`${p.state.gameId}Rules`)}</p>
            </section>
          )}
          {p.state.gameId === 'chess' && (
            <section
              className={`panel chess-move-review-panel ${
                localChessTabletop && lastChessReview?.player === 1
                  ? 'tabletop-facing-review'
                  : ''
              }`}
              aria-live="polite"
            >
              <div className="chess-review-heading">
                <div>
                  <span className="eyebrow">{t('chessMoveReview')}</span>
                  <h3>{t('chessMoveReviewLive')}</h3>
                </div>
                {chessReviewPending && (
                  <span className="chess-review-analyzing">
                    <span className="spinner" />
                    {t('chessAnalyzingMove')}
                  </span>
                )}
              </div>
              {lastChessReview ? (
                <>
                  <div className={`chess-review-hero grade-${lastChessReview.grade}`}>
                    <span className="chess-review-mark" aria-hidden="true">
                      {lastChessReview.grade === 'best'
                        ? '★'
                        : lastChessReview.grade === 'excellent'
                          ? '✦'
                          : lastChessReview.grade === 'good'
                            ? '✓'
                            : lastChessReview.grade === 'inaccuracy'
                              ? '?!'
                              : lastChessReview.grade === 'mistake'
                                ? '?'
                                : '??'}
                    </span>
                    <div>
                      <strong>{t(`chessGrade_${lastChessReview.grade}`)}</strong>
                      <small>
                        {lastChessReview.notation} · {lastChessReview.accuracy}%
                      </small>
                    </div>
                    <span className="chess-review-loss" dir="ltr">
                      −{lastChessReview.centipawnLoss / 100}
                    </span>
                  </div>
                  {lastChessReview.bestNotation &&
                    lastChessReview.bestNotation !== lastChessReview.notation && (
                      <div className="chess-best-line">
                        <span>{t('chessBestMove')}</span>
                        <strong dir="ltr">{lastChessReview.bestNotation}</strong>
                      </div>
                    )}
                  <div className="chess-review-history">
                    {chessReviews
                      .slice(-6)
                      .reverse()
                      .map((review) => (
                        <div key={review.ply} className={`grade-${review.grade}`}>
                          <span>
                            {Math.ceil(review.ply / 2)}.
                            {review.player === 1 ? '…' : ''}
                          </span>
                          <strong dir="ltr">{review.notation}</strong>
                          <small>{t(`chessGrade_${review.grade}`)}</small>
                          <b>{review.accuracy}%</b>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <p className="small-muted">
                  {p.state.ply > 0 ? t('chessAnalyzingMove') : t('chessReviewStartsAfterMove')}
                </p>
              )}
            </section>
          )}
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
            {p.state.gameId === 'chess' && chessReviewSummary && (
              <section className="chess-final-review">
                <div className="chess-final-review-head">
                  <div>
                    <small>{t('chessGameReview')}</small>
                    <strong>{t('chessGameQuality')}</strong>
                  </div>
                  <b>{chessReviewSummary.quality}%</b>
                </div>
                <div className="chess-final-player-grid">
                  {chessReviewSummary.players.map((summary) => (
                    <div key={summary.player} className={`chess-final-player player-${summary.player}`}>
                      <div className="chess-final-player-title">
                        <span aria-hidden="true">{summary.player === 0 ? '♔' : '♚'}</span>
                        <div>
                          <strong>{p.players[summary.player]?.name}</strong>
                          <small>{t(summary.player === 0 ? 'chessWhite' : 'chessBlack')}</small>
                        </div>
                      </div>
                      <div className="chess-final-accuracy">
                        <strong>{summary.accuracy}%</strong>
                        <small>{t('chessAccuracy')}</small>
                      </div>
                      <div className="chess-final-breakdown">
                        <span>
                          <b>{summary.grades.best}</b>
                          {t('chessGrade_best')}
                        </span>
                        <span>
                          <b>{summary.grades.excellent}</b>
                          {t('chessGrade_excellent')}
                        </span>
                        <span>
                          <b>{summary.grades.good}</b>
                          {t('chessGrade_good')}
                        </span>
                        <span>
                          <b>{summary.grades.inaccuracy}</b>
                          {t('chessGrade_inaccuracy')}
                        </span>
                        <span>
                          <b>{summary.grades.mistake}</b>
                          {t('chessGrade_mistake')}
                        </span>
                        <span>
                          <b>{summary.grades.blunder}</b>
                          {t('chessGrade_blunder')}
                        </span>
                      </div>
                      <div className="chess-final-meta">
                        <span>{t('chessReviewedMoves')}: {summary.moves}</span>
                        <span dir="ltr">ACPL: {summary.averageCentipawnLoss}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {chessReviewPending && (
                  <div className="chess-final-pending">
                    <span className="spinner" />
                    {t('chessFinalAnalysisPending')}
                  </div>
                )}
              </section>
            )}
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

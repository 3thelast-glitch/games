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
  deriveChessPlan,
  formatChessEvaluation,
  chessMoveNotation,
  summarizeChessReviews,
  type ChessMoveReview,
  type ChessStrategicMetric,
  type ChessStrategicSnapshot,
} from '../../../packages/games/chess/review.ts';
import {
  BLACK_REPERTOIRE_OPTIONS,
  WHITE_REPERTOIRE_OPTIONS,
  chessOpeningCandidates,
  chessOpeningMatchesRepertoire,
  detectChessOpening,
  type ChessRepertoire,
} from '../../../packages/games/chess/opening.ts';
import { ChessPieceIcon } from '../../../packages/games/chess/pieces.tsx';
import type {
  ChessAiSessionConfig,
  ChessTrainingFocus,
} from '../../../packages/games/chess/training.ts';
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
  chessRepertoire?: ChessRepertoire;
  chessAi?: ChessAiSessionConfig;
  onChessRepertoireChange?: (repertoire: ChessRepertoire) => void;
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
const chessStrategicMetrics: ChessStrategicMetric[] = [
  'material',
  'kingSafety',
  'centerControl',
  'development',
  'pieceActivity',
  'pawnStructure',
  'space',
  'initiative',
  'passedPawns',
  'endgame',
];

function StrategicIndicators({
  snapshot,
  t,
  compact = false,
}: {
  snapshot: ChessStrategicSnapshot;
  t: (key: string) => string;
  compact?: boolean;
}) {
  return (
    <div className={`chess-strategy-grid ${compact ? 'compact' : ''}`}>
      {chessStrategicMetrics.map((metric) => {
        const white = snapshot.white[metric];
        const black = snapshot.black[metric];
        const total = Math.max(1, white + black);
        const whiteShare = (white / total) * 100;
        return (
          <div className="chess-strategy-row" key={metric}>
            <strong className="white-value">{white}</strong>
            <div>
              <small>{t(`chessStrategy_${metric}`)}</small>
              <div className="chess-strategy-track" aria-hidden="true">
                <span className="white" style={{ width: `${whiteShare}%` }} />
                <span className="black" style={{ width: `${100 - whiteShare}%` }} />
              </div>
            </div>
            <strong className="black-value">{black}</strong>
          </div>
        );
      })}
    </div>
  );
}

const trainingMetric: Partial<
  Record<ChessTrainingFocus, ChessStrategicMetric>
> = {
  development: 'development',
  center: 'centerControl',
  kingSafety: 'kingSafety',
  tactics: 'initiative',
  endgame: 'endgame',
  positional: 'pieceActivity',
};

export function MatchPage(p: MatchPageProps) {
  const { t, lang } = useI18n();
  const [confirmation, setConfirmation] = useState<'restart' | 'resign' | 'draw' | null>(null),
    [emotesOpen, setEmotesOpen] = useState(false),
    [resultOpen, setResultOpen] = useState(true),
    [rulesOpen, setRulesOpen] = useState(false),
    [showChessGuidance, setShowChessGuidance] = useState(true),
    [chessAssistantTab, setChessAssistantTab] = useState<
      'coach' | 'analysis' | 'opening' | 'repertoire'
    >(p.mode === 'ai' ? 'coach' : 'analysis');
  useEffect(() => {
    setResultOpen(true);
    setConfirmation(null);
  }, [p.id, p.result?.reason]);
  const timeControl = p.timeControl ?? bankTimeControl(600000),
    untimed = timeControl.mode === 'none',
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
        {!untimed && (
          <div
            className={`match-clock ${!p.result && p.state.turn === player && clock <= lowThreshold ? 'low' : ''}`}
            dir="ltr"
          >
            <Icon name="clock" size={14} />
            {formatTime(clock)}
          </div>
        )}
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
  const chessAnalysisVisible =
    p.state.gameId === 'chess' && (p.mode !== 'online' || !p.ranked || !!p.result);
  const latestEvaluation =
    lastChessReview?.evaluationAfter ?? lastChessReview?.evaluationBefore ?? null;
  const latestStrategy = lastChessReview?.strategicAfter ?? null;
  const evaluationWhitePercent = latestEvaluation?.whitePercent ?? 50;
  const chessMoves = chessReviews.map((review) => review.move);
  const chessOpening = detectChessOpening(chessMoves);
  const chessOpeningNext = chessOpeningCandidates(chessMoves);
  const repertoireMatches =
    p.chessRepertoire && chessOpening
      ? chessOpeningMatchesRepertoire(chessOpening, p.chessRepertoire)
      : null;
  const chessPlan = chessAnalysisVisible ? deriveChessPlan(lastChessReview) : null;
  const visibleChessPlan = showChessGuidance ? chessPlan : null;
  const chessCoachActive =
    p.state.gameId === 'chess' && p.mode === 'ai' && !!p.chessAi?.coach && !p.result;
  const coachMetric = p.chessAi ? trainingMetric[p.chessAi.focus] : undefined;
  const coachScore =
    coachMetric && latestStrategy ? latestStrategy.white[coachMetric] : null;
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
          {view({
            state: p.state,
            disabled: p.disabled,
            onMove: p.onMove,
            t,
            mode: p.mode,
            chessPlan: p.state.gameId === 'chess' ? visibleChessPlan : null,
          })}
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
                  <span className="chess-clock-piece" aria-hidden="true">
                    <ChessPieceIcon type="king" owner={1} />
                  </span>
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
                  <span className="chess-clock-piece" aria-hidden="true">
                    <ChessPieceIcon type="king" owner={0} />
                  </span>
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
          ) : p.state.gameId !== 'chess' ? (
            <section className="panel match-guide">
              <span className="eyebrow">{t('rules')}</span>
              <h3>{t(`${p.state.gameId}Tag`)}</h3>
              <p>{t(`${p.state.gameId}Rules`)}</p>
            </section>
          ) : null}
          {chessAnalysisVisible && p.state.gameId === 'chess' && (
            <section className="panel chess-assistant-shell">
              <div className="chess-assistant-header">
                <div>
                  <span className="eyebrow">{t('chessAssistant')}</span>
                  <strong>{t('chessAssistantDesc')}</strong>
                </div>
                {p.mode === 'ai' && p.chessAi && (
                  <span className="chess-ai-persona-badge">
                    {t(`chessBotStyle_${p.chessAi.style}`)}
                  </span>
                )}
              </div>
              <div className="chess-assistant-tabs" role="tablist" aria-label={t('chessAssistant')}>
                {(['coach', 'analysis', 'opening', 'repertoire'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={chessAssistantTab === tab}
                    className={chessAssistantTab === tab ? 'active' : ''}
                    onClick={() => setChessAssistantTab(tab)}
                  >
                    {t(`chessAssistantTab_${tab}`)}
                  </button>
                ))}
              </div>
            </section>
          )}
          {chessAnalysisVisible && chessAssistantTab === 'analysis' && (
            <section className="panel chess-evaluation-panel" aria-label={t('chessEvaluation')}>
              <div className="chess-evaluation-head">
                <div>
                  <span className="eyebrow">{t('chessEvaluation')}</span>
                  <strong dir="ltr">{formatChessEvaluation(latestEvaluation)}</strong>
                </div>
                <div className="chess-evaluation-side-labels">
                  <span>{t('chessWhite')}</span>
                  <span>{t('chessBlack')}</span>
                </div>
              </div>
              <div
                className="chess-evaluation-bar"
                role="meter"
                aria-label={t('chessEvaluation')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(evaluationWhitePercent)}
              >
                <span className="white" style={{ width: `${evaluationWhitePercent}%` }} />
                <span className="black" style={{ width: `${100 - evaluationWhitePercent}%` }} />
              </div>
            </section>
          )}
          {chessAnalysisVisible && p.state.gameId === 'chess' && chessAssistantTab === 'opening' && (
            <section className="panel chess-opening-explorer">
              <div className="chess-review-heading">
                <div>
                  <span className="eyebrow">{t('chessOpeningExplorer')}</span>
                  <h3>
                    {chessOpening
                      ? lang === 'ar'
                        ? chessOpening.nameAr
                        : chessOpening.nameEn
                      : t('chessOpeningUnknown')}
                  </h3>
                </div>
                {chessOpening && <span className="chess-eco-badge">{chessOpening.eco}</span>}
              </div>
              {chessOpening ? (
                <>
                  <p className="chess-opening-family">
                    {lang === 'ar' ? chessOpening.familyAr : chessOpening.familyEn}
                  </p>
                  <p className="small-muted">
                    {lang === 'ar' ? chessOpening.ideaAr : chessOpening.ideaEn}
                  </p>
                  {repertoireMatches && (
                    <div className="chess-repertoire-match">
                      <span className={repertoireMatches.white ? 'matched' : ''}>
                        {t('chessWhiteRepertoire')} · {repertoireMatches.white ? '✓' : '—'}
                      </span>
                      <span className={repertoireMatches.black ? 'matched' : ''}>
                        {t('chessBlackRepertoire')} · {repertoireMatches.black ? '✓' : '—'}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="small-muted">{t('chessOpeningWaiting')}</p>
              )}
              {chessOpeningNext.length > 0 && !p.result && (
                <div className="chess-opening-candidates">
                  <small>{t('chessCommonContinuations')}</small>
                  {chessOpeningNext.slice(0, 3).map((candidate) => (
                    <div key={candidate.opening.id}>
                      <strong dir="ltr">{chessMoveNotation(candidate.move)}</strong>
                      <span>
                        {lang === 'ar' ? candidate.opening.nameAr : candidate.opening.nameEn}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          {chessAnalysisVisible &&
            p.state.gameId === 'chess' &&
            chessAssistantTab === 'repertoire' &&
            p.chessRepertoire && (
            <section className="panel chess-repertoire-panel">
              <div className="chess-review-heading">
                <div>
                  <span className="eyebrow">{t('chessOpeningRepertoire')}</span>
                  <h3>{t('chessYourRepertoire')}</h3>
                </div>
              </div>
              <div className="chess-repertoire-selects">
                <label>
                  <span>{t('chessAsWhite')}</span>
                  <select
                    value={p.chessRepertoire.white}
                    onChange={(event) =>
                      p.onChessRepertoireChange?.({
                        ...p.chessRepertoire!,
                        white: event.target.value as ChessRepertoire['white'],
                      })
                    }
                  >
                    {WHITE_REPERTOIRE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {lang === 'ar' ? option.nameAr : option.nameEn}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t('chessAsBlack')}</span>
                  <select
                    value={p.chessRepertoire.black}
                    onChange={(event) =>
                      p.onChessRepertoireChange?.({
                        ...p.chessRepertoire!,
                        black: event.target.value as ChessRepertoire['black'],
                      })
                    }
                  >
                    {BLACK_REPERTOIRE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {lang === 'ar' ? option.nameAr : option.nameEn}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}
          {chessCoachActive && chessAssistantTab === 'coach' && p.chessAi && (
            <section className="panel chess-coach-panel">
              <div className="chess-coach-title">
                <div>
                  <span className="eyebrow">{t('chessCoachMode')}</span>
                  <h3>{t(`chessTrainingFocus_${p.chessAi.focus}`)}</h3>
                </div>
                {coachScore !== null && (
                  <strong className="chess-coach-score">{coachScore}/100</strong>
                )}
              </div>
              <p>{t(`chessTrainingLesson_${p.chessAi.focus}`)}</p>
              <div className="chess-coach-objective">
                <Icon name="target" size={18} />
                <span>{t(`chessTrainingGoal_${p.chessAi.focus}`)}</span>
              </div>
              {lastChessReview && lastChessReview.player === 0 && (
                <div className={`chess-coach-feedback grade-${lastChessReview.grade}`}>
                  <strong>{t(`chessGrade_${lastChessReview.grade}`)}</strong>
                  <span>
                    {lastChessReview.accuracy}% · {t('chessAccuracy')}
                  </span>
                </div>
              )}
            </section>
          )}
          {chessAnalysisVisible && chessAssistantTab === 'coach' && chessPlan && !p.result && (
            <section className="panel chess-plan-panel">
              <div className="chess-plan-head">
                <div>
                  <span className="eyebrow">{t('chessPlan')}</span>
                  <h3>{t(`chessPlan_${chessPlan.kind}`)}</h3>
                </div>
                <button
                  className={`chess-guidance-toggle ${showChessGuidance ? 'active' : ''}`}
                  type="button"
                  aria-pressed={showChessGuidance}
                  onClick={() => setShowChessGuidance((value) => !value)}
                >
                  {t(showChessGuidance ? 'chessHideArrow' : 'chessShowArrow')}
                </button>
              </div>
              <div className="chess-plan-move">
                <span>{t('chessRecommendedMove')}</span>
                <strong dir="ltr">
                  {lastChessReview?.bestMove ? chessMoveNotation(lastChessReview.bestMove) : '—'}
                </strong>
              </div>
              <p className="small-muted">{t(`chessPlanDesc_${chessPlan.kind}`)}</p>
            </section>
          )}
          {chessAnalysisVisible && chessAssistantTab === 'analysis' && latestStrategy && !p.result && (
            <section className="panel chess-strategy-panel">
              <div className="chess-review-heading">
                <div>
                  <span className="eyebrow">{t('chessStrategicIndicators')}</span>
                  <h3>{t('chessPositionProfile')}</h3>
                </div>
              </div>
              <StrategicIndicators snapshot={latestStrategy} t={t} compact />
            </section>
          )}
          {chessAnalysisVisible && chessAssistantTab === 'analysis' && (
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
          {p.state.gameId === 'chess' && p.mode === 'online' && p.ranked && !p.result && (
            <section className="panel chess-analysis-locked">
              <Icon name="lock" size={18} />
              <div>
                <strong>{t('chessAnalysisLocked')}</strong>
                <small>{t('chessAnalysisLockedDesc')}</small>
              </div>
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
                <div className="chess-final-evaluation">
                  <span>{t('chessFinalEvaluation')}</span>
                  <strong dir="ltr">
                    {formatChessEvaluation(chessReviewSummary.finalEvaluation)}
                  </strong>
                </div>
                {chessReviewSummary.turningPoint && (
                  <div className="chess-key-moment turning-point">
                    <span>{t('chessTurningPoint')}</span>
                    <div>
                      <strong dir="ltr">{chessReviewSummary.turningPoint.notation}</strong>
                      <small>
                        {t(`chessGrade_${chessReviewSummary.turningPoint.grade}`)} · −
                        {(chessReviewSummary.turningPoint.centipawnLoss / 100).toFixed(1)}
                      </small>
                    </div>
                  </div>
                )}
                <div className="chess-final-player-grid">
                  {chessReviewSummary.players.map((summary) => (
                    <div key={summary.player} className={`chess-final-player player-${summary.player}`}>
                      <div className="chess-final-player-title">
                        <span aria-hidden="true">
                          <ChessPieceIcon type="king" owner={summary.player} />
                        </span>
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
                      <div className="chess-player-key-moves">
                        {summary.bestMove && (
                          <span>
                            <small>{t('chessBestMove')}</small>
                            <b dir="ltr">{summary.bestMove.notation}</b>
                          </span>
                        )}
                        {summary.biggestMistake && summary.biggestMistake.centipawnLoss > 10 && (
                          <span>
                            <small>{t('chessBiggestMistake')}</small>
                            <b dir="ltr">{summary.biggestMistake.notation}</b>
                          </span>
                        )}
                      </div>
                      <div className="chess-final-meta">
                        <span>{t('chessReviewedMoves')}: {summary.moves}</span>
                        <span dir="ltr">ACPL: {summary.averageCentipawnLoss}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {chessReviewSummary.finalStrategic && (
                  <div className="chess-final-strategy">
                    <div className="chess-final-section-title">
                      <strong>{t('chessStrategicIndicators')}</strong>
                      <small>{t('chessFinalPosition')}</small>
                    </div>
                    <StrategicIndicators
                      snapshot={chessReviewSummary.finalStrategic}
                      t={t}
                    />
                  </div>
                )}
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

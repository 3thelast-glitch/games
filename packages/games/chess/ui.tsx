import { useEffect, useId, useMemo, useState } from 'react';
import { isGameOver } from '../../core/src/game.ts';
import type { BoardProps } from '../shared/ui.tsx';
import { ChessPieceIcon } from './pieces.tsx';
import { chessLegalMoves, isChessInCheck } from './rules.ts';
import type { ChessPlanHint } from './review.ts';
import type { ChessGuidanceSuggestion } from './guidance.ts';
import type { ChessMove, ChessPromotion, ChessState } from './state.ts';
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const promotions: ChessPromotion[] = ['queen', 'rook', 'bishop', 'knight'];

type ChessBoardProps = BoardProps<ChessState, ChessMove> & {
  mode?: 'local' | 'ai' | 'online';
  plan?: ChessPlanHint | null;
  guidance?: ChessGuidanceSuggestion | null;
  guidanceReveal?: 'cue' | 'piece' | 'move';
};

export function ChessBoard({
  state,
  disabled,
  onMove,
  t,
  mode,
  plan,
  guidance,
  guidanceReveal = 'cue',
}: ChessBoardProps) {
  const [selection, setSelection] = useState<number | null>(null);
  const arrowId = useId().replace(/:/g, '');
  const tabletop = mode === 'local';
  const [promotionTarget, setPromotionTarget] = useState<{ from: number; to: number } | null>(null);
  useEffect(() => {
    setSelection(null);
    setPromotionTarget(null);
  }, [state]);
  const locked = disabled || isGameOver(state);
  const moves = useMemo(() => chessLegalMoves(state), [state]);
  const selectedMoves = selection === null ? [] : moves.filter((move) => move.from === selection);
  const targetSet = new Set(selectedMoves.map((move) => move.to));
  const guidancePiece =
    guidance && guidance.positionPly === state.ply && guidanceReveal !== 'cue'
      ? guidance.move.from
      : -1;
  const guidanceTargets =
    guidance && guidance.positionPly === state.ply && guidanceReveal === 'move'
      ? new Set(guidance.legalDestinations)
      : new Set<number>();
  const guidanceCaptures =
    guidance && guidance.positionPly === state.ply && guidanceReveal === 'move'
      ? new Set(guidance.captureDestinations)
      : new Set<number>();
  const checkedKing = state.inCheck
    ? state.board.findIndex((piece) => piece?.owner === state.turn && piece.type === 'king')
    : -1;

  const chooseSquare = (index: number) => {
    if (locked) return;
    const piece = state.board[index];
    if (selection !== null && targetSet.has(index)) {
      const candidates = selectedMoves.filter((move) => move.to === index);
      if (candidates.some((move) => move.promotion)) {
        setPromotionTarget({ from: selection, to: index });
        return;
      }
      onMove(candidates[0]);
      return;
    }
    if (piece?.owner === state.turn && moves.some((move) => move.from === index))
      setSelection(selection === index ? null : index);
    else setSelection(null);
  };

  return (
    <div className={`classic-game chess-game ${tabletop ? 'chess-tabletop' : ''} turn-${state.turn}`}>
      <p className="board-hint" role="status">
        {state.inCheck ? t('chessCheckHint') : t('chessHint')}
      </p>
      <div className="chess-board-wrap">
        <div className="classic-board chess-board" dir="ltr" role="grid" aria-label={t('chess')}>
          {state.board.map((piece, index) => {
            const row = Math.floor(index / 8), col = index % 8;
            const light = (row + col) % 2 === 0;
            const target = targetSet.has(index);
            const selectable = piece?.owner === state.turn && moves.some((move) => move.from === index);
            const last = state.lastMove?.from === index || state.lastMove?.to === index;
            const recommendedPiece = guidancePiece === index;
            const recommendedTarget = guidanceTargets.has(index);
            const label = `${files[col]}${8 - row}: ${piece ? `${t(piece.owner === 0 ? 'chessWhite' : 'chessBlack')} ${t(`chess${piece.type[0].toUpperCase()}${piece.type.slice(1)}`)}` : t('emptyCell')}`;
            return (
              <button
                key={index}
                role="gridcell"
                className={`chess-cell ${light ? 'chess-light' : 'chess-dark'} ${selection === index ? 'selected-cell' : ''} ${target ? 'legal-cell' : ''} ${last ? 'last-cell' : ''} ${checkedKing === index ? 'chess-check-cell' : ''} ${recommendedPiece ? 'chess-guidance-piece' : ''} ${recommendedTarget ? 'chess-guidance-target' : ''}`}
                aria-label={label}
                aria-pressed={selection === index}
                disabled={locked || (!selectable && !target)}
                onClick={() => chooseSquare(index)}
              >
                {piece && (
                  <span
                    className={`chess-piece owner-${piece.owner} ${tabletop && piece.owner === 1 ? 'tabletop-facing-piece' : ''}`}
                  >
                    <ChessPieceIcon type={piece.type} owner={piece.owner} />
                  </span>
                )}
                {target && <span className={piece ? 'chess-capture-ring' : 'target-dot'} aria-hidden="true" />}
                {recommendedTarget && !target && (
                  <span
                    className={guidanceCaptures.has(index) ? 'chess-guidance-capture' : 'chess-guidance-dot'}
                    aria-hidden="true"
                  />
                )}
                {row === 7 && <span className="chess-file" aria-hidden="true">{files[col]}</span>}
                {col === 0 && <span className="chess-rank" aria-hidden="true">{8 - row}</span>}
                {tabletop && row === 0 && (
                  <span className="chess-file chess-file-opposite" aria-hidden="true">{files[col]}</span>
                )}
                {tabletop && col === 7 && (
                  <span className="chess-rank chess-rank-opposite" aria-hidden="true">{8 - row}</span>
                )}
              </button>
            );
          })}
        </div>
        {(plan || (guidance && guidance.positionPly === state.ply && guidanceReveal === 'move')) && (
          <svg
            className="chess-plan-overlay"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <marker
                id={`chess-plan-arrow-${arrowId}`}
                markerWidth="5"
                markerHeight="5"
                refX="4.2"
                refY="2.5"
                orient="auto"
              >
                <path d="M0 0 L5 2.5 L0 5 Z" />
              </marker>
            </defs>
            <line
              x1={((guidance && guidance.positionPly === state.ply && guidanceReveal === 'move' ? guidance.move.from : plan!.from) % 8 + 0.5) * 12.5}
              y1={(Math.floor((guidance && guidance.positionPly === state.ply && guidanceReveal === 'move' ? guidance.move.from : plan!.from) / 8) + 0.5) * 12.5}
              x2={((guidance && guidance.positionPly === state.ply && guidanceReveal === 'move' ? guidance.move.to : plan!.to) % 8 + 0.5) * 12.5}
              y2={(Math.floor((guidance && guidance.positionPly === state.ply && guidanceReveal === 'move' ? guidance.move.to : plan!.to) / 8) + 0.5) * 12.5}
              markerEnd={`url(#chess-plan-arrow-${arrowId})`}
            />
            <circle
              cx={((guidance && guidance.positionPly === state.ply && guidanceReveal === 'move' ? guidance.move.from : plan!.from) % 8 + 0.5) * 12.5}
              cy={(Math.floor((guidance && guidance.positionPly === state.ply && guidanceReveal === 'move' ? guidance.move.from : plan!.from) / 8) + 0.5) * 12.5}
              r="1.25"
            />
          </svg>
        )}
        {promotionTarget && (
          <div
            className={`chess-promotion ${tabletop && state.turn === 1 ? 'tabletop-facing-promotion' : ''}`}
            role="dialog"
            aria-label={t('chessPromotion')}
          >
            <strong>{t('chessChoosePromotion')}</strong>
            <div>
              {promotions.map((promotion) => (
                <button
                  key={promotion}
                  className="chess-promotion-piece"
                  aria-label={t(`chess${promotion[0].toUpperCase()}${promotion.slice(1)}`)}
                  onClick={() =>
                    onMove({
                      from: promotionTarget.from,
                      to: promotionTarget.to,
                      promotion,
                    })
                  }
                >
                  <ChessPieceIcon type={promotion} owner={state.turn} />
                </button>
              ))}
            </div>
            <button className="button ghost" onClick={() => setPromotionTarget(null)}>{t('cancel')}</button>
          </div>
        )}
      </div>
      <div className="chess-status-row">
        <span>{t('chessWhite')}: {state.board.filter((piece) => piece?.owner === 0).length}</span>
        <span>{t('chessBlack')}: {state.board.filter((piece) => piece?.owner === 1).length}</span>
        {isChessInCheck(state, state.turn) && <strong>{t('chessCheck')}</strong>}
      </div>
      <button
        className="button secondary board-clear"
        disabled={locked || selection === null}
        onClick={() => setSelection(null)}
      >
        {t('clear')}
      </button>
    </div>
  );
}

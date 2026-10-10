import { useEffect, useMemo, useState } from 'react';
import { isGameOver } from '../../core/src/game.ts';
import type { BoardProps } from '../shared/ui.tsx';
import { chessLegalMoves, isChessInCheck } from './rules.ts';
import type { ChessMove, ChessPieceType, ChessPromotion, ChessState } from './state.ts';

const glyphs: Record<0 | 1, Record<Exclude<ChessPieceType, 'king' | 'bishop'>, string>> = {
  0: { queen: '♕', rook: '♖', knight: '♘', pawn: '♙' },
  1: { queen: '♛', rook: '♜', knight: '♞', pawn: '♟' },
};

function CrosslessChessPiece({ type, owner }: { type: 'king' | 'bishop'; owner: 0 | 1 }) {
  const common = {
    className: `chess-piece-svg owner-${owner}`,
    viewBox: '0 0 64 64',
    'aria-hidden': true,
    focusable: 'false',
  } as const;

  if (type === 'king') {
    return (
      <svg {...common}>
        <circle cx="32" cy="8" r="4.5" fill="currentColor" />
        <path
          fill="currentColor"
          d="M18 18c3.3-5.5 8.1-8.4 14-8.4S42.7 12.5 46 18l-4.2 18H22.2L18 18Zm6.8 4.2 2.1 9.8h10.2l2.1-9.8c-2-3.7-4.4-5.5-7.2-5.5s-5.2 1.8-7.2 5.5ZM20 39h24v6H20v-6Zm-3 9h30v7H17v-7Z"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 6c9.2 0 16.5 7.4 16.5 16.5 0 6.2-3.5 11.7-8.6 14.5l4.6 8.5H19.5l4.6-8.5c-5.1-2.8-8.6-8.3-8.6-14.5C15.5 13.4 22.8 6 32 6Zm0 7c-5.3 0-9.5 4.3-9.5 9.5 0 3.6 2 6.7 5 8.3l2.6-11.4h4.1l2.3 10.2c3-1.7 5-4.9 5-8.6 0-4.4-4.3-8-9.5-8Z"
        clipRule="evenodd"
      />
      <path fill="currentColor" d="M17 48h30v7H17v-7Z" />
    </svg>
  );
}

function ChessPieceVisual({ type, owner }: { type: ChessPieceType; owner: 0 | 1 }) {
  if (type === 'king' || type === 'bishop')
    return <CrosslessChessPiece type={type} owner={owner} />;
  return <>{glyphs[owner][type]}</>;
}
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const promotions: ChessPromotion[] = ['queen', 'rook', 'bishop', 'knight'];

type ChessBoardProps = BoardProps<ChessState, ChessMove> & {
  mode?: 'local' | 'ai' | 'online';
};

export function ChessBoard({ state, disabled, onMove, t, mode }: ChessBoardProps) {
  const [selection, setSelection] = useState<number | null>(null);
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
            const label = `${files[col]}${8 - row}: ${piece ? `${t(piece.owner === 0 ? 'chessWhite' : 'chessBlack')} ${t(`chess${piece.type[0].toUpperCase()}${piece.type.slice(1)}`)}` : t('emptyCell')}`;
            return (
              <button
                key={index}
                role="gridcell"
                className={`chess-cell ${light ? 'chess-light' : 'chess-dark'} ${selection === index ? 'selected-cell' : ''} ${target ? 'legal-cell' : ''} ${last ? 'last-cell' : ''} ${checkedKing === index ? 'chess-check-cell' : ''}`}
                aria-label={label}
                aria-pressed={selection === index}
                disabled={locked || (!selectable && !target)}
                onClick={() => chooseSquare(index)}
              >
                {piece && (
                  <span
                    className={`chess-piece owner-${piece.owner} ${tabletop && piece.owner === 1 ? 'tabletop-facing-piece' : ''}`}
                  >
                    <ChessPieceVisual type={piece.type} owner={piece.owner} />
                  </span>
                )}
                {target && <span className={piece ? 'chess-capture-ring' : 'target-dot'} aria-hidden="true" />}
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
                  <ChessPieceVisual type={promotion} owner={state.turn} />
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

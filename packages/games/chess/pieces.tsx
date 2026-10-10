import type { ChessPieceType } from './state.ts';

const glyphs: Record<0 | 1, Record<Exclude<ChessPieceType, 'king' | 'bishop'>, string>> = {
  0: { queen: '♕', rook: '♖', knight: '♘', pawn: '♙' },
  1: { queen: '♛', rook: '♜', knight: '♞', pawn: '♟' },
};

function CrosslessKing({ owner }: { owner: 0 | 1 }) {
  return (
    <svg
      className={`chess-piece-svg owner-${owner}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="8" r="4.5" fill="currentColor" />
      <path
        fill="currentColor"
        d="M18 18c3.3-5.5 8.1-8.4 14-8.4S42.7 12.5 46 18l-4.2 18H22.2L18 18Zm6.8 4.2 2.1 9.8h10.2l2.1-9.8c-2-3.7-4.4-5.5-7.2-5.5s-5.2 1.8-7.2 5.5ZM20 39h24v6H20v-6Zm-3 9h30v7H17v-7Z"
      />
    </svg>
  );
}

function CrosslessBishop({ owner }: { owner: 0 | 1 }) {
  return (
    <svg
      className={`chess-piece-svg owner-${owner}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
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

export function ChessPieceIcon({ type, owner }: { type: ChessPieceType; owner: 0 | 1 }) {
  if (type === 'king') return <CrosslessKing owner={owner} />;
  if (type === 'bishop') return <CrosslessBishop owner={owner} />;
  return <>{glyphs[owner][type]}</>;
}

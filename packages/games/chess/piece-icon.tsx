import type { ChessPieceType } from './state.ts';

const unicodePieces: Record<'white' | 'black', Record<Exclude<ChessPieceType, 'king' | 'queen' | 'bishop'>, string>> = {
  white: { rook: '♖', knight: '♘', pawn: '♙' },
  black: { rook: '♜', knight: '♞', pawn: '♟' },
};

export interface ChessPieceIconProps {
  type: ChessPieceType;
  owner: 0 | 1;
  className?: string;
  title?: string;
}

export function ChessPieceIcon({ type, owner, className = '', title }: ChessPieceIconProps) {
  const color = owner === 0 ? 'white' : 'black';

  if (type === 'king') {
    return (
      <svg
        className={`chess-piece-svg chess-piece-svg-king ${className}`}
        viewBox="0 0 64 64"
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
      >
        {title && <title>{title}</title>}
        <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="9" r="4" />
          <path d="M18 27c2-8 8-12 14-12s12 4 14 12c2 8-1 14-5 18H23c-4-4-7-10-5-18Z" />
          <path d="M23 45h18" />
          <path d="M20 51h24" />
          <path d="M17 57h30" />
        </g>
      </svg>
    );
  }

  if (type === 'queen') {
    return (
      <svg
        className={`chess-piece-svg chess-piece-svg-queen ${className}`}
        viewBox="0 0 64 64"
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
      >
        {title && <title>{title}</title>}
        <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="15" r="3.5" />
          <circle cx="32" cy="10" r="3.5" />
          <circle cx="46" cy="15" r="3.5" />
          <path d="M17 21l6 20h18l6-20-10 9-5-12-5 12-10-9Z" />
          <path d="M23 41h18" />
          <path d="M20 49h24" />
          <path d="M17 56h30" />
        </g>
      </svg>
    );
  }

  if (type === 'bishop') {
    return (
      <svg
        className={`chess-piece-svg chess-piece-svg-bishop ${className}`}
        viewBox="0 0 64 64"
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
      >
        {title && <title>{title}</title>}
        <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="9" r="3.5" />
          <path d="M32 14c-8 7-13 14-13 21 0 7 5 12 13 12s13-5 13-12c0-7-5-14-13-21Z" />
          <path d="M37 24l-9 10" />
          <path d="M23 47h18" />
          <path d="M19 53h26" />
          <path d="M16 58h32" />
        </g>
      </svg>
    );
  }

  return (
    <span className={`chess-piece-unicode ${className}`} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <span className="sr-only">{title}</span>}
      {unicodePieces[color][type]}
    </span>
  );
}

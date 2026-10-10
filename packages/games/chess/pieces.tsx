import type { ReactNode } from 'react';
import type { ChessPieceType } from './state.ts';

type PieceProps = { owner: 0 | 1 };

function PieceSvg({
  owner,
  type,
  children,
}: PieceProps & { type: ChessPieceType; children: ReactNode }) {
  return (
    <svg
      className={`chess-piece-svg owner-${owner}`}
      data-piece={type}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function Pawn({ owner }: PieceProps) {
  return (
    <PieceSvg owner={owner} type="pawn">
      <circle cx="32" cy="14" r="8" fill="currentColor" />
      <path
        fill="currentColor"
        d="M24 23h16c-.2 6.8 2.1 12.2 6.7 17.2L51 47H13l4.3-6.8C21.9 35.2 24.2 29.8 24 23Z"
      />
      <path fill="currentColor" d="M12 49h40v7H12z" />
    </PieceSvg>
  );
}

function Knight({ owner }: PieceProps) {
  return (
    <PieceSvg owner={owner} type="knight">
      <path
        fill="currentColor"
        d="M18 48c1.8-8.5 5.4-15.3 11-20.5l-3.7-8.1 8.2 2.5c4.8-2.3 9.1-5.7 12.8-10.2 4 8.2 4.1 16.2.3 24-2.6 5.2-6.4 9.2-11.5 12.3H18Z"
      />
      <path
        fill="currentColor"
        d="M26.8 25.5c-5.1 1.1-9 3.7-11.6 7.8l7.9 2.9 7.7-3.7-4-7Z"
      />
      <circle cx="39.8" cy="20.3" r="1.8" fill="var(--chess-piece-cutout, #000)" opacity=".65" />
      <path fill="currentColor" d="M14 49h39v7H14z" />
    </PieceSvg>
  );
}

function Queen({ owner }: PieceProps) {
  return (
    <PieceSvg owner={owner} type="queen">
      <circle cx="32" cy="8" r="4.2" fill="currentColor" />
      <path
        fill="currentColor"
        d="M23 15c2.8-2.2 5.8-3.3 9-3.3s6.2 1.1 9 3.3l-3 20H26l-3-20Z"
      />
      <path
        fill="currentColor"
        d="M20.5 18.5 16 24l6.5 4.5L18 36h28l-4.5-7.5L48 24l-4.5-5.5-3 17H23.5l-3-17Z"
      />
      <path fill="currentColor" d="M18 39h28v6H18zM14 48h36v8H14z" />
    </PieceSvg>
  );
}

function King({ owner }: PieceProps) {
  return (
    <PieceSvg owner={owner} type="king">
      <path
        fill="currentColor"
        d="M17 18 22 8l7 9 3-12 3 12 7-9 5 10-4.5 9h-21L17 18Z"
      />
      <circle cx="22" cy="7" r="2.2" fill="currentColor" />
      <circle cx="29" cy="13" r="2.2" fill="currentColor" />
      <circle cx="32" cy="4" r="2.2" fill="currentColor" />
      <circle cx="35" cy="13" r="2.2" fill="currentColor" />
      <circle cx="42" cy="7" r="2.2" fill="currentColor" />
      <path
        fill="currentColor"
        d="M21 29h22l-2.5 18h-17L21 29Z"
      />
      <path fill="currentColor" d="M19 48h26v5H19zM14 54h36v3H14z" />
    </PieceSvg>
  );
}

function Bishop({ owner }: PieceProps) {
  return (
    <PieceSvg owner={owner} type="bishop">
      <circle cx="32" cy="8" r="4" fill="currentColor" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 11c8 5.7 12.8 11.4 12.8 18.2 0 5-2.7 9.5-7 12.5H26.2c-4.3-3-7-7.5-7-12.5C19.2 22.4 24 16.7 32 11Zm2.8 8.3-8.2 13.2 3.2 2 8.2-13.2-3.2-2Z"
        clipRule="evenodd"
      />
      <path fill="currentColor" d="M20 44h24v5H20zM14 51h36v6H14z" />
    </PieceSvg>
  );
}

function Rook({ owner }: PieceProps) {
  return (
    <PieceSvg owner={owner} type="rook">
      <path
        fill="currentColor"
        d="M17 10h8v7h6v-7h6v7h6v-7h8v15H17V10Z"
      />
      <path fill="currentColor" d="M21 27h22l-2.5 20h-17L21 27Z" />
      <path fill="currentColor" d="M18 48h28v5H18zM14 54h36v3H14z" />
    </PieceSvg>
  );
}

export function ChessPieceIcon({ type, owner }: { type: ChessPieceType; owner: 0 | 1 }) {
  switch (type) {
    case 'pawn':
      return <Pawn owner={owner} />;
    case 'knight':
      return <Knight owner={owner} />;
    case 'queen':
      return <Queen owner={owner} />;
    case 'king':
      return <King owner={owner} />;
    case 'bishop':
      return <Bishop owner={owner} />;
    case 'rook':
      return <Rook owner={owner} />;
  }
}

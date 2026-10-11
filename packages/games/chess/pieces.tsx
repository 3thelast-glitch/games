import type { CSSProperties, ReactNode } from 'react';
import type { ChessPieceType } from './state.ts';

const geometry: Record<ChessPieceType, { height: number; width: number }> = {
  pawn: { height: 58, width: 58 },
  knight: { height: 76, width: 72 },
  queen: { height: 84, width: 64 },
  king: { height: 94, width: 68 },
  bishop: { height: 82, width: 62 },
  rook: { height: 72, width: 66 },
};

function PieceSvg({
  type,
  owner,
  children,
}: {
  type: ChessPieceType;
  owner: 0 | 1;
  children: ReactNode;
}) {
  const { height, width } = geometry[type];
  return (
    <svg
      className={`chess-piece-svg owner-${owner}`}
      data-piece={type}
      data-professional-vector="true"
      viewBox="0 0 100 120"
      preserveAspectRatio="xMidYMax meet"
      style={
        {
          '--chess-piece-reference-height': `${height}%`,
          '--chess-piece-reference-width': `${width}%`,
        } as CSSProperties
      }
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function Base({ y = 101 }: { y?: number }) {
  return (
    <>
      <path d={`M24 ${y - 10} Q20 ${y - 5} 17 ${y} H83 Q80 ${y - 5} 76 ${y - 10} Z`} fill="currentColor" />
      <rect x="14" y={y} width="72" height="9" rx="3.5" fill="currentColor" />
    </>
  );
}

function Pawn({ owner }: { owner: 0 | 1 }) {
  return (
    <PieceSvg type="pawn" owner={owner}>
      <circle cx="50" cy="25" r="13" fill="currentColor" />
      <path d="M39 39 H61 Q59 49 61 59 Q64 70 72 82 H28 Q36 70 39 59 Q41 49 39 39 Z" fill="currentColor" />
      <path d="M31 80 H69 Q72 84 72 89 H28 Q28 84 31 80 Z" fill="currentColor" />
      <Base y={96} />
    </PieceSvg>
  );
}

function Knight({ owner }: { owner: 0 | 1 }) {
  return (
    <PieceSvg type="knight" owner={owner}>
      <path
        fill="currentColor"
        d="M30 91
           Q34 76 42 66
           Q47 59 54 53
           Q61 47 65 39
           Q68 32 66 23
           L58 28
           L50 18
           L47 29
           Q39 31 34 38
           Q29 44 25 50
           L15 57
           Q13 60 16 64
           L23 68
           Q27 69 31 65
           L39 58
           Q45 58 50 61
           Q42 68 37 77
           Q33 84 30 91 Z"
      />
      <path d="M29 87 H71 Q75 91 76 96 H24 Q25 91 29 87 Z" fill="currentColor" />
      <Base y={99} />
    </PieceSvg>
  );
}

function Queen({ owner }: { owner: 0 | 1 }) {
  return (
    <PieceSvg type="queen" owner={owner}>
      <circle cx="50" cy="13" r="5.5" fill="currentColor" />
      <path
        fill="currentColor"
        d="M50 20
           Q42 20 36 28
           L30 25
           L24 32
           Q31 40 34 49
           Q36 56 34 62
           H66
           Q64 56 66 49
           Q69 40 76 32
           L70 25
           L64 28
           Q58 20 50 20 Z"
      />
      <path d="M31 61 H69 L66 68 H34 Z" fill="currentColor" />
      <path d="M36 68 H64 Q62 80 68 91 H32 Q38 80 36 68 Z" fill="currentColor" />
      <Base y={97} />
    </PieceSvg>
  );
}

function King({ owner }: { owner: 0 | 1 }) {
  return (
    <PieceSvg type="king" owner={owner}>
      <path
        fill="currentColor"
        d="M22 29
           L28 13
           L38 25
           L45 8
           L50 24
           L55 8
           L62 25
           L72 13
           L78 29
           Q66 23 50 23
           Q34 23 22 29 Z"
      />
      <circle cx="28" cy="12" r="3.2" fill="currentColor" />
      <circle cx="45" cy="7" r="3.2" fill="currentColor" />
      <circle cx="55" cy="7" r="3.2" fill="currentColor" />
      <circle cx="72" cy="12" r="3.2" fill="currentColor" />
      <path d="M24 31 Q50 27 76 31 L73 37 Q50 34 27 37 Z" fill="currentColor" />
      <path
        fill="currentColor"
        d="M31 41
           Q32 34 40 32
           H60
           Q68 34 69 41
           Q69 50 63 56
           L67 62
           H33
           L37 56
           Q31 50 31 41 Z"
      />
      <path d="M35 63 H65 L62 70 H38 Z" fill="currentColor" />
      <path d="M39 70 H61 Q59 82 68 92 H32 Q41 82 39 70 Z" fill="currentColor" />
      <Base y={98} />
    </PieceSvg>
  );
}

function Bishop({ owner }: { owner: 0 | 1 }) {
  return (
    <PieceSvg type="bishop" owner={owner}>
      <circle cx="50" cy="14" r="4.7" fill="currentColor" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M50 20
           Q63 31 66 43
           Q68 52 61 61
           Q57 65 62 70
           H38
           Q43 65 39 61
           Q32 52 34 43
           Q37 31 50 20 Z
           M55 31
           L44 50
           Q42 54 46 56
           Q50 58 52 54
           L62 37
           Z"
        clipRule="evenodd"
      />
      <path d="M35 69 H65 L62 76 H38 Z" fill="currentColor" />
      <path d="M39 76 H61 Q60 84 68 92 H32 Q40 84 39 76 Z" fill="currentColor" />
      <Base y={98} />
    </PieceSvg>
  );
}

function Rook({ owner }: { owner: 0 | 1 }) {
  return (
    <PieceSvg type="rook" owner={owner}>
      <path
        fill="currentColor"
        d="M24 24 H35 V16 H44 V24 H56 V16 H65 V24 H76 V40 H24 Z"
      />
      <path d="M28 41 H72 L68 49 H32 Z" fill="currentColor" />
      <path d="M35 49 H65 Q62 67 68 88 H32 Q38 67 35 49 Z" fill="currentColor" />
      <path d="M30 88 H70 L73 95 H27 Z" fill="currentColor" />
      <Base y={98} />
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

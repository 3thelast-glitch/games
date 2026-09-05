import { MORRIS_EDGES, MORRIS_POINTS } from '../../../packages/games/nine-mens-morris/state.ts';
export function ClassicArt({ game }: { game: string }) {
  const disc = (x: number, y: number, owner: number, key: number, king = false) => (
    <g key={key}>
      <ellipse cx={x} cy={y + 5} rx="15" ry="14" fill="#0006" />
      <circle
        cx={x}
        cy={y}
        r="15"
        fill={owner === 0 ? '#303847' : '#eadfcb'}
        stroke={owner === 0 ? '#818a9e' : '#fff4df'}
        strokeWidth="2"
      />
      <circle cx={x} cy={y - 1} r="10" fill="none" stroke={owner === 0 ? '#657186' : '#c5b698'} />
      {king && <path d={`M${x - 8} ${y + 4}l-2-11 7 5 3-9 3 9 7-5-2 11Z`} fill="#d9b97c" />}
    </g>
  );
  return (
    <svg className="classic-art" viewBox="0 0 440 440">
      <rect
        x="15"
        y="15"
        width="410"
        height="410"
        rx="25"
        fill={game === 'gomoku' ? '#8c7658' : game === 'connectFour' ? '#294c73' : '#282d39'}
        stroke="#918878"
        strokeWidth="3"
      />
      {game === 'checkers' && (
        <>
          {Array.from({ length: 64 }, (_, i) => (
            <rect
              key={i}
              x={36 + (i % 8) * 46}
              y={36 + Math.floor(i / 8) * 46}
              width="46"
              height="46"
              fill={(Math.floor(i / 8) + (i % 8)) % 2 ? '#544845' : '#b9a78c'}
            />
          ))}
          {[1, 3, 5, 7, 8, 12, 17, 21, 26, 40, 44, 49, 53, 55, 56, 58, 60, 62].map((i, n) =>
            disc(
              59 + (i % 8) * 46,
              59 + Math.floor(i / 8) * 46,
              n < 9 ? 1 : 0,
              i,
              i === 26 || i === 49,
            ),
          )}
        </>
      )}
      {game === 'gomoku' && (
        <>
          {Array.from({ length: 15 }, (_, i) => (
            <path
              key={i}
              d={`M38 ${38 + i * 26}h364M${38 + i * 26} 38v364`}
              stroke="#453d31"
              strokeWidth="1.5"
            />
          ))}
          {[
            [7, 7],
            [6, 7],
            [8, 8],
            [8, 7],
            [9, 9],
            [7, 8],
            [10, 10],
            [9, 8],
            [11, 11],
          ].map(([r, c], i) => disc(38 + c * 26, 38 + r * 26, i % 2, i))}
        </>
      )}
      {game === 'connectFour' && (
        <>
          {Array.from({ length: 42 }, (_, i) => (
            <circle
              key={i}
              cx={58 + (i % 7) * 54}
              cy={80 + Math.floor(i / 7) * 54}
              r="21"
              fill="#111e30"
              stroke="#6591b4"
            />
          ))}
          {[35, 36, 37, 38, 39, 40, 41, 28, 29, 30, 31, 32, 33, 23, 24, 25, 17].map((at, i) =>
            disc(58 + (at % 7) * 54, 80 + Math.floor(at / 7) * 54, i % 2, at),
          )}
        </>
      )}
      {game === 'nineMensMorris' && (
        <>
          {MORRIS_EDGES.map(([a, b], i) => (
            <line
              key={i}
              x1={50 + MORRIS_POINTS[a][0] * 56.5}
              y1={50 + MORRIS_POINTS[a][1] * 56.5}
              x2={50 + MORRIS_POINTS[b][0] * 56.5}
              y2={50 + MORRIS_POINTS[b][1] * 56.5}
              stroke="#b4a78c"
              strokeWidth="4"
            />
          ))}
          {MORRIS_POINTS.map(([x, y], i) => (
            <circle key={i} cx={50 + x * 56.5} cy={50 + y * 56.5} r="7" fill="#d1b992" />
          ))}
          {[0, 1, 2, 5, 8, 10, 11, 13, 15, 16, 19, 22].map((at, i) =>
            disc(50 + MORRIS_POINTS[at][0] * 56.5, 50 + MORRIS_POINTS[at][1] * 56.5, i % 2, at),
          )}
        </>
      )}
    </svg>
  );
}

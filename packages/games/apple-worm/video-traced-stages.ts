/**
 * SOURCE-TRACED Apple Worm stage geometry (stages 1–10 only).
 *
 * Derived from untouched/near-entry frames of the user's 47m53s MP4.
 * Terrain is traced at original video grid-cell centres, pitch=30px,
 * centre=(33+30*x, 103+30*y), with one extra grid row above for the
 * off-ground exit on stage 6.
 *
 * THESE ARE SOURCE MAP BLUEPRINTS, NOT VERIFIED PLAYABLE LEVELS.
 * Matching cell-centre brown-terrain pixels does not prove original
 * physics, win route, artwork, sprite collision extents or 100% fidelity.
 * Do not change the 40 live NAQLA stages or count until verified.
 *
 * Frames are reference-only; no external/proprietary sprites are included.
 */
export type VideoGridPoint = readonly [number, number];
export interface VideoTracedStage {
  number: number;
  width: 21;
  height: 9;
  sourceSeconds: number;
  /** Top-left cell center in 640x360 reference video pixels. */
  sourceGridOrigin: readonly [33, 73];
  sourceGridPitch: 30;
  rows: readonly string[];
  blocks: readonly VideoGridPoint[];
  /** Ordered from permanent head to tail. */
  worm: readonly VideoGridPoint[];
  apples: readonly VideoGridPoint[];
  exit: VideoGridPoint;
  geometryComparedWithSourceFrame: true;
  sourceWinningRouteVerified: false;
  gameplayVerified: false;
}

const TERRAIN_ROWS: readonly (readonly string[])[] = [
  [
    ".....................",
    ".....................",
    ".....................",
    ".........##..........",
    ".....##########......",
    ".....................",
    ".....................",
    "....................."
  ],
  [
    ".....................",
    ".....................",
    "..........####.......",
    "..........#..........",
    "..........#..........",
    ".......####..........",
    ".....................",
    "....................."
  ],
  [
    ".....................",
    ".....................",
    ".....................",
    ".....................",
    "......###...###......",
    ".....................",
    ".....................",
    "....................."
  ],
  [
    ".....................",
    ".........##.###......",
    ".........#..#........",
    "............#........",
    ".....######.#........",
    "..........###........",
    ".....................",
    "....................."
  ],
  [
    ".....................",
    ".....................",
    ".......##.##.#.......",
    ".......#...#.........",
    ".......#...#.........",
    ".......#####.........",
    ".....................",
    "....................."
  ],
  [
    ".....................",
    ".....................",
    ".....###.###.#.......",
    ".......#.....#.......",
    ".......#.###.#.......",
    ".......###.#.#.......",
    "...........###.......",
    "....................."
  ],
  [
    ".....................",
    ".....................",
    ".....####.....#......",
    ".....#..#.....#......",
    ".....#........#......",
    ".....####...###......",
    ".....................",
    "....................."
  ],
  [
    ".....................",
    ".......#..##.........",
    ".......#.............",
    ".......#...#.........",
    ".....................",
    "....#####...####.....",
    ".....................",
    "....................."
  ],
  [
    ".....................",
    ".........#####.......",
    ".........#..#........",
    "............#........",
    "......####..#........",
    ".........####........",
    ".....................",
    "....................."
  ],
  [
    "..........##.........",
    "..........##.........",
    "......###.##.#.......",
    ".......#..#..#.......",
    ".......#.....#.......",
    ".......#..####.......",
    ".......##.#..........",
    "....................."
  ]
] as const;

/** Original image-grid positions have their top row at y=103; game grid
 * adds an empty row with centre y=73, so translate all y positions +1. */
const ENTRY: readonly {
  seconds: number;
  head: VideoGridPoint;
  tail: readonly VideoGridPoint[];
  apples: readonly VideoGridPoint[];
  exit: VideoGridPoint;
}[] = [
  {
    "seconds": 0,
    "head": [
      5,
      3
    ],
    "tail": [
      [
        4,
        3
      ],
      [
        4,
        4
      ]
    ],
    "apples": [],
    "exit": [
      14,
      3
    ]
  },
  {
    "seconds": 8.5,
    "head": [
      7,
      4
    ],
    "tail": [
      [
        6,
        4
      ],
      [
        6,
        5
      ]
    ],
    "apples": [
      [
        6,
        2
      ]
    ],
    "exit": [
      13,
      1
    ]
  },
  {
    "seconds": 16.6,
    "head": [
      7,
      3
    ],
    "tail": [
      [
        6,
        3
      ],
      [
        5,
        3
      ]
    ],
    "apples": [
      [
        10,
        2
      ]
    ],
    "exit": [
      14,
      3
    ]
  },
  {
    "seconds": 26.7,
    "head": [
      7,
      3
    ],
    "tail": [
      [
        6,
        3
      ],
      [
        5,
        3
      ]
    ],
    "apples": [
      [
        10,
        2
      ]
    ],
    "exit": [
      14,
      0
    ]
  },
  {
    "seconds": 40.5,
    "head": [
      8,
      1
    ],
    "tail": [
      [
        7,
        1
      ],
      [
        6,
        1
      ]
    ],
    "apples": [
      [
        9,
        4
      ]
    ],
    "exit": [
      13,
      3
    ]
  },
  {
    "seconds": 55,
    "head": [
      11,
      1
    ],
    "tail": [
      [
        10,
        1
      ],
      [
        9,
        1
      ]
    ],
    "apples": [
      [
        10,
        3
      ]
    ],
    "exit": [
      15,
      -1
    ]
  },
  {
    "seconds": 65.8,
    "head": [
      7,
      1
    ],
    "tail": [
      [
        6,
        1
      ],
      [
        5,
        1
      ]
    ],
    "apples": [
      [
        10,
        4
      ]
    ],
    "exit": [
      14,
      1
    ]
  },
  {
    "seconds": 78.4,
    "head": [
      6,
      4
    ],
    "tail": [
      [
        5,
        4
      ],
      [
        4,
        4
      ]
    ],
    "apples": [
      [
        9,
        3
      ]
    ],
    "exit": [
      15,
      6
    ]
  },
  {
    "seconds": 100.7,
    "head": [
      8,
      3
    ],
    "tail": [
      [
        7,
        3
      ],
      [
        6,
        3
      ]
    ],
    "apples": [
      [
        10,
        2
      ]
    ],
    "exit": [
      13,
      0
    ]
  },
  {
    "seconds": 111.9,
    "head": [
      8,
      1
    ],
    "tail": [
      [
        7,
        1
      ],
      [
        6,
        1
      ]
    ],
    "apples": [
      [
        9,
        5
      ]
    ],
    "exit": [
      13,
      1
    ]
  }
] as const;

export const APPLE_WORM_VIDEO_TRACED_COUNT = TERRAIN_ROWS.length;

const lift = ([x,y]: VideoGridPoint): VideoGridPoint => [x,y+1];

export function appleWormVideoTracedStage(level: number): VideoTracedStage {
  if (!Number.isInteger(level) || level < 1 || level > APPLE_WORM_VIDEO_TRACED_COUNT) {
    throw new RangeError('Only source-traced Apple Worm stages 1–10 exist');
  }
  const snapshot = ENTRY[level-1]!;
  const rows = ['.'.repeat(21), ...TERRAIN_ROWS[level-1]!];
  const blocks: VideoGridPoint[] = [];
  for (let y=0; y<rows.length; y++) {
    if (rows[y]!.length !== 21) throw new Error('Invalid source grid width');
    for (let x=0; x<21; x++) {
      if (rows[y]![x] === '#') blocks.push([x,y]);
    }
  }
  return {
    number: level, width: 21, height: 9, sourceSeconds: snapshot.seconds,
    sourceGridOrigin: [33,73], sourceGridPitch: 30, rows, blocks,
    worm: [lift(snapshot.head), ...snapshot.tail.map(lift)],
    apples: snapshot.apples.map(lift), exit: lift(snapshot.exit),
    geometryComparedWithSourceFrame: true,
    sourceWinningRouteVerified: false,
    gameplayVerified: false,
  };
}

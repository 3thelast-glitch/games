/**
 * Seeded Ludo AI measurement harness.
 *
 * Plays complete AI-vs-AI matches through the real engine (`rollLudo` /
 * `moveLudo` / `chooseAiToken`) with a deterministic PRNG, so difficulty
 * balance claims rest on reproducible numbers instead of impressions.
 *
 * Usage: node --import tsx scripts/ludo-ai-sim.ts [matchesPerConfig]
 * Output: JSON summary on stdout.
 */
import {
  chooseAiToken, createLudo, moveLudo, rollLudo,
  type LudoProfile, type LudoState, type SeatCount,
} from '../packages/games/ludo/engine.ts';

type Difficulty = 'easy' | 'medium' | 'hard';

/** mulberry32 — small deterministic PRNG, good enough for match simulation. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MatchResult {
  finished: boolean;
  rolls: number;
  winnerSeat: number | null;
  winnerDifficulty: Difficulty | null;
  ranks: { seat: number; difficulty: Difficulty; rank: number }[];
}

const MAX_ROLLS = 20000;

export function playMatch(
  seatCount: SeatCount,
  profile: LudoProfile,
  difficulties: readonly Difficulty[],
  rng: () => number,
): MatchResult {
  let state: LudoState = createLudo(
    seatCount,
    Array(seatCount).fill('ai'),
    profile,
    Math.floor(rng() * seatCount),
  );
  let rolls = 0;
  while (state.phase !== 'finished' && rolls < MAX_ROLLS) {
    if (state.phase === 'roll') {
      state = rollLudo(state, 1 + Math.floor(rng() * 6));
      rolls++;
    } else {
      const difficulty = difficulties[state.activeSeat]!;
      state = moveLudo(state, chooseAiToken(state, difficulty, rng));
    }
  }
  const ranks = state.placements.map(p => ({
    seat: p.seat,
    difficulty: difficulties[p.seat]!,
    rank: p.rank,
  }));
  const first = ranks.find(r => r.rank === 1);
  return {
    finished: state.phase === 'finished',
    rolls,
    winnerSeat: first?.seat ?? null,
    winnerDifficulty: first?.difficulty ?? null,
    ranks,
  };
}

interface ConfigResult {
  config: string;
  matches: number;
  finished: number;
  avgRolls: number;
  winsByDifficulty: Record<string, number>;
  winsBySeat: Record<string, number>;
}

function runConfig(
  name: string,
  seatCount: SeatCount,
  profile: LudoProfile,
  baseDifficulties: readonly Difficulty[],
  matches: number,
  seed: number,
): ConfigResult {
  const winsByDifficulty: Record<string, number> = {};
  const winsBySeat: Record<string, number> = {};
  let finished = 0;
  let totalRolls = 0;
  for (let m = 0; m < matches; m++) {
    const rng = seededRandom(seed + m * 7919);
    // Rotate the difficulty assignment so no difficulty keeps a lucky seat.
    const shift = m % seatCount;
    const difficulties = baseDifficulties.map(
      (_, i) => baseDifficulties[(i + shift) % seatCount]!,
    );
    const result = playMatch(seatCount, profile, difficulties, rng);
    if (result.finished) finished++;
    totalRolls += result.rolls;
    if (result.winnerDifficulty) {
      winsByDifficulty[result.winnerDifficulty] =
        (winsByDifficulty[result.winnerDifficulty] ?? 0) + 1;
    }
    if (result.winnerSeat !== null) {
      winsBySeat[String(result.winnerSeat)] =
        (winsBySeat[String(result.winnerSeat)] ?? 0) + 1;
    }
  }
  return {
    config: name,
    matches,
    finished,
    avgRolls: Math.round((totalRolls / matches) * 10) / 10,
    winsByDifficulty,
    winsBySeat,
  };
}

const matches = Number(process.argv[2] ?? 120);
/** Set LUDO_SIM_SEED_SHIFT to replay the same configs on fresh matches. */
const SHIFT = Number(process.env.LUDO_SIM_SEED_SHIFT ?? 0);
const results: ConfigResult[] = [
  runConfig('4p classic all-medium', 4, 'classic', ['medium', 'medium', 'medium', 'medium'], matches, 1101 + SHIFT),
  runConfig('4p classic 1 hard vs 3 medium', 4, 'classic', ['hard', 'medium', 'medium', 'medium'], matches, 2202 + SHIFT),
  runConfig('4p classic 1 easy vs 3 medium', 4, 'classic', ['easy', 'medium', 'medium', 'medium'], matches, 3303 + SHIFT),
  runConfig('4p classic 1 hard vs 3 easy', 4, 'classic', ['hard', 'easy', 'easy', 'easy'], matches, 4404 + SHIFT),
  runConfig('4p fast all-medium', 4, 'fast', ['medium', 'medium', 'medium', 'medium'], matches, 5505 + SHIFT),
  runConfig('6p classic all-medium', 6, 'classic', ['medium', 'medium', 'medium', 'medium', 'medium', 'medium'], Math.max(20, Math.floor(matches / 3)), 6606 + SHIFT),
];
console.log(JSON.stringify({ matchesPerConfig: matches, seedShift: SHIFT, results }, null, 2));

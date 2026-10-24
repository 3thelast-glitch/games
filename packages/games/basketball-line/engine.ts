/**
 * Basketball Line — an original, stand-alone 2D drawing/physics game for NAQLA.
 * World coordinates are fixed at 420 x 700 so pointers and physics are independent
 * of screen resolution, language, layout direction and native webview scale.
 * No original game's assets, scripts or level data are bundled.
 */
export const COURT_WIDTH = 420;
export const COURT_HEIGHT = 700;
export const STEP_SECONDS = 1 / 120;
export const LINE_CAP = 3;
export const INK_CAP = 850;
export type Vec = { x: number; y: number };
export type BallKind = 'basketball' | 'bomb';
export interface BallBody extends Vec {
  id: number;
  kind: BallKind;
  vx: number;
  vy: number;
  radius: number;
  scored: boolean;
  active: boolean;
  rotation: number;
}
export interface InkStroke { points: Vec[]; length: number }
export type RoundPhase = 'ready' | 'running' | 'won' | 'lost';
export interface BasketRound {
  round: number;
  phase: RoundPhase;
  elapsed: number;
  hoop: { x: number; y: number; width: number };
  balls: BallBody[];
  strokes: InkStroke[];
  inkUsed: number;
  pencils: number;
  gem: Vec;
  gemCollected: boolean;
  message: 'miss' | 'bomb' | 'time' | null;
}
const finite = (n: number) => Number.isFinite(n);
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const distance = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Deterministic 0..1 hash of the round number, for layout variety that
 *  stays identical on every device and every replay of the same round. */
const roundHash = (n: number, salt: number): number => {
  let h = (n * 2654435761 + salt * 40503) % 4294967296;
  h ^= h >>> 13; h = (h * 1597334677) % 4294967296; h ^= h >>> 16;
  return (h % 1000) / 1000;
};
export function makeRound(round = 1): BasketRound {
  const n = Math.max(1, Math.min(9999, Math.floor(round)));
  // Deliberate, reproducible course variations. Ball spawn is well away from hoop;
  // players must create a path, not just watch an automatic basket. A hashed
  // jitter widens the old short % patterns so layouts stay fresh for many
  // rounds; the first two rounds stay gentle.
  const side = n % 2 === 1 ? -1 : 1;
  const ramp = n <= 2 ? .35 : 1;
  const j = (salt: number, span: number) => (roundHash(n, salt) - .5) * 2 * span * ramp;
  const hoopX = clamp((side < 0 ? 98 + (n % 3) * 13 : 310 - (n % 3) * 14) + j(1, 24), 72, 348);
  const hoopY = clamp(510 - (n % 3) * 16 + j(2, 26), 428, 572);
  const hoopWidth = n < 6 ? 88 : n < 14 ? 84 : 80;
  const spawnX = clamp((side < 0 ? 337 - (n % 3) * 8 : 83 + (n % 3) * 7) + j(3, 18), 45, 375);
  const ballCount = n >= 8 && n % 4 !== 1 ? 2 : 1;
  const balls: BallBody[] = [];
  for (let i = 0; i < ballCount; i++) {
    balls.push({
      id: i, kind: 'basketball', x: clamp(spawnX + i * (side < 0 ? -45 : 45), 40, 380),
      y: 129 - i * 85, vx: side * (22 + (n % 5) * 7 + i * 11), vy: i === 0 ? 0 : 15,
      radius: 17, scored: false, active: true, rotation: (n + i) * .17,
    });
  }
  if (n >= 5 && n % 3 !== 1) {
    balls.push({
      id: 100, kind: 'bomb', x: clamp(hoopX + (side < 0 ? 145 : -145) + j(4, 14), 50, 370),
      y: 78, vx: -side * 7, vy: 0, radius: 16, scored: false, active: true, rotation: 0,
    });
  }
  return {
    round: n, phase: 'ready', elapsed: 0,
    hoop: { x: hoopX, y: hoopY, width: hoopWidth },
    balls, strokes: [], inkUsed: 0, pencils: n === 1 ? 1 : LINE_CAP,
    gem: {
      x: clamp(150 + roundHash(n, 5) * 120, 120, 300),
      y: clamp(250 + roundHash(n, 6) * 160, 230, 430),
    },
    gemCollected: false, message: null,
  };
}
export const remainingPencils = (state: BasketRound) =>
  Math.max(0, state.pencils - state.strokes.length);
export const remainingInk = (state: BasketRound) => Math.max(0, INK_CAP - state.inkUsed);
export function strokeLength(points: Vec[]): number {
  return points.reduce((sum, point, i) =>
    i ? sum + distance(points[i - 1]!, point) : 0, 0);
}
export function addStroke(state: BasketRound, raw: Vec[]): boolean {
  if (!['ready', 'running'].includes(state.phase) || remainingPencils(state) <= 0) return false;
  if (raw.length < 2 || remainingInk(state) < 14) return false;
  const points: Vec[] = [];
  let used = 0;
  const budget = remainingInk(state);
  for (const source of raw) {
    if (!finite(source.x) || !finite(source.y)) continue;
    const point = {
      x: clamp(source.x, 4, COURT_WIDTH - 4),
      y: clamp(source.y, 65, COURT_HEIGHT - 15),
    };
    const prev = points.at(-1);
    if (!prev) { points.push(point); continue; }
    const delta = distance(prev, point);
    if (delta < 1.2) continue;
    if (used + delta >= budget) {
      const t = (budget - used) / delta;
      if (t > 0) points.push({ x: lerp(prev.x, point.x, t), y: lerp(prev.y, point.y, t) });
      used = budget;
      break;
    }
    points.push(point);
    used += delta;
  }
  if (points.length < 2 || used < 14) return false;
  state.strokes.push({ points, length: used });
  state.inkUsed = Math.min(INK_CAP, state.inkUsed + used);
  if (state.phase === 'ready') state.phase = 'running';
  return true;
}

function lineCollision(ball: BallBody, a: Vec, b: Vec): void {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lineSq = dx * dx + dy * dy;
  if (lineSq < .001) return;
  const t = clamp(((ball.x - a.x) * dx + (ball.y - a.y) * dy) / lineSq, 0, 1);
  const px = a.x + dx * t, py = a.y + dy * t;
  let nx = ball.x - px, ny = ball.y - py;
  const dist = Math.hypot(nx, ny);
  const required = ball.radius + 3.8;
  if (dist >= required) return;
  if (dist < .00001) { nx = -dy; ny = dx; }
  const normalLength = Math.hypot(nx, ny);
  nx /= normalLength; ny /= normalLength;
  ball.x += nx * (required - dist + .04);
  ball.y += ny * (required - dist + .04);
  const impact = ball.vx * nx + ball.vy * ny;
  if (impact < 0) {
    const bounce = impact < -85 ? .22 : 0;
    ball.vx -= (1 + bounce) * impact * nx;
    ball.vy -= (1 + bounce) * impact * ny;
    // Small tangential drag limits runaway acceleration on strokes.
    ball.vx *= .997;
    ball.vy *= .997;
  }
}
function collideCircle(ball: BallBody, x: number, y: number, radius: number): void {
  const dx = ball.x - x, dy = ball.y - y;
  const distanceTo = Math.hypot(dx, dy);
  const needed = ball.radius + radius;
  if (distanceTo >= needed) return;
  const nx = distanceTo > .001 ? dx / distanceTo : 0;
  const ny = distanceTo > .001 ? dy / distanceTo : -1;
  const push = needed - distanceTo + .1;
  ball.x += nx * push; ball.y += ny * push;
  const impact = ball.vx * nx + ball.vy * ny;
  if (impact < 0) {
    ball.vx -= impact * 1.38 * nx;
    ball.vy -= impact * 1.38 * ny;
  }
}
/**
 * One fixed deterministic physics step. Mutates only the provided live round.
 * Never passes an arbitrary browser delta into collision detection.
 */
export function stepRound(state: BasketRound, dt = STEP_SECONDS): RoundPhase {
  if (state.phase !== 'running') return state.phase;
  if (!finite(dt) || dt <= 0 || dt > 1 / 30) throw new RangeError('Invalid fixed time step');
  state.elapsed += dt;
  if (state.elapsed > 19) {
    state.phase = 'lost'; state.message = 'time'; return state.phase;
  }
  for (const ball of state.balls) {
    if (!ball.active) continue;
    const previousX = ball.x, previousY = ball.y;
    ball.vy = clamp(ball.vy + 760 * dt, -940, 940);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.rotation += ball.vx * dt / ball.radius;
    for (const line of state.strokes) {
      for (let i = 1; i < line.points.length; i++) {
        lineCollision(ball, line.points[i - 1]!, line.points[i]!);
      }
    }
    // Score on a downward pass through the open inner rim. Avoid accepting
    // shots that enter from below, clip the posts, or enter while moving up.
    const hoop = state.hoop;
    const innerHalf = hoop.width / 2 - ball.radius - 3;
    const ratio = (hoop.y - previousY) / (ball.y - previousY || 1);
    const crossingX = lerp(previousX, ball.x, ratio);
    if (previousY < hoop.y && ball.y >= hoop.y && ball.vy > 0 &&
        Math.abs(crossingX - hoop.x) < innerHalf) {
      if (ball.kind === 'bomb') {
        state.phase = 'lost'; state.message = 'bomb'; return state.phase;
      }
      ball.scored = true;
      ball.active = false;
      continue;
    }
    // Physical rim ends. The net is not a solid obstacle.
    collideCircle(ball, hoop.x - hoop.width / 2, hoop.y + 2, 5.5);
    collideCircle(ball, hoop.x + hoop.width / 2, hoop.y + 2, 5.5);
    if (ball.kind === 'basketball' &&
        !state.gemCollected && Math.hypot(ball.x - state.gem.x, ball.y - state.gem.y) < ball.radius + 13) {
      state.gemCollected = true;
    }
    if (ball.x < -ball.radius - 25 || ball.x > COURT_WIDTH + ball.radius + 25 ||
        ball.y > COURT_HEIGHT + ball.radius + 20) {
      ball.active = false;
      if (ball.kind === 'basketball') {
        state.phase = 'lost'; state.message = 'miss'; return state.phase;
      }
    }
  }
  // Avoid a bomb contacting a basketball: immediate loss.
  for (const bomb of state.balls) {
    if (!bomb.active || bomb.kind !== 'bomb') continue;
    for (const ball of state.balls) {
      if (!ball.active || ball.kind !== 'basketball') continue;
      if (distance(bomb, ball) < bomb.radius + ball.radius - 2) {
        state.phase = 'lost'; state.message = 'bomb'; return state.phase;
      }
    }
  }
  if (state.balls.filter(b => b.kind === 'basketball').every(b => b.scored)) {
    state.phase = 'won';
  }
  return state.phase;
}
export interface BasketProgress {
  /** Next unwon round (the frontier). Rounds 1..round are playable. */
  round: number;
  /** Highest round ever won. */
  best: number;
  /** Total gems banked (legacy totals are preserved on migration). */
  gems: number;
  /** Best star rating per won round: round number -> 1..3. */
  stars: Record<number, number>;
  /** Rounds whose gem has already been banked (a gem counts once). */
  gemRounds: number[];
}
/** Stars for a finished round: 1 for the win, +1 for the gem, +1 for
 *  finishing with at most half the ink budget spent. 0 unless won. */
export function roundStars(state: BasketRound): number {
  if (state.phase !== 'won') return 0;
  let stars = 1;
  if (state.gemCollected) stars++;
  if (state.inkUsed <= INK_CAP / 2) stars++;
  return stars;
}
/** Pure bookkeeping for a won round. Returns a new progress object.
 *  Replaying an old round improves its stars and can bank its gem once,
 *  but only winning the frontier round advances the frontier. */
export function applyWin(progress: BasketProgress, finished: BasketRound): BasketProgress {
  const next: BasketProgress = {
    ...progress,
    stars: { ...progress.stars },
    gemRounds: [...progress.gemRounds],
  };
  const stars = roundStars(finished);
  if (stars > (next.stars[finished.round] ?? 0)) next.stars[finished.round] = stars;
  next.best = Math.max(next.best, finished.round);
  if (finished.gemCollected && !next.gemRounds.includes(finished.round)) {
    next.gemRounds.push(finished.round);
    next.gems = clamp(next.gems + 1, 0, 99999);
  }
  if (finished.round === next.round) next.round = Math.min(9999, finished.round + 1);
  return next;
}
export function validateProgress(value: unknown): BasketProgress {
  const empty: BasketProgress = { round: 1, best: 0, gems: 0, stars: {}, gemRounds: [] };
  if (!value || typeof value !== 'object') return empty;
  const saved = value as Record<string, unknown>;
  const round = typeof saved.round === 'number' && Number.isSafeInteger(saved.round) ?
    clamp(saved.round, 1, 9999) : 1;
  const best = typeof saved.best === 'number' && Number.isSafeInteger(saved.best) ?
    clamp(saved.best, 0, 9999) : 0;
  const gems = typeof saved.gems === 'number' && Number.isSafeInteger(saved.gems) ?
    clamp(saved.gems, 0, 99999) : 0;
  const stars: Record<number, number> = {};
  if (saved.stars && typeof saved.stars === 'object' && !Array.isArray(saved.stars)) {
    for (const [key, val] of Object.entries(saved.stars as Record<string, unknown>)) {
      const roundNo = Number(key);
      if (Number.isSafeInteger(roundNo) && roundNo >= 1 && roundNo <= 9999 &&
          typeof val === 'number' && Number.isFinite(val) && Math.floor(val) >= 1) {
        stars[roundNo] = Math.min(3, Math.floor(val));
      }
      if (Object.keys(stars).length >= 9999) break;
    }
  }
  const gemRounds: number[] = [];
  if (Array.isArray(saved.gemRounds)) {
    for (const entry of saved.gemRounds) {
      if (typeof entry === 'number' && Number.isSafeInteger(entry) &&
          entry >= 1 && entry <= 9999 && !gemRounds.includes(entry)) {
        gemRounds.push(entry);
      }
      if (gemRounds.length >= 9999) break;
    }
    gemRounds.sort((a, b) => a - b);
  }
  return { round, best, gems, stars, gemRounds };
}

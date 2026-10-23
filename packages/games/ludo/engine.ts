/** Pure NAQLA Ludo domain. No UI, clock, network or random-number dependencies. */
export type SeatCount = 4 | 6 | 8 | 10;
export type LudoProfile = 'classic' | 'fast';
export type Controller = 'human' | 'ai';
export type Phase = 'roll' | 'move' | 'finished';
export type LudoToken = { id: string; seat: number; slot: number; progress: number };
export type Placement = { seat: number; rank: number; reason: 'completed' | 'resigned' | 'remaining' };
export type LudoMove = {
  tokenId: string;
  from: number;
  to: number;
  destination: string;
  captures: number;
  finishes: boolean;
};
export interface LudoState {
  schemaVersion: 2;
  seatCount: SeatCount;
  profile: LudoProfile;
  controllers: Controller[];
  tokens: LudoToken[];
  placements: Placement[];
  activeSeat: number;
  phase: Phase;
  die: number | null;
  sixes: number;
  revision: number;
  lastEvent: string;
}
const SUPPORTED = [4, 6, 8, 10];
/** 4/6 seats use four pawns, 8 seats use two, 10 seats use one. */
export const tokensPerSeat = (count: SeatCount): number => {
  assertSeatCount(count);
  return count <= 6 ? 4 : count === 8 ? 2 : 1;
};
export const circuitSize = (count: SeatCount) => 13 * count;
export const finishProgress = (count: SeatCount) => circuitSize(count) + 4;
export function assertSeatCount(value: number): asserts value is SeatCount {
  if (!SUPPORTED.includes(value)) throw new RangeError('unsupported-ludo-seat-count');
}
export const isSafe = (count: SeatCount, index: number) =>
  Number.isInteger(index) && index >= 0 && index < circuitSize(count) &&
  (index % 13 === 0 || index % 13 === 8);
export function routeFor(count: SeatCount, seat: number): string[] {
  assertSeatCount(count);
  if (!Number.isInteger(seat) || seat < 0 || seat >= count) throw new RangeError('invalid-seat');
  const C = circuitSize(count);
  return [
    ...Array.from({ length: C - 1 }, (_, progress) => 'c:' + ((13 * seat + progress) % C)),
    ...Array.from({ length: 5 }, (_, i) => 'home:' + seat + ':' + i),
    'finish:' + seat,
  ];
}
export function nodeFor(state: LudoState, token: LudoToken): string {
  if (token.progress === -2) return 'withdrawn:' + token.id;
  if (token.progress === -1) return 'base:' + token.seat + ':' + token.slot;
  return routeFor(state.seatCount, token.seat)[token.progress]!;
}
export function createLudo(
  count: SeatCount,
  controllers: readonly Controller[] = Array(count).fill('human'),
  profile: LudoProfile = 'classic',
  startSeat = 0,
): LudoState {
  assertSeatCount(count);
  if (controllers.length !== count || controllers.some(x => x !== 'human' && x !== 'ai'))
    throw new RangeError('invalid-controllers');
  if (profile !== 'classic' && profile !== 'fast') throw new RangeError('invalid-profile');
  if (!Number.isInteger(startSeat) || startSeat < 0 || startSeat >= count)
    throw new RangeError('invalid-start-seat');
  return {
    schemaVersion: 2, seatCount: count, profile, controllers: [...controllers],
    tokens: Array.from({ length: count * tokensPerSeat(count) }, (_, i) => ({
      id: String(Math.floor(i / tokensPerSeat(count))) + ':' + (i % tokensPerSeat(count)),
      seat: Math.floor(i / tokensPerSeat(count)), slot: i % tokensPerSeat(count), progress: -1,
    })),
    placements: [], activeSeat: startSeat, phase: 'roll', die: null,
    sixes: 0, revision: 0, lastEvent: 'started',
  };
}
function fail(code: string): never { throw new Error(code); }
function rank(state: LudoState, seat: number, reason: Placement['reason']): void {
  const occupied = new Set(state.placements.map(p => p.rank));
  const remaining = Array.from({ length: state.seatCount }, (_, i) => i + 1)
    .filter(n => !occupied.has(n));
  const number = reason === 'resigned' ? remaining[remaining.length - 1] : remaining[0];
  if (number === undefined || state.placements.some(p => p.seat === seat)) fail('already-ranked');
  state.placements.push({ seat, rank: number, reason });
}
function settle(state: LudoState, bonus: boolean, event: string): LudoState {
  const active = Array.from({ length: state.seatCount }, (_, i) => i)
    .filter(i => !state.placements.some(p => p.seat === i));
  if (active.length <= 1) {
    if (active.length === 1) rank(state, active[0]!, 'remaining');
    state.phase = 'finished';
    state.die = null;
    state.sixes = 0;
    state.lastEvent = 'finished';
    return state;
  }
  if (!bonus || !active.includes(state.activeSeat)) {
    for (let j = 1; j <= state.seatCount; j++) {
      const seat = (state.activeSeat + j) % state.seatCount;
      if (active.includes(seat)) { state.activeSeat = seat; break; }
    }
    state.sixes = 0;
  }
  state.phase = 'roll';
  state.die = null;
  state.lastEvent = event;
  return state;
}
export function legalMoves(state: LudoState): LudoMove[] {
  if (state.phase !== 'move' || state.die === null) return [];
  const F = finishProgress(state.seatCount);
  const path = routeFor(state.seatCount, state.activeSeat);
  const die = state.die;
  return state.tokens.filter(t => t.seat === state.activeSeat).flatMap(token => {
    const to = token.progress === -1 ? (die === 6 ? 0 : -1) : token.progress >= 0 ? token.progress + die : F + 1;
    if (to < 0 || to > F) return [];
    const destination = path[to]!;
    const captures = destination.startsWith('c:') && !isSafe(state.seatCount, Number(destination.slice(2)))
      ? state.tokens.filter(t => t.seat !== token.seat && nodeFor(state, t) === destination).length : 0;
    return [{ tokenId: token.id, from: token.progress, to, destination, captures, finishes: to === F }];
  });
}
export function rollLudo(state: LudoState, die: number): LudoState {
  if (state.phase !== 'roll') fail('wrong-phase');
  if (!Number.isInteger(die) || die < 1 || die > 6) fail('invalid-die');
  const next: LudoState = { ...state, revision: state.revision + 1, sixes: die === 6 ? state.sixes + 1 : 0, die, phase: 'move', lastEvent: 'rolled:' + die };
  if (next.sixes === 3) return settle(next, false, 'third-six');
  if (legalMoves(next).length === 0) return settle(next, die === 6, 'no-move');
  return next;
}
export function moveLudo(state: LudoState, tokenId: string): LudoState {
  if (state.phase !== 'move') fail('wrong-phase');
  const move = legalMoves(state).find(m => m.tokenId === tokenId);
  if (!move) fail('illegal-move');
  const tokens = state.tokens.map(t => ({ ...t }));
  const token = tokens.find(t => t.id === tokenId)!;
  token.progress = move.to;
  const next: LudoState = { ...state, tokens, placements: [...state.placements], revision: state.revision + 1 };
  let captures = 0;
  if (move.destination.startsWith('c:') && !isSafe(state.seatCount, Number(move.destination.slice(2)))) {
    for (const enemy of tokens) {
      if (enemy.seat !== token.seat && enemy.progress >= 0 && enemy.progress < finishProgress(state.seatCount) &&
        nodeFor(next, enemy) === move.destination) {
        enemy.progress = -1;
        captures++;
      }
    }
  }
  const goal = Math.min(tokensPerSeat(state.seatCount), state.profile === 'fast' ? 2 : 4);
  if (move.finishes && tokens.filter(t => t.seat === token.seat && t.progress === finishProgress(state.seatCount)).length >= goal) {
    rank(next, token.seat, 'completed');
    if (goal < tokensPerSeat(state.seatCount))
      for (const unused of tokens) if (unused.seat === token.seat && unused.progress < finishProgress(state.seatCount)) unused.progress = -2;
  }
  const bonus = state.die === 6 || captures > 0 || move.finishes;
  return settle(next, bonus, captures ? 'captured:' + captures : move.finishes ? 'token-finished' : 'moved');
}
export function resignLudo(state: LudoState, seat: number): LudoState {
  if (state.phase === 'finished') fail('game-over');
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.seatCount || state.placements.some(p => p.seat === seat)) fail('invalid-resignation');
  const tokens = state.tokens.map(t => t.seat === seat && t.progress < finishProgress(state.seatCount) ? { ...t, progress: -2 } : { ...t });
  const next: LudoState = { ...state, tokens, placements: [...state.placements], revision: state.revision + 1 };
  rank(next, seat, 'resigned');
  if (seat !== state.activeSeat && next.placements.length < next.seatCount - 1) {
    next.lastEvent = 'resigned';
    return next; // Do not consume another participant's pending die or turn.
  }
  return settle(next, false, 'resigned');
}
export function validateLudo(state: LudoState): void {
  if (!state || state.schemaVersion !== 2) fail('invalid-save');
  assertSeatCount(state.seatCount);
  if (state.profile !== 'classic' && state.profile !== 'fast') fail('invalid-profile');
  if (!Array.isArray(state.controllers) || state.controllers.length !== state.seatCount ||
    state.controllers.some(x => x !== 'human' && x !== 'ai')) fail('invalid-controllers');
  const slots = tokensPerSeat(state.seatCount);
  if (!Array.isArray(state.tokens) || state.tokens.length !== state.seatCount * slots) fail('invalid-tokens');
  const F = finishProgress(state.seatCount);
  for (let i = 0; i < state.tokens.length; i++) {
    const t = state.tokens[i]!;
    if (t.id !== Math.floor(i / slots) + ':' + (i % slots) || t.seat !== Math.floor(i / slots) || t.slot !== i % slots ||
      !Number.isInteger(t.progress) || t.progress < -2 || t.progress > F) fail('invalid-token');
  }
  if (!Number.isInteger(state.activeSeat) || state.activeSeat < 0 || state.activeSeat >= state.seatCount) fail('invalid-active-seat');
  if (!Number.isInteger(state.revision) || state.revision < 0) fail('invalid-revision');
  if (!Number.isInteger(state.sixes) || state.sixes < 0 || state.sixes > 2) fail('invalid-six-counter');
  if (!Array.isArray(state.placements) || state.placements.some(p => !Number.isInteger(p.seat) || p.seat < 0 ||
    p.seat >= state.seatCount || !Number.isInteger(p.rank) || p.rank < 1 || p.rank > state.seatCount ||
    !['completed', 'remaining', 'resigned'].includes(p.reason)) ||
    new Set(state.placements.map(p => p.rank)).size !== state.placements.length ||
    new Set(state.placements.map(p => p.seat)).size !== state.placements.length) fail('invalid-placements');
  if (!['roll', 'move', 'finished'].includes(state.phase) ||
    (state.phase === 'move' && (!Number.isInteger(state.die) || state.die! < 1 || state.die! > 6)) ||
    (state.phase !== 'move' && state.die !== null)) fail('invalid-phase');
  if (state.phase !== 'finished' && state.placements.some(p => p.seat === state.activeSeat)) fail('invalid-active-seat');
  if (state.phase === 'finished' && state.placements.length !== state.seatCount) fail('incomplete-results');
}

/** Old four/six-player sessions keep their original token IDs and progress. */
export function restoreLudo(source: unknown): LudoState {
  if (!source || typeof source !== 'object') fail('invalid-save');
  const saved = source as Omit<LudoState, 'schemaVersion'> & { schemaVersion: number };
  if (saved.schemaVersion === 1) {
    // Eight/ten-player legacy saves had four pawns per seat. Trimming them would
    // silently change an in-progress match; leave those saves untouched instead.
    if (saved.seatCount !== 4 && saved.seatCount !== 6) fail('legacy-board-requires-new-match');
    const migrated = { ...saved, schemaVersion: 2 as const };
    validateLudo(migrated);
    return migrated;
  }
  validateLudo(saved as LudoState);
  return saved as LudoState;
}

export function chooseAiToken(state: LudoState, difficulty: 'easy' | 'medium' | 'hard', random: () => number): string {
  const moves = legalMoves(state);
  if (!moves.length) fail('no-legal-moves');
  // Easy plays randomly most of the time: casual and beatable, but not
  // hopeless (at 80% random with the old scoring it won ~6% vs three
  // mediums; see docs/ludo-ai-measurement.md for the measured ladder).
  if (difficulty === 'easy' && random() < 0.7) return moves[Math.floor(random() * moves.length)]!.tokenId;
  const F = finishProgress(state.seatCount);
  const C = circuitSize(state.seatCount);
  /** Enemies of `seat` that could capture on circuit cell `index` next turn. */
  function threatsBehind(index: number, seat: number): number {
    let danger = 0;
    for (const enemy of state.tokens) {
      if (enemy.seat === seat || enemy.progress < 0 || enemy.progress >= F) continue;
      const distance = routeFor(state.seatCount, enemy.seat).indexOf('c:' + index) - enemy.progress;
      if (distance >= 1 && distance <= 6) danger++;
    }
    return danger;
  }
  function score(move: LudoMove): number {
    const target = state.tokens.find(t => t.id === move.tokenId)!;
    const destIndex = move.destination.startsWith('c:') ? Number(move.destination.slice(2)) : -1;
    const safe = destIndex >= 0 && isSafe(state.seatCount, destIndex);
    const completed = move.finishes && state.tokens.filter(t => t.seat === target.seat && t.progress === F).length + 1 >= Math.min(tokensPerSeat(state.seatCount), state.profile === 'fast' ? 2 : 4);
    // Captures are worth the victim's advancement: sending home a pawn that
    // nearly finished hurts far more than catching one that just left base.
    let captureValue = 0;
    if (move.captures > 0 && destIndex >= 0) {
      for (const victim of state.tokens) {
        if (victim.seat !== target.seat && victim.progress >= 0 && nodeFor(state, victim) === move.destination)
          captureValue += 30 + victim.progress;
      }
    }
    // Escaping: a pawn already inside an enemy's capture range gains value
    // by moving at all — medium notices, hard values it more.
    let escapeValue = 0;
    if (move.from >= 0) {
      const currentNode = nodeFor(state, target);
      if (currentNode.startsWith('c:')) {
        const currentIndex = Number(currentNode.slice(2));
        if (!isSafe(state.seatCount, currentIndex))
          escapeValue = threatsBehind(currentIndex, target.seat) * (difficulty === 'hard' ? 13 : 9);
      }
    }
    let value = (completed ? 1000 : 0) + (move.finishes ? 120 : 0) + captureValue + escapeValue
      + (safe ? 10 : 0) + (move.from === -1 ? 14 : 0) + (move.to >= C - 1 ? 15 : 0)
      + (move.to - Math.max(0, move.from)) * 12 / F + move.to * 0.12;
    if (difficulty === 'hard' && destIndex >= 0 && !safe) {
      const danger = threatsBehind(destIndex, target.seat);
      value -= danger * 18;
      // Stacking onto your own pawn on an unsafe cell risks losing both to a
      // single capture (this engine captures whole stacks), so hard avoids
      // forming a threatened stack.
      const stacked = state.tokens.some(t => t.seat === target.seat && t.id !== target.id && t.progress >= 0 && nodeFor(state, t) === move.destination);
      if (stacked && danger > 0) value -= 30;
    }
    return value;
  }
  return [...moves].sort((a, b) => score(b) - score(a) || a.tokenId.localeCompare(b.tokenId))[0]!.tokenId;
}
/** Uniform six-sided die. Dice are generated at the local authority boundary only. */
export function secureDie(source: (array: Uint8Array) => Uint8Array): number {
  const buffer = new Uint8Array(1);
  for (let tries = 0; tries < 1024; tries++) {
    const byte = source(buffer)[0]!;
    if (byte < 252) return (byte % 6) + 1;
  }
  fail('secure-rng-unavailable');
}

/** Uniform first-seat selection independent from the six-sided die. */
export function secureSeat(count: SeatCount, source: (array: Uint8Array) => Uint8Array): number {
  assertSeatCount(count);
  const limit = Math.floor(256 / count) * count;
  const bytes = new Uint8Array(1);
  for (let i = 0; i < 1024; i++) {
    const byte = source(bytes)[0]!;
    if (byte < limit) return byte % count;
  }
  fail('secure-rng-unavailable');
}

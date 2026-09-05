import {
  RuleError,
  isGameOver,
  opponent,
  type Player,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  createMorris,
  morrisPosition,
  MORRIS_MILLS,
  MORRIS_EDGES,
  type MorrisState,
  type MorrisMove,
} from './state.ts';
const point = (i: number) => Number.isInteger(i) && i >= 0 && i < 24;
export const morrisCount = (s: MorrisState, p: Player) => s.board.filter((c) => c === p).length;
export const inMill = (s: MorrisState, at: number) =>
  s.board[at] !== null &&
  MORRIS_MILLS.some((line) => line.includes(at) && line.every((i) => s.board[i] === s.board[at]));
export function captureTargets(s: MorrisState): number[] {
  const other = s.board.flatMap((p, i) => (p === opponent(s.turn) ? [i] : []));
  const outside = other.filter((i) => !inMill(s, i));
  return outside.length ? outside : other;
}
export function parseMorrisMove(input: unknown): MorrisMove {
  if (!input || typeof input !== 'object') throw new RuleError('invalid-move');
  const m = input as MorrisMove,
    keys = Object.keys(m);
  if (m.kind === 'place' && keys.length === 2 && point(m.to)) return { kind: m.kind, to: m.to };
  if (m.kind === 'move' && keys.length === 3 && point(m.from) && point(m.to))
    return { kind: m.kind, from: m.from, to: m.to };
  if (m.kind === 'capture' && keys.length === 2 && point(m.at)) return { kind: m.kind, at: m.at };
  throw new RuleError('invalid-move');
}
export function morrisLegalMoves(s: MorrisState): MorrisMove[] {
  if (isGameOver(s)) return [];
  if (s.capturing) return captureTargets(s).map((at) => ({ kind: 'capture', at }));
  const empty = s.board.flatMap((p, i) => (p === null ? [i] : []));
  if (s.remaining.some((n) => n > 0))
    return s.remaining[s.turn] > 0 ? empty.map((to) => ({ kind: 'place', to })) : [];
  const own = s.board.flatMap((p, i) => (p === s.turn ? [i] : []));
  if (own.length < 3) return [];
  return own.flatMap((from) =>
    empty
      .filter(
        (to) =>
          own.length === 3 ||
          MORRIS_EDGES.some(([a, b]) => (a === from && b === to) || (b === from && a === to)),
      )
      .map((to) => ({ kind: 'move' as const, from, to })),
  );
}
export function validateMorris(s: MorrisState, m: MorrisMove): Validation {
  let parsed: MorrisMove;
  try {
    parsed = parseMorrisMove(m);
  } catch {
    return { ok: false, code: 'invalid-move' };
  }
  if (isGameOver(s)) return { ok: false, code: 'game-over' };
  return morrisLegalMoves(s).some(
    (candidate) => JSON.stringify(candidate) === JSON.stringify(parsed),
  )
    ? { ok: true }
    : { ok: false, code: s.capturing ? 'capture-outside-mill' : 'illegal-morris-move' };
}
export function applyMorris(s: MorrisState, m: MorrisMove): MorrisState {
  const v = validateMorris(s, m);
  if (!v.ok) throw new RuleError(v.code);
  const next: MorrisState = {
    ...s,
    board: [...s.board],
    remaining: [...s.remaining],
    ply: s.ply + 1,
    capturing: false,
  };
  if (m.kind === 'capture') next.board[m.at] = null;
  else {
    if (m.kind === 'move') next.board[m.from] = null;
    else next.remaining[s.turn]--;
    next.board[m.to] = s.turn;
    next.lastMove = m.to;
    if (inMill(next, m.to) && captureTargets(next).length) {
      next.capturing = true;
      return next;
    }
  }
  next.turn = opponent(s.turn);
  const key = morrisPosition(next);
  next.positions = m.kind === 'capture' || m.kind === 'place' ? [key] : [...s.positions, key];
  // Reserves count toward survival; no early loss while pieces still need placing.
  if (
    morrisCount(next, next.turn) + next.remaining[next.turn] < 3 ||
    (next.remaining.every((n) => n === 0) && !morrisLegalMoves(next).length)
  )
    next.winner = s.turn;
  else if (next.positions.filter((p) => p === key).length >= 3)
    next.drawReason = 'threefold-repetition';
  return next;
}
export const morrisEngine: RulesEngine<MorrisState, MorrisMove> = {
  id: 'nineMensMorris',
  winReason: 'morris-win',
  create: createMorris,
  parseMove: parseMorrisMove,
  validate: validateMorris,
  apply: applyMorris,
  legalMoves: morrisLegalMoves,
  evaluate: (s, p) => {
    let value =
      (morrisCount(s, p) +
        s.remaining[p] -
        morrisCount(s, opponent(p)) -
        s.remaining[opponent(p)]) *
      100;
    for (const line of MORRIS_MILLS) {
      const own = line.filter((i) => s.board[i] === p).length,
        other = line.filter((i) => s.board[i] === opponent(p)).length;
      if (!other) value += [0, 2, 18, 40][own];
      if (!own) value -= [0, 2, 18, 40][other];
    }
    if (s.capturing) value += s.turn === p ? 100 : -100;
    return value;
  },
};

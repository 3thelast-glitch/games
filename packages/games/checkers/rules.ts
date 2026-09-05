import {
  RuleError,
  isGameOver,
  opponent,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  createCheckers,
  checkersPosition,
  type CheckersState,
  type CheckersMove,
} from './state.ts';
const dark = (i: number) =>
  Number.isInteger(i) && i >= 0 && i < 64 && (Math.floor(i / 8) + (i % 8)) % 2 === 1;
export function parseCheckersMove(input: unknown): CheckersMove {
  if (!input || typeof input !== 'object') throw new RuleError('invalid-move');
  const m = input as CheckersMove;
  if (Object.keys(m).length !== 2 || !dark(m.from) || !dark(m.to))
    throw new RuleError('invalid-move');
  return { from: m.from, to: m.to };
}
function targets(s: CheckersState, from: number, capture: boolean): CheckersMove[] {
  const p = s.board[from];
  if (!p || p.owner !== s.turn) return [];
  const row = Math.floor(from / 8),
    col = from % 8,
    distance = capture ? 2 : 1;
  const result: CheckersMove[] = [];
  for (const dr of p.king ? [-1, 1] : [p.owner === 0 ? -1 : 1])
    for (const dc of [-1, 1]) {
      const r = row + dr * distance,
        c = col + dc * distance,
        to = r * 8 + c;
      if (r < 0 || r > 7 || c < 0 || c > 7 || s.board[to] !== null) continue;
      if (!capture || s.board[(row + dr) * 8 + col + dc]?.owner === opponent(s.turn))
        result.push({ from, to });
    }
  return result;
}
export function checkersLegalMoves(s: CheckersState): CheckersMove[] {
  if (isGameOver(s)) return [];
  if (s.forcedFrom !== null) return targets(s, s.forcedFrom, true);
  const own = s.board.flatMap((p, i) => (p?.owner === s.turn ? [i] : []));
  const captures = own.flatMap((i) => targets(s, i, true));
  return captures.length ? captures : own.flatMap((i) => targets(s, i, false));
}
export function validateCheckers(s: CheckersState, m: CheckersMove): Validation {
  try {
    parseCheckersMove(m);
  } catch {
    return { ok: false, code: 'invalid-move' };
  }
  if (isGameOver(s)) return { ok: false, code: 'game-over' };
  return checkersLegalMoves(s).some((x) => x.from === m.from && x.to === m.to)
    ? { ok: true }
    : { ok: false, code: s.forcedFrom !== null ? 'continue-capture' : 'illegal-checkers-move' };
}
export function applyCheckers(s: CheckersState, m: CheckersMove): CheckersState {
  const v = validateCheckers(s, m);
  if (!v.ok) throw new RuleError(v.code);
  const piece = s.board[m.from]!,
    row = Math.floor(m.to / 8);
  const capture = Math.abs(row - Math.floor(m.from / 8)) === 2;
  const promoted = !piece.king && row === (piece.owner === 0 ? 0 : 7);
  const next: CheckersState = {
    ...s,
    board: [...s.board],
    ply: s.ply + 1,
    forcedFrom: null,
    lastMove: { ...m },
  };
  next.board[m.from] = null;
  next.board[m.to] = { ...piece, king: piece.king || promoted };
  if (capture) next.board[(m.from + m.to) / 2] = null;
  next.quietTurns = capture || !piece.king ? 0 : s.quietTurns + 1;
  if (capture && !promoted && targets(next, m.to, true).length) {
    next.forcedFrom = m.to;
    // A jump is a command, but the same player owns the clock until the chain ends.
    next.positions = [];
    return next;
  }
  next.turn = opponent(s.turn);
  if (!checkersLegalMoves(next).length) next.winner = s.turn;
  const key = checkersPosition(next);
  next.positions = capture || !piece.king ? [key] : [...s.positions, key];
  if (next.winner === null) {
    if (next.positions.filter((p) => p === key).length >= 3)
      next.drawReason = 'threefold-repetition';
    else if (next.quietTurns >= 80) next.drawReason = 'forty-move-rule';
  }
  return next;
}
export const checkersEngine: RulesEngine<CheckersState, CheckersMove> = {
  id: 'checkers',
  winReason: 'checkers-win',
  create: createCheckers,
  parseMove: parseCheckersMove,
  validate: validateCheckers,
  apply: applyCheckers,
  legalMoves: checkersLegalMoves,
  evaluate: (s, player) =>
    s.board.reduce((score, piece, i) => {
      if (!piece) return score;
      const row = Math.floor(i / 8),
        col = i % 8;
      const value =
        (piece.king ? 180 : 100 + (piece.owner === 0 ? 7 - row : row) * 5) +
        (col > 1 && col < 6 ? 4 : 0);
      return score + (piece.owner === player ? value : -value);
    }, 0),
};

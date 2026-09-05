import {
  RuleError,
  opponent,
  type Player,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  addHex,
  createAbalone,
  DIRECTIONS,
  fromKey,
  hexKey,
  onBoard,
  type AbaloneMove,
  type AbaloneState,
  type Hex,
  type Motion,
} from './state.ts';
export function parseAbaloneMove(input: unknown): AbaloneMove {
  if (!input || typeof input !== 'object') throw new RuleError('invalid-move');
  const m = input as AbaloneMove;
  if (
    Object.keys(input).some((k) => !['marbles', 'direction'].includes(k)) ||
    !Number.isInteger(m.direction) ||
    m.direction < 0 ||
    m.direction > 5 ||
    !Array.isArray(m.marbles) ||
    m.marbles.length < 1 ||
    m.marbles.length > 3 ||
    !m.marbles.every((p) => Array.isArray(p) && p.length === 2 && onBoard(p))
  )
    throw new RuleError('invalid-move');
  return m;
}
function isLine(group: Hex[]): boolean {
  const keys = new Set(group.map(hexKey));
  return (
    group.length === 1 ||
    DIRECTIONS.some((d) =>
      group.some((start) => {
        let point = start;
        for (let i = 0; i < group.length; i++) {
          if (!keys.has(hexKey(point))) return false;
          point = addHex(point, d);
        }
        return true;
      }),
    )
  );
}
function plan(state: AbaloneState, input: AbaloneMove): Motion[] {
  const move = parseAbaloneMove(input);
  if (state.winner !== null) throw new RuleError('game-over');
  const selected = new Set(move.marbles.map(hexKey));
  if (selected.size !== move.marbles.length) throw new RuleError('duplicate-selection');
  if (move.marbles.some((p) => state.board[hexKey(p)]?.owner !== state.turn))
    throw new RuleError('not-your-piece');
  if (!isLine(move.marbles)) throw new RuleError('select-straight-line');
  const direction = DIRECTIONS[move.direction];
  const own: Motion[] = move.marbles.map((from) => ({
    marble: state.board[hexKey(from)],
    from,
    to: addHex(from, direction),
    ejected: false,
  }));
  if (own.some((step) => !onBoard(step.to))) throw new RuleError('own-piece-off-board');
  const inline =
    move.marbles.length === 1 ||
    own.filter((step) => selected.has(hexKey(step.to))).length === move.marbles.length - 1;
  if (!inline) {
    if (own.some((step) => state.board[hexKey(step.to)])) throw new RuleError('sidestep-blocked');
    return own;
  }
  const front = own.find((step) => !selected.has(hexKey(step.to)))!;
  const pushed: Motion[] = [];
  let point = front.to;
  while (onBoard(point) && state.board[hexKey(point)]) {
    const marble = state.board[hexKey(point)];
    if (marble.owner === state.turn) throw new RuleError('push-blocked');
    const to = addHex(point, direction);
    pushed.push({ marble, from: point, to, ejected: !onBoard(to) });
    if (pushed.length >= own.length) throw new RuleError('insufficient-strength');
    point = to;
  }
  return [...own, ...pushed];
}
export function validateAbalone(state: AbaloneState, move: AbaloneMove): Validation {
  try {
    plan(state, move);
    return { ok: true };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, code: error.code };
    throw error;
  }
}
export function applyAbalone(state: AbaloneState, move: AbaloneMove): AbaloneState {
  const steps = plan(state, move),
    board = { ...state.board },
    captured: [number, number] = [...state.captured];
  for (const step of steps) delete board[hexKey(step.from)];
  for (const step of steps) {
    if (step.ejected) captured[state.turn]++;
    else board[hexKey(step.to)] = step.marble;
  }
  return {
    ...state,
    board,
    captured,
    lastMove: steps,
    ply: state.ply + 1,
    turn: opponent(state.turn),
    winner: captured[state.turn] >= 6 ? state.turn : null,
  };
}
export function abaloneLegalMoves(state: AbaloneState): AbaloneMove[] {
  if (state.winner !== null) return [];
  const groups: Hex[][] = [];
  for (const [key, marble] of Object.entries(state.board))
    if (marble.owner === state.turn) {
      const start = fromKey(key);
      groups.push([start]);
      for (const d of DIRECTIONS.slice(0, 3)) {
        const group = [start];
        let next = addHex(start, d);
        for (let n = 2; n <= 3 && state.board[hexKey(next)]?.owner === state.turn; n++) {
          group.push(next);
          groups.push([...group]);
          next = addHex(next, d);
        }
      }
    }
  return groups
    .flatMap((marbles) => DIRECTIONS.map((_, direction) => ({ marbles, direction })))
    .filter((move) => validateAbalone(state, move).ok);
}
export function evaluateAbalone(state: AbaloneState, player: Player): number {
  let score = (state.captured[player] - state.captured[opponent(player)]) * 200;
  for (const [key, marble] of Object.entries(state.board)) {
    const p = fromKey(key),
      distance = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[0] + p[1]));
    const neighbors = DIRECTIONS.filter(
      (d) => state.board[hexKey(addHex(p, d))]?.owner === marble.owner,
    ).length;
    score +=
      (marble.owner === player ? 1 : -1) *
      ((4 - distance) * 5 + neighbors * 2 - (distance === 4 ? 7 : 0));
  }
  return score;
}
export const abaloneEngine: RulesEngine<AbaloneState, AbaloneMove> = {
  id: 'abalone',
  winReason: 'ejection',
  create: createAbalone,
  parseMove: parseAbaloneMove,
  validate: validateAbalone,
  apply: applyAbalone,
  legalMoves: abaloneLegalMoves,
  evaluate: evaluateAbalone,
};

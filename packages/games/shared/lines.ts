import type { Player } from '../../core/src/game.ts';
export type Cell = Player | null;
export const directions = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;
export function lineThrough(
  board: Cell[],
  rows: number,
  cols: number,
  at: number,
  length: number,
): number[] {
  const owner = board[at];
  if (owner === null) return [];
  const row = Math.floor(at / cols),
    col = at % cols;
  for (const [dr, dc] of directions) {
    const line = [at];
    for (const sign of [-1, 1]) {
      for (
        let r = row + dr * sign, c = col + dc * sign;
        r >= 0 && r < rows && c >= 0 && c < cols && board[r * cols + c] === owner;
        r += dr * sign, c += dc * sign
      ) {
        if (sign < 0) line.unshift(r * cols + c);
        else line.push(r * cols + c);
      }
    }
    if (line.length >= length) return line;
  }
  return [];
}
const cache = new Map<string, number[][]>();
function windows(rows: number, cols: number, length: number) {
  const key = `${rows}:${cols}:${length}`;
  if (cache.has(key)) return cache.get(key)!;
  const result: number[][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of directions) {
        const endR = r + dr * (length - 1),
          endC = c + dc * (length - 1);
        if (endR >= 0 && endR < rows && endC >= 0 && endC < cols)
          result.push(Array.from({ length }, (_, n) => (r + dr * n) * cols + c + dc * n));
      }
    }
  cache.set(key, result);
  return result;
}
// Score open winning windows; an immediately playable opponent threat outranks development.
export function evaluateLines(
  board: Cell[],
  rows: number,
  cols: number,
  length: number,
  player: Player,
  turn: Player,
  gravity = false,
) {
  let score = 0;
  for (const line of windows(rows, cols, length)) {
    let own = 0,
      other = 0,
      empty = -1;
    for (const i of line) {
      if (board[i] === player) own++;
      else if (board[i] !== null) other++;
      else empty = i;
    }
    if (own && other) continue;
    const count = own || other;
    if (!count) continue;
    let value = Math.pow(7, count);
    const owner = own ? player : ((1 - player) as Player);
    if (
      count === length - 1 &&
      (!gravity || empty >= cols * (rows - 1) || board[empty + cols] !== null)
    )
      value = turn === owner ? 20000 : 4000;
    score += own ? value : -value;
  }
  return Math.max(-80000, Math.min(80000, score));
}

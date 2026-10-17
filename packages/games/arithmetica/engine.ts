/**
 * ArithmeticA-inspired original offline math sprint for NAQLA.
 * Self-contained deterministic math questions, no copied levels/assets.
 * All time is expressed as milliseconds; wall clock stays in UI.
 */
export type Operation = '+' | '-' | '×' | '÷';
export type Answer = { value: number; correct: boolean };
export type Question = {
  id: number; level: number; left: number; right: number;
  op: Operation; result: number; choices: [number, number]; correctIndex: 0 | 1;
};
export type Phase = 'ready' | 'playing' | 'gameover' | 'paused';
export type Feedback = 'correct' | 'wrong' | null;
export interface MathRun {
  seed: number; score: number; correct: number; mistakes: number;
  level: number; stars: number; timeMs: number; maxTimeMs: number;
  phase: Phase; feedback: Feedback; question: Question;
  answered: number; elapsedMs: number; streak: number;
}
export interface MathRecord {
  bestScore: number; bestLevel: number; bestStreak: number;
  totalSolved: number; plays: number;
}
export const INITIAL_TIME_MS = 32000;
export const MAX_TIME_MS = 60000;
export const RIGHT_BONUS_MS = 2700;
export const WRONG_PENALTY_MS = 4300;
export const QUESTIONS_PER_LEVEL = 5;
export const SAVE_KEY = 'arithmetica-offline-v1';
export const defaultMathRecord = (): MathRecord => ({
  bestScore: 0, bestLevel: 1, bestStreak: 0, totalSolved: 0, plays: 0,
});
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
function random(seed: number) {
  let x = seed | 0;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 1000000) / 1000000;
  };
}
export function makeQuestion(seed: number, id: number): Question {
  const safeId = Math.max(0, Math.floor(Number.isFinite(id) ? id : 0));
  const level = 1 + Math.floor(safeId / QUESTIONS_PER_LEVEL);
  const rnd = random((seed ^ Math.imul(safeId + 1, 0x45d9f3b)) | 0 || 1234567);
  const pick = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
  // The original primarily uses addition/subtraction. Increase magnitude with level.
  // An extended operation enters only in late levels, keeping the first rounds familiar.
  const ops: Operation[] = level < 10 ? ['+', '-'] : level < 20 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = ops[pick(0, ops.length - 1)]!;
  const max = level <= 2 ? 9 : level <= 5 ? 15 : Math.min(90, 10 + level * 4);
  let left = pick(1, max), right = pick(1, max), result = 0;
  if (op === '+') result = left + right;
  if (op === '-') {
    if (left < right) [left, right] = [right, left];
    result = left - right;
  }
  if (op === '×') {
    left = pick(2, Math.min(12, level + 2));
    right = pick(2, Math.min(12, level + 2));
    result = left * right;
  }
  if (op === '÷') {
    right = pick(2, Math.min(12, level));
    result = pick(2, Math.min(12, level + 2));
    left = result * right;
  }
  // Close plausible foil. Never equal to the answer, even for zero.
  const step = pick(1, Math.max(2, Math.min(10, Math.floor(max / 4))));
  let foil = result + (rnd() < .5 ? -step : step);
  if (foil < 0) foil = result + step;
  if (foil === result) foil = result + 1;
  const correctIndex: 0 | 1 = rnd() < .5 ? 0 : 1;
  return {
    id: safeId, level, left, right, op, result, correctIndex,
    choices: correctIndex === 0 ? [result, foil] : [foil, result],
  };
}
export function startMathRun(seed = 12345): MathRun {
  const safeSeed = Number.isFinite(seed) ? (Math.floor(seed) | 0) : 12345;
  return {
    seed: safeSeed, score: 0, correct: 0, mistakes: 0,
    level: 1, stars: 0, timeMs: INITIAL_TIME_MS, maxTimeMs: MAX_TIME_MS,
    phase: 'ready', feedback: null, question: makeQuestion(safeSeed, 0),
    answered: 0, elapsedMs: 0, streak: 0,
  };
}
export function beginMathRun(run: MathRun): MathRun {
  return run.phase === 'ready' ? {...run, phase: 'playing'} : run;
}
export function pauseMathRun(run: MathRun): MathRun {
  if (run.phase === 'playing') return {...run, phase: 'paused'};
  if (run.phase === 'paused') return {...run, phase: 'playing'};
  return run;
}
export function tickMathRun(run: MathRun, dtMs: number): MathRun {
  if (run.phase !== 'playing') return run;
  if (!Number.isFinite(dtMs) || dtMs < 0 || dtMs > 1000) throw new RangeError('Invalid elapsed time');
  const timeMs = Math.max(0, run.timeMs - dtMs);
  return {...run, timeMs, elapsedMs: run.elapsedMs + dtMs,
    phase: timeMs <= 0 ? 'gameover' : 'playing'};
}
export function answerMathRun(run: MathRun, index: number): MathRun {
  if (run.phase !== 'playing' || (index !== 0 && index !== 1)) return run;
  const correct = run.question.correctIndex === index;
  const nextAnswered = run.answered + 1;
  const score = run.score + (correct ? 100 + Math.round(run.timeMs / 1000) * 2 : 0);
  const correctCount = run.correct + (correct ? 1 : 0);
  const mistakes = run.mistakes + (correct ? 0 : 1);
  const streak = correct ? run.streak + 1 : 0;
  const level = 1 + Math.floor(correctCount / QUESTIONS_PER_LEVEL);
  // Five-star line representing current group of solved answers.
  const stars = correctCount % QUESTIONS_PER_LEVEL;
  const timeMs = clamp(run.timeMs + (correct ? RIGHT_BONUS_MS : -WRONG_PENALTY_MS), 0, MAX_TIME_MS);
  return {
    ...run, score, correct: correctCount, mistakes, streak, level, stars,
    answered: nextAnswered, timeMs, feedback: correct ? 'correct' : 'wrong',
    phase: timeMs <= 0 ? 'gameover' : 'playing',
    question: makeQuestion(run.seed, nextAnswered),
  };
}
export function summarizeMathRun(record: MathRecord, run: MathRun): MathRecord {
  if (run.phase !== 'gameover') return record;
  return {
    bestScore: Math.max(record.bestScore, run.score),
    bestLevel: Math.max(record.bestLevel, run.level),
    bestStreak: Math.max(record.bestStreak, run.streak),
    totalSolved: Math.min(100000000, record.totalSolved + run.correct),
    plays: Math.min(100000000, record.plays + 1),
  };
}
export function readMathRecord(value: unknown): MathRecord {
  if (!value || typeof value !== 'object') return defaultMathRecord();
  const raw = value as Record<string, unknown>;
  const read = (key: keyof MathRecord, min: number, max: number, fallback: number) =>
    typeof raw[key] === 'number' && Number.isSafeInteger(raw[key])
      ? clamp(raw[key], min, max) : fallback;
  return {
    bestScore: read('bestScore', 0, 100000000, 0),
    bestLevel: read('bestLevel', 1, 100000, 1),
    bestStreak: read('bestStreak', 0, 100000000, 0),
    totalSolved: read('totalSolved', 0, 100000000, 0),
    plays: read('plays', 0, 100000000, 0),
  };
}

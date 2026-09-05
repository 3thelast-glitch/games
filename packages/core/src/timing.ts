import type { Seat } from './game.ts';

export const TURN_TIMER_SECONDS = [30, 45, 60, 90] as const;
export type TurnTimerSeconds = (typeof TURN_TIMER_SECONDS)[number];
export const DEFAULT_TURN_TIMER_SECONDS: TurnTimerSeconds = 60;
export const TURN_TIMER_MS = [30000, 45000, 60000, 90000] as const;
export type TurnTimerMs = (typeof TURN_TIMER_MS)[number];

export type TimeControl =
  | { mode: 'bank'; initialMs: number }
  | { mode: 'turn'; turnMs: TurnTimerMs };

export const bankTimeControl = (initialMs: number): TimeControl => ({ mode: 'bank', initialMs });
export const turnTimeControl = (seconds: TurnTimerSeconds): TimeControl => ({
  mode: 'turn',
  turnMs: (seconds * 1000) as TurnTimerMs,
});
export const isTurnTimerMs = (value: number): value is TurnTimerMs =>
  (TURN_TIMER_MS as readonly number[]).includes(value);

export function createClocks(control: TimeControl, count: number): number[] {
  const initial = control.mode === 'bank' ? control.initialMs : control.turnMs;
  return Array.from({ length: count }, () => initial);
}

export function remainingTimeMs(
  control: TimeControl,
  clocks: readonly number[],
  activeSeat: Seat,
  seat: Seat,
  turnStartedAt: number,
  now: number,
): number {
  const base = control.mode === 'turn' ? control.turnMs : (clocks[seat] ?? 0);
  if (seat !== activeSeat) return control.mode === 'turn' ? control.turnMs : Math.max(0, base);
  return Math.max(0, base - Math.max(0, now - turnStartedAt));
}

export function chargeClock(
  control: TimeControl,
  clocks: readonly number[],
  activeSeat: Seat,
  turnStartedAt: number,
  now: number,
): number[] {
  const next = [...clocks];
  next[activeSeat] = remainingTimeMs(control, clocks, activeSeat, activeSeat, turnStartedAt, now);
  return next;
}

export function beginTurn(
  control: TimeControl,
  clocks: readonly number[],
  previousSeat: Seat,
  nextSeat: Seat,
): number[] {
  if (control.mode !== 'turn') return [...clocks];
  const next = [...clocks];
  next[previousSeat] = control.turnMs;
  next[nextSeat] = control.turnMs;
  return next;
}

export function timeoutAt(
  control: TimeControl,
  clocks: readonly number[],
  activeSeat: Seat,
  turnStartedAt: number,
): number {
  const budget = control.mode === 'turn' ? control.turnMs : Math.max(0, clocks[activeSeat] ?? 0);
  return turnStartedAt + budget;
}

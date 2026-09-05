export const RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'] as const;
export const rankFor = (rating: number) =>
  RANKS[
    rating < 1000
      ? 0
      : rating < 1200
        ? 1
        : rating < 1400
          ? 2
          : rating < 1600
            ? 3
            : rating < 1800
              ? 4
              : 5
  ];
export function eloChange(a: number, b: number, result: 0 | 0.5 | 1, k = 32): number {
  return Math.round(k * (result - 1 / (1 + 10 ** ((b - a) / 400))));
}
export function periodStart(
  period: 'global' | 'weekly' | 'monthly' | 'friends',
  now: number,
): number {
  const date = new Date(now);
  if (period === 'monthly') return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  if (period === 'weekly')
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - ((date.getUTCDay() + 6) % 7),
    );
  return 0;
}

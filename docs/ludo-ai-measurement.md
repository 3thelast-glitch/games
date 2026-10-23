# Ludo AI — measured difficulty ladder

Measured on 2026-10-23 with `scripts/ludo-ai-sim.ts`: complete AI-vs-AI
matches played through the real engine with a seeded PRNG (mulberry32).
The starting seat is randomized per match and the difficulty assignment
rotates across seats, so no difficulty keeps a lucky seat. Every match in
every run finished inside the 20,000-roll cap. Win shares in four-player
Ludo are noisy: at n=120 a share carries roughly ±9 points of sampling
noise, so the table reports what the numbers do and do not show instead of
rounding them into a story.

## Baseline (original heuristic, 120 matches per config)

| Config | Result | Avg rolls |
|---|---|---:|
| 4p classic, all medium | seat shares 27/34/30/29 (near-uniform) | 586.5 |
| 4p classic, 1 hard vs 3 medium | hard won **41/120 (34.2%)** | 585.9 |
| 4p classic, 1 easy vs 3 medium | easy won **7/120 (5.8%)** | 550.6 |
| 4p classic, 1 hard vs 3 easy | hard won 83/120 (69.2%) | 519.7 |
| 4p fast, all medium | — | 340.2 |
| 6p classic, all medium (40 matches) | — | 2172.2 |

Findings: hard beat medium only modestly, and easy — 80% random moves —
was nearly hopeless rather than casual.

## What changed in `chooseAiToken`

- Captures are valued by the victim's advancement (`30 + victim progress`)
  instead of a flat 35 for any victim.
- A pawn already inside an enemy's capture range gains escape value for
  moving (medium +9 per threatening enemy, hard +13).
- Releasing a pawn from base is worth more (8 → 14); a small absolute
  advancement term breaks ties toward the leading pawn.
- Hard additionally keeps its destination-danger penalty and now avoids
  stacking onto its own pawn on a threatened unsafe cell (−30): this
  engine captures whole stacks, so a threatened stack risks two pawns.
- Easy's random-move rate was retuned (see below).

Three unit tests in `tests/ludo.test.ts` pin the tactical behaviors
directly: capture the most advanced victim, move a threatened pawn out of
range, and (hard) refuse a threatened stack.

## After (improved scoring, three 120-match batches)

| Config | Batch A (orig. seeds) | Batch B (fresh seeds) | Batch A2 (orig. seeds, easy retuned) |
|---|---|---|---|
| 1 hard vs 3 medium | hard 47 (39.2%), 570.2 rolls | hard 31 (25.8%), 536.9 rolls | hard 32 (26.7%), 523.2 rolls |
| 1 hard vs 3 easy | hard 81 (67.5%), 514.8 rolls | hard 91 (75.8%), 509.4 rolls | hard 81 (67.5%), 500.6 rolls |
| all medium | 560.9 rolls | 538.2 rolls | 525.8 rolls |
| 4p fast, all medium | 336.0 rolls | 297.2 rolls | 292.8 rolls |
| 6p classic, all medium (40) | 2074.5 rolls | 1673.8 rolls | 1762.4 rolls |

**Honest reading:** combined, hard won 110/360 (30.6%) against mediums —
statistically indistinguishable from the 34.2% baseline. The tactical
fixes are real (and unit-pinned), but they do not translate into a proven
aggregate win-share gain at this sample size; anyone claiming otherwise
is reading noise. What *is* consistent across all three batches is
shorter matches: all-medium self-play runs about 10% fewer rolls than
baseline (586.5 → 525.8–560.9), fast about 14% fewer, and the (noisier,
n=40) six-player sample about 19% fewer. Better tactics mostly make
games *faster*, not the hard seat dominant.

## Easy ladder retune

With the improved scoring, easy at 55% random moves won **36/120 (30%)**
against three mediums — as strong as a medium seat, which is not
"easy". Retuned to 70% random, easy won 7/120 (5.8%) on the original
seeds and 8/120 (6.7%) on fresh seeds — consistently the weakest seat,
matching its label. The shipped value is 70%: easy keeps the improved
tactics for its non-random moves but plays randomly often enough to stay
clearly beatable.

## Reproduce

```bash
node --import tsx scripts/ludo-ai-sim.ts 120                      # original seeds
LUDO_SIM_SEED_SHIFT=500000 node --import tsx scripts/ludo-ai-sim.ts 120  # fresh batch
```

A full run takes roughly three minutes. Larger samples (600+ matches per
config) would be needed to prove small win-share differences between
medium and hard.

# Apple Worm | NAQLA — 105-stage actual winning-route audit

> **⚠️ SUPERSEDED — historical record only (2026-10-23).** The numbers in this
> document (64/105 proven; stages 70, 95, 101 listed as having no exit) are
> **stale** and must not be quoted as current. The current, reproducible
> figures come from the generated audit:
> [SOLVER_AUDIT_GENERATED.md](SOLVER_AUDIT_GENERATED.md), produced by
> `scripts/apple-worm-audit.ts` and guarded by
> `tests/apple-worm-proven-routes.test.ts`. As of that generated audit:
> **83/105 proven won** (including 70, 95 and 101, which win via the
> implemented top-boundary exit), **12 exhausted** under the current
> provisional engine, **10 undetermined** (search budget), **0 missing exits**.
> This document is kept unchanged below as the 2026-10-20 historical audit.

**Audit date:** 2026-10-20 (Saudi local); **test evidence:** [Validate NAQLA workflow](https://github.com/3thelast-glitch/games/actions/runs/39327183465); **tested code:** `audit/apple-worm-105-playability-proof`.

**The user-supplied video/PDF is approved.** This report tests whether NAQLA's **current implementation** can win each stage from its current initial state, and must NEVER be read as challenging the source puzzles.

## Results

| Status | Count | Meaning |
|---|---:|---|
| **Proven WON** | **64** | Real input sequence replayed to `phase='won'` |
| **Current-engine exhausted** | **33** | Every reachable state was explored in the current provisional engine, none reached the exit; NOT a verdict on the original game |
| **Still undetermined** | **5** | Search limit/time reached; not proof that the level cannot be won |
| **No implemented exit** | **3** | Exit coordinate is null; winning impossible in current code until source frame is resolved |

## Detailed status by 15-stage batch

### Stages 1–15

| Stage | Result | Proof route (L/R/U/D) | Search states |
|---:|---|---|---:|
| 001 | ✅ Won | RRRURRRRRR | 61 |
| 002 | ✅ Won | RRRUUURRRR | 84 |
| 003 | ✅ Won | URRRRRR | 36 |
| 004 | ✅ Won | ULDLLUUURRRRRR | 151 |
| 005 | ❌ No win in current engine | — | 46 |
| 006 | ✅ Won | LLLLUURRRRRUURR | 256 |
| 007 | ❌ No win in current engine | — | 10 |
| 008 | ❌ No win in current engine | — | 59 |
| 009 | ❌ No win in current engine | — | 68 |
| 010 | ✅ Won | URDLLLDLURRRRUUUR | 57 |
| 011 | ✅ Won | RRRUUU | 44 |
| 012 | ❌ No win in current engine | — | 77 |
| 013 | ❌ No win in current engine | — | 211 |
| 014 | ❌ No win in current engine | — | 103 |
| 015 | ❌ No win in current engine | — | 83 |

### Stages 16–30

| Stage | Result | Proof route (L/R/U/D) | Search states |
|---:|---|---|---:|
| 016 | ✅ Won | ULLLLLUUURURRRUURRRRRRRUUUU | 467 |
| 017 | ❌ No win in current engine | — | 315 |
| 018 | ❌ No win in current engine | — | 2 |
| 019 | ❌ No win in current engine | — | 83 |
| 020 | ❌ No win in current engine | — | 137 |
| 021 | ✅ Won | RRRRR | 28 |
| 022 | ✅ Won | RDLURUUURRRDDL | 298 |
| 023 | ✅ Won | RDLUUULURRRRDDR | 384 |
| 024 | ✅ Won | DDLURUUURRRRDDL | 290 |
| 025 | ✅ Won | RRUURR | 26 |
| 026 | ✅ Won | RRRRRDR | 82 |
| 027 | ✅ Won | RRRRRRR | 58 |
| 028 | ❌ No win in current engine | — | 202 |
| 029 | ✅ Won | RRRRRRR | 64 |
| 030 | ❌ No win in current engine | — | 3 |

### Stages 31–45

| Stage | Result | Proof route (L/R/U/D) | Search states |
|---:|---|---|---:|
| 031 | ✅ Won | UUULUUUU | 32 |
| 032 | ✅ Won | RRULDLLLURURRRRRUURRRDDRR | 437 |
| 033 | ✅ Won | ULULLLLDDRULUUURRRRRRRDRRRRRUULUUUL | 547 |
| 034 | ❌ No win in current engine | — | 2 |
| 035 | ✅ Won | LDRURRUULURRRRRRRRDLDLDDRR | 957 |
| 036 | ✅ Won | LLDDRURRRRRDDLLLL | 1427 |
| 037 | ✅ Won | ULLLLLLLLL | 90 |
| 038 | ✅ Won | RULLLDLURRRRRRUR | 101 |
| 039 | ❌ No win in current engine | — | 685 |
| 040 | ❌ No win in current engine | — | 95 |
| 041 | ✅ Won | RRRULLLLLLLLLLLLLULDRRRRRRRUUURRRRDLLULLLLDLLURRRRDDDRRRRRRUUUUULLLLLL | 1225 |
| 042 | ❌ No win in current engine | — | 21 |
| 043 | ✅ Won | RDDLLURRRRRRRUUUU | 539 |
| 044 | ❌ No win in current engine | — | 1 |
| 045 | ✅ Won | RRRRURDLLLULDLLUUUURRRRRRRR | 611 |

### Stages 46–60

| Stage | Result | Proof route (L/R/U/D) | Search states |
|---:|---|---|---:|
| 046 | ✅ Won | LDRRRRRUUUURRUUUUR | 1178 |
| 047 | ✅ Won | ULLDDRRRRRDRRULLDLL | 156 |
| 048 | ✅ Won | DDDRRUUUULUUUUUL | 1268 |
| 049 | ❌ No win in current engine | — | 610 |
| 050 | ✅ Won | ULLLLLLLLLL | 87 |
| 051 | ❌ No win in current engine | — | 34 |
| 052 | ✅ Won | ULDLLULDRURRRRRRRRRDDLLLLLLL | 1282 |
| 053 | ✅ Won | LLLLLURRRRUURUURRR | 1432 |
| 054 | ✅ Won | UULDLLLUUUURUUULL | 702 |
| 055 | ✅ Won | UUURUUL | 72 |
| 056 | ✅ Won | RRDLUULULLLURRRUUUUU | 1070 |
| 057 | ✅ Won | RRULLLUUUUU | 709 |
| 058 | ❌ No win in current engine | — | 3012 |
| 059 | ❌ No win in current engine | — | 269 |
| 060 | ✅ Won | LLLUUU | 47 |

### Stages 61–75

| Stage | Result | Proof route (L/R/U/D) | Search states |
|---:|---|---|---:|
| 061 | ✅ Won | ULLURRRRRRR | 151 |
| 062 | ✅ Won | LLLDLURRRURDLLLUULURRRRRUUUR | 284 |
| 063 | ✅ Won | RRRRDLLUULLLLULUURUULLL | 1816 |
| 064 | ✅ Won | ULDLLDLURRRRUURRRRDDLDRRULUULLLLDDRDDDRR | 3930 |
| 065 | ✅ Won | ULLLDRUURUURRUUUR | 444 |
| 066 | ✅ Won | UULULUULL | 122 |
| 067 | ✅ Won | RRRUULLULDRRRUURRRDDLUULLUUURRR | 258 |
| 068 | ✅ Won | RUURUUR | 34 |
| 069 | ✅ Won | URRRRULLLLURRDLLLLDRDRRUULUURUUUL | 3094 |
| 070 | ⚠️ Exit not configured | — | 0 |
| 071 | ❌ No win in current engine | — | 1054 |
| 072 | ❌ No win in current engine | — | 317 |
| 073 | ❌ No win in current engine | — | 228 |
| 074 | ✅ Won | ULLULLLLLUURUUULLLDLLL | 432 |
| 075 | ✅ Won | RULLLULDRRRRRRRRR | 85 |

### Stages 76–90

| Stage | Result | Proof route (L/R/U/D) | Search states |
|---:|---|---|---:|
| 076 | ❌ No win in current engine | — | 112 |
| 077 | ✅ Won | LLLDLDRRUUUUUUU | 2673 |
| 078 | ✅ Won | LDLLLULDRURRRRRRRUUURR | 215 |
| 079 | ✅ Won | RRULLLULDRURRUUULLL | 91 |
| 080 | ⏳ Not yet proven | — | 9000 |
| 081 | ⏳ Not yet proven | — | 9000 |
| 082 | ✅ Won | RRDRRUUURULLLLLUUUU | 671 |
| 083 | ⏳ Not yet proven | — | 9000 |
| 084 | ✅ Won | ULLDDDDRURUUULUUURRRURRRRRR | 23088 |
| 085 | ✅ Won | RRURURRDD | 31 |
| 086 | ❌ No win in current engine | — | 27 |
| 087 | ✅ Won | ULLLLLDDD | 66 |
| 088 | ✅ Won | RDDRRDDLLURRUUULLUULLDLLLDRDDRRDLLDLLUU | 20469 |
| 089 | ✅ Won | LULLLLLLLULLDLDD | 6984 |
| 090 | ✅ Won | RRRRDRDLUULLLLUUURDRRRUUURRULULLLDLLLLLDDRRR | 3906 |

### Stages 91–105

| Stage | Result | Proof route (L/R/U/D) | Search states |
|---:|---|---|---:|
| 091 | ✅ Won | DLULLLD | 50 |
| 092 | ✅ Won | LDLDRRULLURUULLLLLUULDLDDRRDLDDRRURUU | 3443 |
| 093 | ✅ Won | LURDLLLURRURUULLLULLUURRRRUUURDDDLLLDRDRUURUURDDLLLLDRRRUUULLLULLUULLLDDDDDRRR | 42246 |
| 094 | ⏳ Not yet proven | — | 9000 |
| 095 | ⚠️ Exit not configured | — | 0 |
| 096 | ❌ No win in current engine | — | 15 |
| 097 | ❌ No win in current engine | — | 481 |
| 098 | ❌ No win in current engine | — | 4 |
| 099 | ✅ Won | RURRRRRRRURRRRR | 271 |
| 100 | ⏳ Not yet proven | — | 9000 |
| 101 | ⚠️ Exit not configured | — | 0 |
| 102 | ✅ Won | ULLLDDDLLULLDLLDDRDRRRURR | 687 |
| 103 | ✅ Won | LUUURRRRRURRR | 342 |
| 104 | ❌ No win in current engine | — | 3 |
| 105 | ❌ No win in current engine | — | 16 |

## Identified engineering blockers

- Missing exit source coordinates: **70, 95, 101**. Do **not** invent portal positions or fake victory states.
- Initial-state emergency: **44** has 3 possible first actions, and all 3 immediately end in a fall/loss; its current modeled start and gravity cannot lead to a win.
- The remaining 32 exhausted stages can move initially but cannot reach a winning state under the current simplified rule model; terrain/apple/gray-object positions were left untouched.
- Portal occupancy audit: NONE of the 33 exhausted stages has an exit physically overlapping the source terrain or a gray blocker. NONE of their initial worm cells overlaps terrain/gray obstacle. The failure is therefore not an obvious solid-on-exit error.
- All stages require validating original **video starting poses** and mechanics for gravity, apple support and gray obstacles. A still frame can show the worm after moving; simply declaring an exit active is insufficient.
- Five high-complexity levels **80, 81, 83, 94, 100** need further guided/deeper search. For each, the expanded run explored over 100,000 distinct states without establishing a win; do not call them impossible.

## Verification method and interpretation

1. Initialize the same stage the player sees with `startScreenshotWorm(level)`.
2. Perform bounded BFS with the same `moveScreenshotWorm` transitions as the app. The only engine optimization shares the unchanged stage and solid-cell collision mask; a separate parity test checks all 105 stages × four starting directions against the original two-argument entry point.
3. Every discovered route is **replayed again from the actual initial state**, asserting each move is legal and the final state is exactly `phase='won'` with the head on the actual portal cell.
4. `exhausted` means every reachable engine state was expanded, not just timed out. Search state identity includes ordered body positions and eaten-apple indices. `budget` means unknown, never unwinnable.
5. Per-stage first pass: 9,000 expanded states/350 ms; deeper pass: 160,000 expanded states/2,400 ms for 80, 81, 83, 84, 88, 93, 94, 100.
6. This **does not certify original Apple Worm physics or a screenshot being the true original level starting point**, and does not replace the user's approved source designs.

## Follow-up needed for 105/105 playable guarantee

- Recover the missing portal positions for 70, 95 and 101 from source video frames where those exits are visible.
- For the 33 exhausted stages, compare first-frame starting worm direction/position, gray-object behavior, and gravity against the user's original walkthrough; correct actual NAQLA engine/model defects **without changing approved layout arbitrarily**.
- Continue deeper/heuristic exploration for 80, 81, 83, 94, 100; retain replay-based winning-route acceptance.
- Once repaired, rerun this entire audit and require **105 proven routes** before claiming fully playable release.

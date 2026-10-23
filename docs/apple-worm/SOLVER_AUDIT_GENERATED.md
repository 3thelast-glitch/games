# Apple Worm — generated solver audit (105 stages)

Generated 2026-10-23 by `node --import tsx scripts/apple-worm-audit.ts --write`.
Do not edit by hand; regenerate instead. A stage is **proven** only when
its route below replays to `phase="won"` in the real engine — the same
check enforced by `tests/apple-worm-proven-routes.test.ts`.

- **Proven won: 83/105**
- Exhausted under the current provisional engine (not a verdict on the source puzzles): 12 — 12, 19, 26, 27, 29, 47, 58, 59, 72, 87, 91, 98
- Undetermined (search budget reached): 10 — 20, 80, 81, 83, 89, 93, 94, 97, 100, 105
- No implemented exit: 0 — none

| Stage | Status | Route length | Route (U/R/D/L) |
| ---: | --- | ---: | --- |
| 1 | won | 10 | `RRRURRRRRR` |
| 2 | won | 13 | `ULURRRUUURRRR` |
| 3 | won | 9 | `RRURRRRRR` |
| 4 | won | 18 | `RRRURDLLLUUURRRRRR` |
| 5 | won | 16 | `RRDDRDLUUURRRDDR` |
| 6 | won | 22 | `RRRRRUULLLLUURRRRRUURR` |
| 7 | won | 22 | `RRRULDLLULDRRRRRRRUUUR` |
| 8 | won | 17 | `RRRULDRRRRRRRRDDL` |
| 9 | won | 19 | `RRRRURDLULLUUURRRRR` |
| 10 | won | 14 | `RDDLDRURRRUUUR` |
| 11 | won | 6 | `RRRUUU` |
| 12 | exhausted | — | — |
| 13 | won | 24 | `RRUULUULLLDRRRRULURRURRR` |
| 14 | won | 19 | `RRUURDLURRUUURRRDDL` |
| 15 | won | 22 | `RRRUULLLLURRDDLLDDRUUR` |
| 16 | won | 24 | `ULLUUURURRRUURRRRRRRUUUU` |
| 17 | won | 16 | `RRRRUUURURURRDDD` |
| 18 | won | 25 | `RRUURRDLLLLURRUUURRRRRDDL` |
| 19 | exhausted | — | — |
| 20 | budget | — | — |
| 21 | won | 10 | `RRUURRDRRR` |
| 22 | won | 20 | `RRDDRDLUUULURRRRRDDL` |
| 23 | won | 31 | `RURRUURRRURULDDDLULLUURRRURRDDR` |
| 24 | won | 35 | `RRRDRULDDDLLUUULURDDDRRUUURURRDRDDL` |
| 25 | won | 11 | `RUULURURURR` |
| 26 | exhausted | — | — |
| 27 | exhausted | — | — |
| 28 | won | 18 | `RURRDLLURDRURUURRR` |
| 29 | exhausted | — | — |
| 30 | won | 30 | `RUULULDDLDRRDDLLUURUURULUUUUUU` |
| 31 | won | 8 | `UUULUUUU` |
| 32 | won | 31 | `RRRRUULLLLLDDLURURRRRRUURRRDDRR` |
| 33 | won | 36 | `ULLLDDRULUUURRRRRRRRULDDRRRRRUULUUUL` |
| 34 | won | 26 | `LLDLURURRURRDRUURUULUULLLU` |
| 35 | won | 35 | `LDLLURRURRUULURRRRRRRRDDLULLDRDDDRR` |
| 36 | won | 16 | `ULURRDRRRRDDLLLL` |
| 37 | won | 21 | `RRRRULLLLLDLULLUULLLL` |
| 38 | won | 15 | `RULLDLURRRRRRUR` |
| 39 | won | 45 | `UURURULDLDDRRRRRDDLURUUULLLLLULURRURRRRRRRRRR` |
| 40 | won | 33 | `LLLLLLDRURRURRDDRRRRULLLLUULULUUL` |
| 41 | won | 53 | `RRRRRRRRURDLLLLLLLUUURRRRDLLULLDDDLLLLLLUULUUURRRRRRR` |
| 42 | won | 37 | `URDLLLLLLULLLULURRULDDRRRRDRUURURUURR` |
| 43 | won | 13 | `RURRRRRRRUUUU` |
| 44 | won | 25 | `RRRRRDRULLLUUURRDDDLLLLLL` |
| 45 | won | 29 | `RRRRRRURDLLLULDLLUUUURRRRRRRR` |
| 46 | won | 17 | `URRRRRUUUURRUUUUR` |
| 47 | exhausted | — | — |
| 48 | won | 20 | `RRRDLLLUUUULLUUUUURR` |
| 49 | won | 19 | `RUURUULLLLLLLULLLUL` |
| 50 | won | 22 | `RRRRULLLLLLUULLUULLDLL` |
| 51 | won | 26 | `RUURRDDLDDRDLLURUURRUURRRR` |
| 52 | won | 28 | `ULDLLULDRURRRRRRRRRDDLLLLLLL` |
| 53 | won | 23 | `ULLDLULLURRDRUUURRUURRR` |
| 54 | won | 35 | `RDRRURRRUULURDDLLUUULDLLLUUUURUUULL` |
| 55 | won | 14 | `URRRRULLLUUUUU` |
| 56 | won | 31 | `URRRRRDDLDLLURRURUULLUUULLUURRR` |
| 57 | won | 22 | `LDRRRRDDDLLUUULLUUUUUR` |
| 58 | exhausted | — | — |
| 59 | exhausted | — | — |
| 60 | won | 7 | `ULLLUUU` |
| 61 | won | 13 | `ULULLURRRRRRR` |
| 62 | won | 18 | `RUULDRURRURUURUUUR` |
| 63 | won | 41 | `URRRRRULDRUURRRULLLLLLLLDRRULLLULUURUULLL` |
| 64 | won | 40 | `ULDLLDLURRRRUURRRRDDLDRRULUULLLLDDRDDDRR` |
| 65 | won | 33 | `ULLDLLUULLURRRDRDRRRUUULLUURUUURR` |
| 66 | won | 43 | `URDLLLULDRRRURUURRDDLLLLLLLLULLUUUURURRUUUR` |
| 67 | won | 43 | `LLLLULDRRRRRRUULLUULDDRRRUURRRDDLUULLUUURRR` |
| 68 | won | 30 | `LLURRRRDDLLLDDRRRRRRUULUURUUUU` |
| 69 | won | 35 | `URURRRRULLLLURRDLLLLDRDRRUULUURUUUL` |
| 70 | won | 4 | `UUUU` |
| 71 | won | 34 | `ULULULLLDRUURRRRRUURURDDDDDDRRDDLL` |
| 72 | exhausted | — | — |
| 73 | won | 14 | `LLLLLDDDDRDDLL` |
| 74 | won | 32 | `ULUULUUURDDLUUUULLLLUUUULLLLDLLL` |
| 75 | won | 17 | `RULLLULDRRRRRRRRR` |
| 76 | won | 16 | `RRRRRULDRUUURRRR` |
| 77 | won | 20 | `RURDLDLLULUUULUUURRR` |
| 78 | won | 26 | `RRRULDLLLULDRURRRRRRRUUURR` |
| 79 | won | 18 | `RULLLULDRURRUUULLL` |
| 80 | budget | — | — |
| 81 | budget | — | — |
| 82 | won | 17 | `DRRUUURULLLLLUUUU` |
| 83 | budget | — | — |
| 84 | won | 50 | `ULLLDRDRRRRUUUURUUULLLLDDRDDLDDRURRUUURUUULURRRRRR` |
| 85 | won | 28 | `LUULLLLULDRRDRURRDDRRURURRDD` |
| 86 | won | 33 | `RULLLULDRRRRRRRRRUULDLLLLLLLLDDRR` |
| 87 | exhausted | — | — |
| 88 | won | 46 | `RRRRRRDDRRDDLLURRUUULLUULLDLLLLDRRDDRRDLLDLLUU` |
| 89 | budget | — | — |
| 90 | won | 55 | `URRRRRRRRDDRRULLULLLLURRDRRUUURRDDRUULLLDDDLLLLLLLDDRRR` |
| 91 | exhausted | — | — |
| 92 | won | 41 | `RURRDLLDRRULLURUULLLLLUULDLDDRRDLDDRRURUU` |
| 93 | budget | — | — |
| 94 | budget | — | — |
| 95 | won | 12 | `RUUULUUUUUUU` |
| 96 | won | 6 | `URUUUU` |
| 97 | budget | — | — |
| 98 | exhausted | — | — |
| 99 | won | 22 | `LLDLUURURRRRUURRRRRRRR` |
| 100 | budget | — | — |
| 101 | won | 9 | `DRURUUUUU` |
| 102 | won | 34 | `RRRRDRRURDLLLDDDLLULLDLLDDRDRRRURR` |
| 103 | won | 21 | `RRUUULUUULUURRRRRURRR` |
| 104 | won | 11 | `DDRRRRURUUU` |
| 105 | budget | — | — |

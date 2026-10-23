/**
 * Apple Worm 105-stage solver audit — the single source of truth for
 * "how many stages are proven winnable in the current engine".
 *
 * Run:
 *   node --import tsx scripts/apple-worm-audit.ts           (report only)
 *   node --import tsx scripts/apple-worm-audit.ts --write   (also regenerate
 *     tests/fixtures/apple-worm-proven-routes.json and
 *     docs/apple-worm/SOLVER_AUDIT_GENERATED.md)
 *
 * Method (mirrors tests/apple-worm-105-solvability-audit.test.ts):
 *   Pass A: bounded BFS, 3,600 states per stage.
 *   Pass B: only stages Pass A left at status "budget" get a deeper BFS
 *           (24,000 states). "budget" means UNDETERMINED, never impossible.
 * A stage counts as proven only when its route is replayed through the real
 * engine (replayAppleWormRoute) and ends in phase "won". The time cap is set
 * high so the state cap — not wall-clock speed — decides the outcome, which
 * keeps the report reproducible across machines.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  solveAppleWormLevel,
  replayAppleWormRoute,
  type SolvabilityStatus,
} from '../packages/games/apple-worm/solvability.ts';
import {
  APPLE_WORM_SCREENSHOT_LEVEL_COUNT,
  screenshotWormLevel,
} from '../packages/games/apple-worm/screenshot-game.ts';

const PASS_A = { maxStates: 3600, maxMillis: 60_000, source: 'full-video' as const };
const PASS_B = { maxStates: 24_000, maxMillis: 120_000, source: 'full-video' as const };

export interface StageAudit {
  level: number;
  status: SolvabilityStatus;
  route: string | null;
  routeLength: number | null;
  explored: number;
  exitMode: string;
  portal: readonly [number, number] | null;
}

const letter = { up: 'U', right: 'R', down: 'D', left: 'L' } as const;

export function runAudit(): StageAudit[] {
  const rows: StageAudit[] = [];
  for (let n = 1; n <= APPLE_WORM_SCREENSHOT_LEVEL_COUNT; n++) {
    const stage = screenshotWormLevel(n);
    let result = solveAppleWormLevel(n, PASS_A);
    if (result.status === 'budget') {
      const deep = solveAppleWormLevel(n, PASS_B);
      if (deep.status !== 'budget' || deep.explored > result.explored) result = deep;
    }
    let route: string | null = null;
    if (result.status === 'won') {
      if (!result.route) throw new Error(`solver reported a win without a route for stage ${n}`);
      const replay = replayAppleWormRoute(n, result.route, { source: 'full-video' });
      if (!replay.won || replay.legalMoves !== result.route.length)
        throw new Error(`route for stage ${n} failed replay verification`);
      route = result.route.map((d) => letter[d]).join('');
    }
    rows.push({
      level: n,
      status: result.status,
      route,
      routeLength: result.routeLength,
      explored: result.explored,
      exitMode: stage.exitMode,
      portal: stage.portal,
    });
    console.log(`stage ${n}: ${result.status}${route ? ` (${route.length} moves)` : ''}`);
  }
  return rows;
}

export function summarize(rows: StageAudit[]) {
  const by = (status: SolvabilityStatus) => rows.filter((r) => r.status === status).map((r) => r.level);
  return {
    total: rows.length,
    proven: by('won'),
    exhausted: by('exhausted'),
    budget: by('budget'),
    missingExit: by('missing-exit'),
  };
}

function renderMarkdown(rows: StageAudit[]): string {
  const s = summarize(rows);
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    '# Apple Worm — generated solver audit (105 stages)',
    '',
    `Generated ${today} by \`node --import tsx scripts/apple-worm-audit.ts --write\`.`,
    'Do not edit by hand; regenerate instead. A stage is **proven** only when',
    'its route below replays to `phase="won"` in the real engine — the same',
    'check enforced by `tests/apple-worm-proven-routes.test.ts`.',
    '',
    `- **Proven won: ${s.proven.length}/${s.total}**`,
    `- Exhausted under the current provisional engine (not a verdict on the source puzzles): ${s.exhausted.length} — ${s.exhausted.join(', ') || 'none'}`,
    `- Undetermined (search budget reached): ${s.budget.length} — ${s.budget.join(', ') || 'none'}`,
    `- No implemented exit: ${s.missingExit.length} — ${s.missingExit.join(', ') || 'none'}`,
    '',
    '| Stage | Status | Route length | Route (U/R/D/L) |',
    '| ---: | --- | ---: | --- |',
    ...rows.map(
      (r) =>
        `| ${r.level} | ${r.status} | ${r.routeLength ?? '—'} | ${r.route ? `\`${r.route}\`` : '—'} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = runAudit();
  const s = summarize(rows);
  console.log('APPLE_WORM_AUDIT_SUMMARY=' + JSON.stringify(s));
  if (process.argv.includes('--write')) {
    const routes: Record<string, string> = {};
    for (const r of rows) if (r.route) routes[String(r.level)] = r.route;
    const fixture = {
      generatedBy: 'scripts/apple-worm-audit.ts',
      source: 'full-video',
      totalStages: s.total,
      provenCount: s.proven.length,
      provenStages: s.proven,
      exhaustedStages: s.exhausted,
      budgetStages: s.budget,
      missingExitStages: s.missingExit,
      routes,
    };
    mkdirSync(new URL('../tests/fixtures', import.meta.url), { recursive: true });
    writeFileSync(
      new URL('../tests/fixtures/apple-worm-proven-routes.json', import.meta.url),
      JSON.stringify(fixture, null, 2) + '\n',
    );
    writeFileSync(
      new URL('../docs/apple-worm/SOLVER_AUDIT_GENERATED.md', import.meta.url),
      renderMarkdown(rows),
    );
    console.log('Wrote tests/fixtures/apple-worm-proven-routes.json and docs/apple-worm/SOLVER_AUDIT_GENERATED.md');
  }
}

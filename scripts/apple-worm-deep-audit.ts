/**
 * Apple Worm Phase 1 deep audit: run the heuristic (weighted A*) solver on
 * the stages the generated baseline audit left at status "budget".
 *
 * Run:
 *   node --import tsx scripts/apple-worm-deep-audit.ts           (report only)
 *   node --import tsx scripts/apple-worm-deep-audit.ts --write   (merge any
 *     newly proven routes into tests/fixtures/apple-worm-proven-routes.json
 *     and regenerate docs/apple-worm/SOLVER_AUDIT_GENERATED.md)
 *
 * This script never touches the engine. Every reported win is replayed
 * through the real engine before it is printed or written. Stages that
 * stay unsolved keep their honest status ("budget" = undetermined,
 * "exhausted" = no route exists in the current provisional engine).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { solveAppleWormLevelHeuristic } from '../packages/games/apple-worm/heuristic-solver.ts';
import { replayAppleWormRoute } from '../packages/games/apple-worm/solvability.ts';

const FIXTURE_URL = new URL('../tests/fixtures/apple-worm-proven-routes.json', import.meta.url);
const DOC_URL = new URL('../docs/apple-worm/SOLVER_AUDIT_GENERATED.md', import.meta.url);

const letter = { up: 'U', right: 'R', down: 'D', left: 'L' } as const;

interface Fixture {
  generatedBy: string;
  source: string;
  totalStages: number;
  provenCount: number;
  provenStages: number[];
  exhaustedStages: number[];
  budgetStages: number[];
  missingExitStages: number[];
  routes: Record<string, string>;
}

function renderMarkdown(fixture: Fixture): string {
  const today = new Date().toISOString().slice(0, 10);
  const statusOf = (n: number) =>
    fixture.provenStages.includes(n)
      ? 'won'
      : fixture.exhaustedStages.includes(n)
        ? 'exhausted'
        : fixture.missingExitStages.includes(n)
          ? 'missing-exit'
          : 'budget';
  const lines = [
    '# Apple Worm — generated solver audit (105 stages)',
    '',
    `Generated ${today} from the proven-routes fixture (baseline: \`scripts/apple-worm-audit.ts --write\`;`,
    'heuristic deep pass: `scripts/apple-worm-deep-audit.ts --write`). Do not edit by hand.',
    'A stage is **proven** only when its route replays to `phase="won"` in the real',
    'engine — the check enforced by `tests/apple-worm-proven-routes.test.ts`.',
    '',
    `- **Proven won: ${fixture.provenCount}/${fixture.totalStages}**`,
    `- Exhausted under the current provisional engine (not a verdict on the source puzzles): ${fixture.exhaustedStages.length} — ${fixture.exhaustedStages.join(', ') || 'none'}`,
    `- Undetermined (search budget reached): ${fixture.budgetStages.length} — ${fixture.budgetStages.join(', ') || 'none'}`,
    `- No implemented exit: ${fixture.missingExitStages.length} — ${fixture.missingExitStages.join(', ') || 'none'}`,
    '',
    '| Stage | Status | Route length | Route (U/R/D/L) |',
    '| ---: | --- | ---: | --- |',
    ...Array.from({ length: fixture.totalStages }, (_, i) => i + 1).map((n) => {
      const route = fixture.routes[String(n)];
      return `| ${n} | ${statusOf(n)} | ${route ? route.length : '—'} | ${route ? `\`${route}\`` : '—'} |`;
    }),
    '',
  ];
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fixture = JSON.parse(readFileSync(FIXTURE_URL, 'utf8')) as Fixture;
  const targets = fixture.budgetStages;
  console.log(`Heuristic deep audit on ${targets.length} budget stages: ${targets.join(', ')}`);
  const maxStates = Number(process.env.APPLE_WORM_MAX_STATES ?? 1_000_000);
  const maxMillis = Number(process.env.APPLE_WORM_MAX_MILLIS ?? 180_000);
  let changed = false;
  for (const n of targets) {
    const result = solveAppleWormLevelHeuristic(n, { maxStates, maxMillis });
    console.log(
      `stage ${n}: ${result.status} explored=${result.explored} elapsed=${result.elapsedMs}ms` +
        (result.route ? ` route=${result.route.length} moves` : ''),
    );
    if (result.status === 'won') {
      if (!result.route) throw new Error(`stage ${n}: win without a route`);
      const replay = replayAppleWormRoute(n, result.route, { source: 'full-video' });
      if (!replay.won || replay.legalMoves !== result.route.length)
        throw new Error(`stage ${n}: route failed replay verification`);
      if (process.argv.includes('--write')) {
        fixture.routes[String(n)] = result.route.map((d) => letter[d]).join('');
        fixture.budgetStages = fixture.budgetStages.filter((s) => s !== n);
        fixture.provenStages = [...fixture.provenStages, n].sort((a, b) => a - b);
        changed = true;
      }
    } else if (result.status === 'exhausted' && process.argv.includes('--write')) {
      fixture.budgetStages = fixture.budgetStages.filter((s) => s !== n);
      fixture.exhaustedStages = [...fixture.exhaustedStages, n].sort((a, b) => a - b);
      changed = true;
    }
  }
  fixture.provenCount = fixture.provenStages.length;
  const classified =
    fixture.provenStages.length +
    fixture.exhaustedStages.length +
    fixture.budgetStages.length +
    fixture.missingExitStages.length;
  if (classified !== fixture.totalStages)
    throw new Error(`fixture classification broken: ${classified} != ${fixture.totalStages}`);
  console.log(
    `APPLE_WORM_DEEP_SUMMARY proven=${fixture.provenCount}/${fixture.totalStages} ` +
      `exhausted=[${fixture.exhaustedStages}] budget=[${fixture.budgetStages}]`,
  );
  if (process.argv.includes('--write') && changed) {
    mkdirSync(new URL('../tests/fixtures', import.meta.url), { recursive: true });
    const sortedRoutes: Record<string, string> = {};
    for (const key of Object.keys(fixture.routes).sort((a, b) => Number(a) - Number(b)))
      sortedRoutes[key] = fixture.routes[key]!;
    fixture.routes = sortedRoutes;
    writeFileSync(FIXTURE_URL, JSON.stringify(fixture, null, 2) + '\n');
    writeFileSync(DOC_URL, renderMarkdown(fixture));
    console.log('Merged results into the proven-routes fixture and regenerated the audit doc.');
  }
}

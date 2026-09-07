from pathlib import Path


def replace_one(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, got {count}')
    p.write_text(text.replace(old, new, 1))


replace_one(
    'packages/core/src/timing.ts',
    'export const TURN_TIMER_SECONDS = [30, 45, 60, 90] as const;',
    'export const TURN_TIMER_SECONDS = [15, 30, 45, 60, 90] as const;',
)
replace_one(
    'packages/core/src/timing.ts',
    'export const TURN_TIMER_MS = [30000, 45000, 60000, 90000] as const;',
    'export const TURN_TIMER_MS = [15000, 30000, 45000, 60000, 90000] as const;',
)
replace_one(
    'packages/core/src/protocol.ts',
    'const turnTimerSeconds = z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]);',
    'const turnTimerSeconds = z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60), z.literal(90)]);',
)

replace_one(
    'apps/server/src/lobby.ts',
    """  canonicalTurnSeconds(gameId: string, value?: TurnTimerSeconds): TurnTimerSeconds | null {
    if (gameId !== 'digitalGame') {
      if (value !== undefined) throw new RuleError('turn-timer-not-supported');
      return null;
    }
    // Rummikub Classic uses one fixed minute per turn. Legacy clients may still
    // submit 30/45/90, but all Digital Classic lobbies are canonicalized to 60.
    void value;
    return CLASSIC_DIGITAL_TURN_SECONDS;
  }""",
    """  canonicalTurnSeconds(gameId: string, value?: TurnTimerSeconds): TurnTimerSeconds | null {
    if (gameId === 'digitalGame') {
      // Rummikub Classic uses one fixed minute per turn. Legacy clients may still
      // submit other supported timer values, but Digital Classic is always 60.
      void value;
      return CLASSIC_DIGITAL_TURN_SECONDS;
    }
    if (gameId === 'reversi') return value ?? null;
    if (value !== undefined) throw new RuleError('turn-timer-not-supported');
    return null;
  }""",
)

replace_one(
    'apps/server/src/matches.ts',
    """  bankTimeControl,
  beginTurn,
  chargeClock,
  createClocks,
  isTurnTimerMs,""",
    """  bankTimeControl,
  beginTurn,
  chargeClock,
  CLASSIC_DIGITAL_TURN_MS,
  createClocks,
  isTurnTimerMs,""",
)
replace_one(
    'apps/server/src/matches.ts',
    """    if (gameId !== 'digitalGame' || !isTurnTimerMs(control.turnMs))
      throw new RuleError('turn-timer-not-supported');
    return control;""",
    """    if (gameId === 'digitalGame') {
      if (control.turnMs !== CLASSIC_DIGITAL_TURN_MS)
        throw new RuleError('turn-timer-not-supported');
      return control;
    }
    if (gameId === 'reversi' && isTurnTimerMs(control.turnMs)) return control;
    throw new RuleError('turn-timer-not-supported');""",
)

replace_one(
    'apps/mobile/src/pages.tsx',
    """    turnSeconds: TurnTimerSeconds,
    code?: string,""",
    """    turnSeconds: TurnTimerSeconds | null,
    code?: string,""",
)
replace_one(
    'apps/mobile/src/pages.tsx',
    """    [playerCount, setPlayerCount] = useState<PlayerCount>(2),
    [turnSeconds, setTurnSeconds] = useState<TurnTimerSeconds>(60),
    [code, setCode] = useState('');""",
    """    [playerCount, setPlayerCount] = useState<PlayerCount>(2),
    [turnSeconds, setTurnSeconds] = useState<TurnTimerSeconds | null>(
      gameId === 'digitalGame' ? 60 : null,
    ),
    [code, setCode] = useState('');""",
)

digital_timer_block = """      {gameId === 'digitalGame' && (
        <fieldset>
          <legend>{t('turn')} ⏱</legend>
          <div className=\"segmented\">
            {([30, 45, 60, 90] as TurnTimerSeconds[]).map((seconds) => (
              <button
                key={seconds}
                aria-pressed={turnSeconds === seconds}
                onClick={() => setTurnSeconds(seconds)}
              >
                {seconds}s
              </button>
            ))}
          </div>
        </fieldset>
      )}"""
reversi_timer_block = digital_timer_block + """
      {gameId === 'reversi' && (
        <fieldset>
          <legend>{t('turn')} ⏱</legend>
          <div className=\"segmented\">
            <button aria-pressed={turnSeconds === null} onClick={() => setTurnSeconds(null)}>
              {t('off')}
            </button>
            {([15, 30, 45, 60, 90] as TurnTimerSeconds[]).map((seconds) => (
              <button
                key={seconds}
                aria-pressed={turnSeconds === seconds}
                onClick={() => setTurnSeconds(seconds)}
              >
                {seconds}s
              </button>
            ))}
          </div>
        </fieldset>
      )}"""
replace_one('apps/mobile/src/pages.tsx', digital_timer_block, reversi_timer_block)
replace_one(
    'apps/mobile/src/pages.tsx',
    """        {room.turnSeconds !== null && (
          <p className=\"small-muted\">
            {t('turn')}: {room.turnSeconds}s
          </p>
        )}""",
    """        {(room.turnSeconds !== null || room.gameId === 'reversi') && (
          <p className=\"small-muted\">
            {t('turn')}: {room.turnSeconds === null ? t('off') : `${room.turnSeconds}s`}
          </p>
        )}""",
)

replace_one(
    'apps/mobile/src/App.tsx',
    """    turnSeconds: TurnTimerSeconds,
    code?: string,""",
    """    turnSeconds: TurnTimerSeconds | null,
    code?: string,""",
)
replace_one(
    'apps/mobile/src/App.tsx',
    """          choice.gameId === 'digitalGame'
            ? turnTimeControl(turnSeconds)
            : bankTimeControl(600000),""",
    """          choice.gameId === 'digitalGame'
            ? turnTimeControl(turnSeconds ?? 60)
            : choice.gameId === 'reversi' && turnSeconds !== null
              ? turnTimeControl(turnSeconds)
              : bankTimeControl(600000),""",
)
replace_one(
    'apps/mobile/src/App.tsx',
    """                ...(choice.gameId === 'digitalGame' ? { turnSeconds } : {}),""",
    """                ...(choice.gameId === 'digitalGame'
                  ? { turnSeconds: turnSeconds ?? 60 }
                  : choice.gameId === 'reversi' && turnSeconds !== null
                    ? { turnSeconds }
                    : {}),""",
)
replace_one(
    'apps/mobile/src/App.tsx',
    """          ...(choice.gameId === 'digitalGame' ? { turnSeconds } : {}),""",
    """          ...(choice.gameId === 'digitalGame'
            ? { turnSeconds: turnSeconds ?? 60 }
            : choice.gameId === 'reversi' && turnSeconds !== null
              ? { turnSeconds }
              : {}),""",
)

replace_one(
    'apps/mobile/src/MatchPage.tsx',
    """            {timeControl.mode === 'turn' ? ` · ${timeControl.turnMs / 1000}s` : ''}""",
    """            {timeControl.mode === 'turn'
              ? ` · ${timeControl.turnMs / 1000}s`
              : p.state.gameId === 'reversi'
                ? ` · ${t('turn')}: ${t('off')}`
                : ''}""",
)

test_path = Path('tests/lobby-regression.test.ts')
test_text = test_path.read_text()
if 'Reversi supports optional per-turn timers and an Off fallback' not in test_text:
    test_text += """

test('Reversi supports optional per-turn timers and an Off fallback', () => {
  const { store, lobby } = setup();
  try {
    assert.equal(lobby.canonicalTurnSeconds('reversi'), null);
    for (const seconds of [15, 30, 45, 60, 90] as const)
      assert.equal(lobby.canonicalTurnSeconds('reversi', seconds), seconds);
    assert.throws(() => lobby.canonicalTurnSeconds('abalone', 15), /turn-timer-not-supported/);

    const timedA = account(store, 'TimedA'), timedB = account(store, 'TimedB');
    assert.equal(lobby.enqueue(timedA.id, 'reversi', false, 2, 15), null);
    const timed = lobby.enqueue(timedB.id, 'reversi', false, 2, 15);
    assert.ok(timed);
    assert.deepEqual(timed.timeControl, { mode: 'turn', turnMs: 15000 });

    const offA = account(store, 'OffA'), offB = account(store, 'OffB');
    assert.equal(lobby.enqueue(offA.id, 'reversi', false, 2), null);
    const off = lobby.enqueue(offB.id, 'reversi', false, 2);
    assert.ok(off);
    assert.deepEqual(off.timeControl, { mode: 'bank', initialMs: 60000 });
  } finally {
    store.close();
  }
});
"""
    test_path.write_text(test_text)

Path('tests/e2e/games/reversi-timer.spec.ts').write_text("""import { test, expect, type Page } from '@playwright/test';

async function openReversiDialog(page: Page) {
  await page.goto('/');
  const card = page.locator('.game-card.reversi');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Play now' }).click();
  await expect(page.getByRole('heading', { name: 'Reversi' })).toBeVisible();
}

test('Reversi exposes Off and 15/30/45/60/90 second turn timers', async ({ page }) => {
  await openReversiDialog(page);
  for (const label of ['Off', '15s', '30s', '45s', '60s', '90s'])
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '15s', exact: true }).click();
  await expect(page.getByRole('button', { name: '15s', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start match', exact: true }).click();
  await expect(page.locator('.match-header')).toContainText('15s');
});

test('Reversi timer Off keeps the normal bank clock and labels the turn timer as off', async ({ page }) => {
  await openReversiDialog(page);
  await expect(page.getByRole('button', { name: 'Off', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start match', exact: true }).click();
  await expect(page.locator('.match-header')).toContainText('Turn: Off');
  await expect(page.locator('.match-clock').first()).toContainText('10:00');
});
""")

Path('.github/workflows/apply-reversi-timer-fix.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
Path('.github/workflows/ci.yml').write_text("""name: Validate Board Arena
on:
  push:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm audit --audit-level=moderate
      - run: npm test
      - run: npm run build
      - uses: actions/upload-artifact@v7
        with:
          name: board-arena-web-server
          path: dist
          retention-days: 14
""")

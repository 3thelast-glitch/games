import { test, expect, type Browser, type Page } from '@playwright/test';
import { locales, selectedViewports, type LocaleCase, type ViewportCase } from '../fixtures/matrix.ts';
import { captureRuntimeErrors, disableMotion } from '../helpers/game.ts';
import {
  expectCenterHitTarget,
  expectHorizontallyContained,
  expectIntentionalScroller,
  expectMinimumControlSize,
  expectNoGlobalOverflow,
  expectNotCoveredBy,
} from '../helpers/layout.ts';

const populatedEntries = [
  {
    id: 'arena-player-1',
    name: 'عبدالله بن محمد الاستراتيجي',
    avatar: 'crown',
    rating: 1842,
    rank: 'Master',
    position: 1,
    score: 1842,
    played: 42,
  },
  {
    id: 'arena-player-2',
    name: 'Alexander The Strategist With A Long Name',
    avatar: 'orbit',
    rating: 1710,
    rank: 'Diamond',
    position: 2,
    score: 1710,
    played: 39,
  },
  {
    id: 'arena-player-3',
    name: 'Nawaf لاعب NAQLA 2026',
    avatar: 'comet',
    rating: 1588,
    rank: 'Platinum',
    position: 3,
    score: 1588,
    played: 31,
  },
  {
    id: 'arena-player-4',
    name: 'VeryLongUnbrokenLeaderboardName012345678901234567890',
    avatar: 'hex',
    rating: 1440,
    rank: 'Gold',
    position: 4,
    score: 1440,
    played: 28,
  },
];

async function mockLeaderboard(
  page: Page,
  entries = populatedEntries,
  requests: string[] = [],
) {
  await page.route('**/api/leaderboard**', async (route) => {
    requests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries }),
    });
  });
}

async function openArena(
  browser: Browser,
  browserName: string,
  locale: LocaleCase,
  viewport: ViewportCase,
  entries = populatedEntries,
) {
  const canTouch = viewport.touch && browserName !== 'firefox';
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: locale.locale,
    hasTouch: canTouch,
    isMobile: canTouch,
    deviceScaleFactor: viewport.group === 'mobile' ? 2 : 1,
  });
  const page = await context.newPage();
  const requests: string[] = [];
  const runtimeErrors = captureRuntimeErrors(page);
  await mockLeaderboard(page, entries, requests);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', locale.dir);
  await expect(page.locator('html')).toHaveAttribute('lang', locale.id);

  const navigation = page.locator('.sidebar nav button:visible, .mobile-nav button:visible');
  await expect(navigation).toHaveCount(4);
  await navigation.nth(1).click();

  await expect(page.locator('.arena-page')).toBeVisible();
  await expect(page.locator('.leaderboard-panel')).toBeVisible();
  await expect(page.locator('.loading-state')).toHaveCount(0);
  await disableMotion(page);
  return { context, page, requests, runtimeErrors };
}

for (const locale of locales) {
  for (const viewport of selectedViewports()) {
    test(`Arena ${locale.id} ${viewport.id} ${viewport.width}x${viewport.height}`, async ({
      browser,
      browserName,
    }) => {
      const { context, page, runtimeErrors } = await openArena(browser, browserName, locale, viewport);
      try {
        await expectNoGlobalOverflow(page);
        const strictDimensions = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        expect(strictDimensions.document, JSON.stringify(strictDimensions)).toBeLessThanOrEqual(
          strictDimensions.viewport + 1,
        );
        expect(strictDimensions.body, JSON.stringify(strictDimensions)).toBeLessThanOrEqual(
          strictDimensions.viewport + 1,
        );

        if (browserName === 'chromium' && locale.id === 'ar' && viewport.id === 'm320') {
          const fixedMetrics = await page.evaluate(() => {
            const measure = (selector: string) => {
              const element = document.querySelector(selector) as HTMLElement | null;
              if (!element) return null;
              const rect = element.getBoundingClientRect();
              return {
                left: Math.round(rect.left * 100) / 100,
                right: Math.round(rect.right * 100) / 100,
                width: Math.round(rect.width * 100) / 100,
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
              };
            };
            return {
              viewport: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              bodyScrollWidth: document.body.scrollWidth,
              scrollX: window.scrollX,
              controls: measure('.leaderboard-controls'),
              gameScroller: measure('.arena-game-scroll'),
              gameSelector: measure('.arena-game-selector'),
            };
          });
          console.log('ARENA_FIXED_METRICS=' + JSON.stringify(fixedMetrics));
        }

        const contained = [
          ['topbar', page.locator('.topbar')],
          ['Arena heading', page.locator('.arena-heading')],
          ['Arena controls', page.locator('.leaderboard-controls')],
          ['game selector viewport', page.locator('.arena-game-scroll')],
          ['period selector', page.locator('.period-tabs')],
          ['leaderboard panel', page.locator('.leaderboard-panel')],
          ['rank ladder', page.locator('.rank-ladder')],
        ] as const;
        for (const [label, locator] of contained)
          await expectHorizontallyContained(locator, page, label);

        const visibleMobileNav = page.locator('.mobile-nav:visible');
        if (await visibleMobileNav.count())
          await expectHorizontallyContained(visibleMobileNav, page, 'mobile navigation');

        const gameScroller = page.locator('.arena-game-scroll');
        await expectIntentionalScroller(gameScroller, 'Arena game selector');
        const gameButtons = page.locator('.arena-game-selector > button');
        expect(await gameButtons.count()).toBeGreaterThan(6);
        const firstGame = gameButtons.first();
        const lastGame = gameButtons.last();
        const selectedGame = page.locator('.arena-game-selector > button[aria-pressed="true"]');
        await expect(selectedGame).toHaveCount(1);
        await expectMinimumControlSize(firstGame, 'first game filter', 40);
        const [initialScrollBox, selectedBox] = await Promise.all([
          gameScroller.boundingBox(),
          selectedGame.boundingBox(),
        ]);
        expect(initialScrollBox).not.toBeNull();
        expect(selectedBox).not.toBeNull();
        if (initialScrollBox && selectedBox) {
          expect(selectedBox.x).toBeGreaterThanOrEqual(initialScrollBox.x - 1);
          expect(selectedBox.x + selectedBox.width).toBeLessThanOrEqual(
            initialScrollBox.x + initialScrollBox.width + 1,
          );
        }

        await lastGame.scrollIntoViewIfNeeded();
        const [scrollBox, lastBox] = await Promise.all([
          gameScroller.boundingBox(),
          lastGame.boundingBox(),
        ]);
        expect(scrollBox).not.toBeNull();
        expect(lastBox).not.toBeNull();
        if (scrollBox && lastBox) {
          expect(lastBox.x).toBeGreaterThanOrEqual(scrollBox.x - 1);
          expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(scrollBox.x + scrollBox.width + 1);
        }
        await expectCenterHitTarget(lastGame, 'last game filter');
        await lastGame.click();
        await expect(lastGame).toHaveAttribute('aria-pressed', 'true');
        await expectNoGlobalOverflow(page);

        if (viewport.width <= 430) {
          const scroller = await gameScroller.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }));
          expect(scroller.scrollWidth, 'narrow game selector should own horizontal overflow').toBeGreaterThan(
            scroller.clientWidth,
          );
        }

        const periods = page.locator('.period-tabs > button');
        await expect(periods).toHaveCount(4);
        for (let index = 0; index < 4; index++)
          await expectMinimumControlSize(periods.nth(index), `period filter ${index}`, 40);

        const rows = page.locator('.leaderboard-table tbody tr');
        await expect(rows).toHaveCount(populatedEntries.length);
        await expectHorizontallyContained(rows.last(), page, 'leaderboard row');

        const finalRank = page.locator('.rank-ladder article').last();
        await finalRank.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await expectCenterHitTarget(finalRank, 'final rank card');
        if (await visibleMobileNav.count())
          await expectNotCoveredBy(finalRank, visibleMobileNav, 'final rank card');

        expect(runtimeErrors, 'Arena runtime errors').toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}

test('Arena preserves filter request semantics and supports an inline retry', async ({ browser }) => {
  const viewport: ViewportCase = {
    id: 'arena-interaction',
    width: 390,
    height: 844,
    touch: true,
    group: 'mobile',
  };
  const locale = locales.find((item) => item.id === 'ar')!;
  const canTouch = test.info().project.name !== 'firefox';
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: locale.locale,
    hasTouch: canTouch,
    isMobile: canTouch,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const requests: string[] = [];
  let fail = false;

  await page.route('**/api/leaderboard**', async (route) => {
    requests.push(route.request().url());
    if (fail) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'server-error' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: populatedEntries }),
    });
  });

  try {
    await page.goto('/');
    await page.locator('.mobile-nav button').nth(1).click();
    await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(populatedEntries.length);

    const initial = new URL(requests.at(-1)!);
    expect(initial.searchParams.get('gameId')).toBe('abalone');
    expect(initial.searchParams.get('period')).toBe('global');

    await page.locator('.period-tabs > button').nth(1).click();
    await expect.poll(() => new URL(requests.at(-1)!).searchParams.get('period')).toBe('weekly');

    const secondGame = page.locator('.arena-game-selector > button').nth(1);
    await secondGame.scrollIntoViewIfNeeded();
    await secondGame.click();
    await expect.poll(() => new URL(requests.at(-1)!).searchParams.get('gameId')).not.toBe('abalone');

    fail = true;
    await page.locator('.period-tabs > button').nth(2).click();
    await expect(page.locator('.leaderboard-error-state')).toBeVisible();
    await expect(page.locator('.leaderboard-error-state .button')).toBeVisible();

    fail = false;
    await page.locator('.leaderboard-error-state .button').click();
    await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(populatedEntries.length);
    await expect(page.locator('.leaderboard-error-state')).toHaveCount(0);
    await expectNoGlobalOverflow(page);
  } finally {
    await context.close();
  }
});

test('Arena empty state is compact and contained on a small Arabic phone', async ({
  browser,
  browserName,
}) => {
  const locale = locales.find((item) => item.id === 'ar')!;
  const viewport: ViewportCase = {
    id: 'arena-empty',
    width: 360,
    height: 800,
    touch: true,
    group: 'mobile',
  };
  const { context, page } = await openArena(browser, browserName, locale, viewport, []);
  try {
    const empty = page.locator('.leaderboard-empty');
    await expect(empty).toBeVisible();
    await expectHorizontallyContained(empty, page, 'Arena empty state');
    const box = await empty.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.height, 'empty state should not dominate the phone').toBeLessThan(260);
    await expectNoGlobalOverflow(page);
  } finally {
    await context.close();
  }
});

test('Arena remains contained with enlarged text', async ({ browser, browserName }) => {
  const locale = locales.find((item) => item.id === 'en')!;
  const viewport: ViewportCase = {
    id: 'arena-large-text',
    width: 390,
    height: 844,
    touch: true,
    group: 'mobile',
  };
  const { context, page } = await openArena(browser, browserName, locale, viewport);
  try {
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expectNoGlobalOverflow(page);
    await expectHorizontallyContained(page.locator('.arena-heading'), page, 'large-text heading');
    await expectHorizontallyContained(page.locator('.arena-game-scroll'), page, 'large-text game selector');
    await expectHorizontallyContained(page.locator('.leaderboard-panel'), page, 'large-text leaderboard');
  } finally {
    await context.close();
  }
});

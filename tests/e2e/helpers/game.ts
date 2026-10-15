import { expect, type Page } from '@playwright/test';
import type { GameId, LocaleCase } from '../fixtures/matrix.ts';

export const boardSelectors: Record<GameId, string> = {
  abalone: '.hex-board',
  quoridor: '.quoridor-board',
  checkers: '.checkers-board',
  gomoku: '.gomoku-board',
  nineMensMorris: '.morris-board',
  connectFour: '.connect-columns',
  reversi: '.reversi-board',
  digitalGame: '.digital-game',
  chess: '.chess-board',
  dotsAndBoxes: '.dots-board',
  dominoes: '.domino-chain-shell',
  navalBattle: '.naval-grid',
};

export const gameRootSelectors: Record<GameId, string> = {
  abalone: '.abalone-game',
  quoridor: '.quoridor-game',
  checkers: '.checkers-game',
  gomoku: '.gomoku-game',
  nineMensMorris: '.morris-game',
  connectFour: '.connect-four-game',
  reversi: '.reversi-game',
  digitalGame: '.digital-game',
  chess: '.chess-game',
  dotsAndBoxes: '.dots-boxes-game',
  dominoes: '.dominoes-game',
  navalBattle: '.naval-game',
};

export async function openLocalGame(page: Page, gameId: GameId, locale: LocaleCase) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', locale.dir);
  await expect(page.locator('html')).toHaveAttribute('lang', locale.id);

  const card = page.locator(`.game-card.${gameId}`);
  await expect(card).toBeVisible();
  await card.locator('.play-button').click();

  await expect(page.locator('.mode-grid')).toBeVisible();
  const start = page.locator('.button.primary.full').last();
  await expect(start).toBeVisible();
  await start.click();

  await expect(page.locator('.match-page')).toBeVisible();
  await expect(page.locator(gameRootSelectors[gameId])).toBeVisible();

  if (gameId === 'navalBattle') {
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)), {
        message: 'Naval Battle should open at the top before private fleet reveal',
      })
      .toBe(0);
  }

  if (gameId === 'dominoes') {
    const reveal = page.locator('.domino-handoff .button');
    if (await reveal.count()) await reveal.click();
  }
  if (gameId === 'navalBattle') {
    const reveal = page.locator('.naval-handoff .button');
    if (await reveal.count()) await reveal.click();

    // Naval Battle now starts with a private 3-of-6 tactical loadout for each player.
    for (let seat = 0; seat < 2; seat++) {
      const cards = page.locator('.naval-loadout-panel .naval-ability-card');
      await expect(cards).toHaveCount(6);
      for (const ability of ['sonarPulse', 'twinSalvo', 'emergencyRepair']) {
        const card = page.locator(`.naval-loadout-panel .naval-ability-card[data-ability="${ability}"]`);
        await expect(card).toBeEnabled();
        await card.click();
        await expect(card).toHaveAttribute('aria-pressed', 'true');
      }
      const confirm = page.locator('.naval-confirm-loadout');
      await expect(confirm).toBeEnabled();
      await confirm.click();
      if (seat === 0) {
        await expect(page.locator('.naval-handoff')).toBeVisible();
        await page.locator('.naval-handoff .button').click();
      }
    }

    await expect(page.locator('.naval-handoff')).toBeVisible();
    await page.locator('.naval-handoff .button').click();
  }

  await expect(page.locator(boardSelectors[gameId])).toBeVisible();
}

export function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon'))
      errors.push(`console: ${message.text()}`);
  });
  return errors;
}

export async function disableMotion(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

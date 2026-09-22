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

  if (gameId === 'dominoes') {
    const reveal = page.locator('.domino-handoff .button');
    if (await reveal.count()) await reveal.click();
  }
  if (gameId === 'navalBattle') {
    const reveal = page.locator('.naval-handoff .button');
    if (await reveal.count()) await reveal.click();

    if (await page.locator('.naval-loadout-screen').count()) {
      for (const index of [0, 1, 2])
        await page.locator('.naval-loadout-card').nth(index).click();
      await page.locator('.naval-loadout-footer .button.primary').click();

      await expect(page.locator('.naval-handoff')).toBeVisible();
      await page.locator('.naval-handoff .button').click();
      for (const index of [3, 4, 5])
        await page.locator('.naval-loadout-card').nth(index).click();
      await page.locator('.naval-loadout-footer .button.primary').click();

      await expect(page.locator('.naval-handoff')).toBeVisible();
      await page.locator('.naval-handoff .button').click();
    }
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

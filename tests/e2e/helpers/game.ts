import { expect, type Page } from '@playwright/test';
import type { GameId, LocaleCase } from '../fixtures/matrix.ts';

export const boardSelectors: Record<GameId, string> = {
  abalone: '.hex-board',
  quoridor: '.quoridor-board',
  checkers: '.checkers-board',
  gomoku: '.gomoku-board',
  nineMensMorris: '.morris-board',
  connectFour: '.connect-columns',
  digitalGame: '.digital-game',
};

export const gameRootSelectors: Record<GameId, string> = {
  abalone: '.abalone-game',
  quoridor: '.quoridor-game',
  checkers: '.classic-game.checkers-game',
  gomoku: '.classic-game.gomoku-game',
  nineMensMorris: '.classic-game.morris-game',
  connectFour: '.classic-game.connect-four-game',
  digitalGame: '.digital-game',
};

export async function openLocalGame(page: Page, gameId: GameId, locale: LocaleCase) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', locale.dir);
  await expect(page.locator('html')).toHaveAttribute('lang', locale.id);

  const card = page.locator(`.game-card.${gameId}`);
  await expect(card).toBeVisible();
  await card.locator('.play-button').click();

  await expect(page.locator('.mode-grid')).toBeVisible();
  const start = page.locator('.modal .button.primary.full, [role="dialog"] .button.primary.full').first();
  await expect(start).toBeVisible();
  await start.click();

  await expect(page.locator('.match-page')).toBeVisible();
  await expect(page.locator(gameRootSelectors[gameId])).toBeVisible();
  await expect(page.locator(boardSelectors[gameId])).toBeVisible();
}

export async function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

export async function stableUi(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; caret-color: transparent !important; }
    `,
  });
}

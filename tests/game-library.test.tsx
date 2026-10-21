import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { gameInfo } from '../apps/mobile/src/gameViews.tsx';
import { gameLibraryCategories, libraryFilters } from '../apps/mobile/src/gameLibraryCatalog.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  HTMLElement: dom.window.HTMLElement,
  HTMLDialogElement: dom.window.HTMLDialogElement,
  MutationObserver: dom.window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { I18n } = await import('../apps/mobile/src/i18n.tsx');
const { HomePage } = await import('../apps/mobile/src/pages.tsx');
afterEach(() => cleanup());

test('the app library has a category for all 20 unique real games', () => {
  assert.equal(gameInfo.length, 20);
  assert.equal(new Set(gameInfo.map((game) => game.id)).size, gameInfo.length);
  for (const game of gameInfo) assert.ok(gameLibraryCategories[game.id], game.id);
  assert.ok(libraryFilters.includes('favorites'));
});

test('compact launcher preserves game play, rules, favorites, and bilingual search', () => {
  let selected = '';
  let rules = '';
  let favorited = '';
  const view = render(
    <I18n lang="ar">
      <HomePage
        onChoose={(gameId) => { selected = gameId; }}
        onRules={(gameId) => { rules = gameId; }}
        onFavorite={(gameId) => { favorited = gameId; }}
        onResume={() => {}}
        hasMatch={false}
        profile={null}
      />
    </I18n>,
  );
  assert.equal(view.container.querySelectorAll('.game-grid > .game-card.naqla-icon-tile').length, 20);
  assert.equal(view.container.querySelectorAll('.naqla-icon-frame').length, 20);
  fireEvent.click(view.container.querySelector('.game-card.ludo .play-button')!);
  assert.equal(selected, 'ludo');
  fireEvent.click(view.container.querySelector('.game-card.ludo .naqla-icon-info')!);
  assert.equal(rules, 'ludo');
  fireEvent.click(view.container.querySelector('.game-card.ludo .naqla-icon-favorite')!);
  assert.equal(favorited, 'ludo');

  const search = view.getByRole('searchbox', { name: 'ابحث عن لعبة...' });
  fireEvent.change(search, { target: { value: 'Ludo' } });
  assert.equal(view.container.querySelectorAll('.game-grid > .game-card').length, 1);
  assert.ok(view.container.querySelector('.game-card.ludo'));
  fireEvent.change(search, { target: { value: '' } });
  fireEvent.click(view.getByRole('button', { name: 'ألغاز' }));
  assert.equal(view.container.querySelectorAll('.game-grid > .game-card').length, 4);
  fireEvent.click(view.getByRole('button', { name: 'المفضلة' }));
  assert.equal(view.container.querySelectorAll('.game-grid > .game-card').length, 0);
  assert.ok(view.getByRole('status').textContent?.includes('لا توجد ألعاب'));
  fireEvent.click(view.getByRole('button', { name: 'عرض جميع الألعاب' }));
  assert.equal(view.container.querySelectorAll('.game-grid > .game-card').length, 20);
});

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { gameInfo } from '../apps/mobile/src/gameViews.tsx';
import { gameLibraryCategories, gameMatchesLibraryFilter, libraryFilters, normalizeLibrarySearch } from '../apps/mobile/src/gameLibraryCatalog.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  HTMLElement: dom.window.HTMLElement,
  HTMLDialogElement: dom.window.HTMLDialogElement,
  MutationObserver: dom.window.MutationObserver,
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
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

test('search ignores Arabic tashkeel, tatweel, alif variants and extra whitespace', () => {
  assert.equal(normalizeLibrarySearch('   الْأَلْعَاب  '), 'الالعاب');
  assert.ok(gameMatchesLibraryFilter('quoridor', 'القُــوريدور', 'القوريدور', 'all', []));
  assert.ok(gameMatchesLibraryFilter('appleWorm', 'دودة التفاح', 'دَوْدَةُ التُّفّاح', 'all', []));
  assert.ok(gameMatchesLibraryFilter('ludo', 'لودو', '  LUDO  ', 'all', [], 'Ludo لودو'));
  assert.ok(!gameMatchesLibraryFilter('chess', 'الشطرنج', 'دومينو', 'all', []));
});

test('search and category survive navigation away from the library', () => {
  const props = {
    onChoose: (_gameId: string) => {},
    onRules: (_gameId: string) => {},
    onFavorite: (_gameId: string) => {},
    onResume: () => {},
    hasMatch: false,
    profile: null,
  };
  const first = render(<I18n lang="ar"><HomePage {...props} /></I18n>);
  fireEvent.click(first.getByRole('button', { name: 'ألغاز' }));
  fireEvent.change(first.getByRole('searchbox'), { target: { value: 'Apple Worm' } });
  assert.equal(first.container.querySelectorAll('.naqla-icon-tile').length, 1);
  cleanup();

  const returned = render(<I18n lang="ar"><HomePage {...props} /></I18n>);
  assert.equal((returned.getByRole('searchbox') as HTMLInputElement).value, 'Apple Worm');
  assert.equal(returned.getByRole('button', { name: 'ألغاز' }).getAttribute('aria-pressed'), 'true');
  assert.equal(returned.container.querySelectorAll('.naqla-icon-tile').length, 1);
  fireEvent.change(returned.getByRole('searchbox'), { target: { value: '' } });
  fireEvent.click(returned.getByRole('button', { name: 'الكل' }));
});

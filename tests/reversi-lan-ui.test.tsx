import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { I18n } from '../apps/mobile/src/i18n.tsx';
import { LanPage } from '../apps/mobile/src/LanPage.tsx';

const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
});
const { render, cleanup } = await import('@testing-library/react');
afterEach(() => cleanup());

test('Reversi LAN screen reports native requirement in web builds instead of faking a match', () => {
  const view = render(
    <I18n lang="en">
      <LanPage playerName="Player 1" turnSeconds={null} onExit={() => {}} />
    </I18n>,
  );
  assert.match(view.container.textContent ?? '', /Android or iOS/i);
  assert.equal(view.container.querySelector('.lan-match'), null);
});

test('Reversi LAN screen translates unsupported web fallback in Arabic', () => {
  const view = render(
    <I18n lang="ar">
      <LanPage playerName="لاعب" turnSeconds={15} onExit={() => {}} />
    </I18n>,
  );
  assert.match(view.container.textContent ?? '', /Android أو iOS/);
});

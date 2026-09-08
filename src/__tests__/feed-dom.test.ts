// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createFeedDomBlocker, type FeedDomBlocker } from '../content/features/ads-blocking/feed-dom.js';
import type { FeatureContext } from '../content/core/feature-context.js';
import type { SharedContext } from '../content/features/ads-blocking/shared.js';
import { BLOCKED_ATTR, PROCESSED_ATTR } from '../content/features/ads-blocking/config.js';

let blocker: FeedDomBlocker;
let shared: SharedContext;
let observe: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  shared = { customWords: { block: [], allow: [] }, loadStats: vi.fn(async () => {}), recordBlock: vi.fn() } as unknown as SharedContext;
  const ctx = { observeChanges: vi.fn((_id: string, callback: () => void) => {
    observe = callback;
    return vi.fn();
  }) } as unknown as FeatureContext;
  blocker = createFeedDomBlocker(ctx, shared);
});
afterEach(() => {
  blocker.disable();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

it('does not hide built-in ad signals with empty custom lists', () => {
  document.body.innerHTML = `<article data-index="0" class="erid">
    sponsored erid спонсор на правах рекламы купить
    <img src="https://mradx.net/ad?utm_source=test">
    <button data-testid="post-header-subscription-button" aria-label="Рекламная запись">Подробнее</button>
    <a href="https://example.com">Заказать</a>рекл<wbr>ама
  </article>`;
  blocker.enable();
  expect(document.querySelector(`[${BLOCKED_ATTR}]`)).toBeNull();
  expect(getComputedStyle(document.querySelector('article')!).display).not.toBe('none');
  expect(document.querySelector('#ad-blocker-dom-styles')?.textContent).not.toMatch(/erid|mradx|subscription|:has/);
});

it('uses case-insensitive words and live exceptions, restoring the original display', () => {
  document.body.innerHTML = '<article data-index="0" style="display: flex !important">Большой ВЕБИНАР VKify</article>';
  const post = document.querySelector('article')!;
  blocker.enable();
  shared.customWords.block = ['вебинар'];
  blocker.forceScan();
  expect(post.style.display).toBe('none');
  shared.customWords.allow = ['vkify'];
  blocker.forceScan();
  expect(post.style.display).toBe('flex');
  expect(post.style.getPropertyPriority('display')).toBe('important');
  expect(post.hasAttribute(BLOCKED_ATTR)).toBe(false);
  shared.customWords.allow = [];
  blocker.forceScan();
  shared.customWords.block = [];
  blocker.forceScan();
  expect(post.style.display).toBe('flex');
});

it('rechecks reused post containers when their text changes', () => {
  document.body.innerHTML = '<article data-index="0"><div data-testid="post">Обычный пост</div></article>';
  const post = document.querySelector('article')!;
  shared.customWords.block = ['казино'];
  blocker.enable();
  post.firstElementChild!.textContent = 'КАЗИНО';
  observe();
  expect(post.hasAttribute(BLOCKED_ATTR)).toBe(true);
  expect(shared.recordBlock).toHaveBeenCalledTimes(1);
  post.firstElementChild!.textContent = 'Обычный пост';
  observe();
  expect(post.hasAttribute(BLOCKED_ATTR)).toBe(false);
  blocker.disable();
  expect(document.querySelector(`[${PROCESSED_ATTR}]`)).toBeNull();
  blocker.enable();
  shared.customWords.block = ['обычный'];
  blocker.forceScan();
  expect(post.hasAttribute(BLOCKED_ATTR)).toBe(true);
});

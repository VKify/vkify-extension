// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { miniFooterPlugin } from './mini-footer.js';
import type { ScopedFeatureContext } from '@/content/core/features/scoped-context.js';

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); document.body.replaceChildren(); });
function mount() {
  document.body.innerHTML = '<button id="outside">Outside</button><div id="ads_with_extra"><div><a href="#">Blog</a></div></div>';
  const root = document.querySelector<HTMLElement>('#ads_with_extra')!;
  cleanup = miniFooterPlugin.setup!({
    registerMutationObserver: (_selector: string, callback: (element: Element) => void) => { callback(root); return () => {}; },
    observeChanges: () => () => {},
  } as unknown as ScopedFeatureContext) as () => void;
  return { root, button: root.querySelector<HTMLButtonElement>('button')!, link: root.querySelector<HTMLAnchorElement>('a')! };
}

it('keeps Escape dismissal through delayed focus-scroll and resize events', () => {
  const { root, button, link } = mount();
  link.focus();
  expect(root.hasAttribute('data-vkify-footer-open')).toBe(true);
  link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(document.activeElement).toBe(button);
  for (const event of ['scroll', 'resize', 'scroll']) window.dispatchEvent(new Event(event));
  expect(root.hasAttribute('data-vkify-footer-open')).toBe(false);
  expect(button.getAttribute('aria-expanded')).toBe('false');
  document.querySelector<HTMLButtonElement>('#outside')!.focus();
  button.focus();
  expect(root.hasAttribute('data-vkify-footer-open')).toBe(true);
});

it('does not reopen a click-dismissed popup on resize but allows an explicit click', () => {
  const { root, button } = mount();
  button.focus();
  button.click();
  window.dispatchEvent(new Event('resize'));
  expect(root.hasAttribute('data-vkify-footer-open')).toBe(false);
  button.click();
  window.dispatchEvent(new Event('scroll'));
  expect(root.hasAttribute('data-vkify-footer-open')).toBe(true);
});

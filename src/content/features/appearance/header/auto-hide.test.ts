// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { startAutoHideHeader } from './auto-hide.js';

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); stop = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

it('writes the header marker only on transitions, cancels work, and can restart', () => {
  const frames = new Map<number, FrameRequestCallback>(); let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const scroll = (y: number): void => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(y);
    window.dispatchEvent(new Event('scroll'));
  };
  const flush = (): void => { const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(0)); };
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(4000);
  const header = document.createElement('div'); header.id = 'page_header_cont'; document.body.append(header);
  scroll(0); stop = startAutoHideHeader();
  const remove = vi.spyOn(document.documentElement, 'removeAttribute');
  for (let i = 0; i < 10; i++) header.dispatchEvent(new Event('pointerover', { bubbles: true }));
  expect(remove).not.toHaveBeenCalled();
  scroll(100); scroll(110); expect(frames.size).toBe(1); flush();
  expect(document.documentElement.hasAttribute('data-vkify-header-hidden')).toBe(true);
  scroll(105); flush(); expect(document.documentElement.hasAttribute('data-vkify-header-hidden')).toBe(true);
  scroll(95); flush(); expect(document.documentElement.hasAttribute('data-vkify-header-hidden')).toBe(false);
  scroll(200); expect(frames.size).toBe(1); stop(); expect(frames.size).toBe(0);
  scroll(300); expect(frames.size).toBe(0);
  stop = startAutoHideHeader(); scroll(400); flush();
  expect(document.documentElement.hasAttribute('data-vkify-header-hidden')).toBe(true);
});

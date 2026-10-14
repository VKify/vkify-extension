// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { startThemeSync, stopThemeSync } from './theme-sync.js';

afterEach(() => { stopThemeSync(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('cancels startup before DOM readiness and does not resurrect on DOMContentLoaded', () => {
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
  const style = vi.spyOn(window, 'getComputedStyle');
  startThemeSync(); stopThemeSync();
  document.dispatchEvent(new Event('DOMContentLoaded'));
  expect(style).not.toHaveBeenCalled();
});

it('starts once, cancels queued measurements on stop, and restarts cleanly', () => {
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  let mutation!: () => void;
  const disconnect = vi.fn();
  const observer = vi.fn(class {
    constructor(callback: () => void) { mutation = callback; }
    observe = vi.fn(); disconnect = disconnect;
  });
  vi.stubGlobal('MutationObserver', observer);
  const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => media);
  vi.stubGlobal('chrome', { storage: { local: { set: vi.fn() } } });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  startThemeSync(); startThemeSync();
  expect(observer).toHaveBeenCalledTimes(1);
  expect(media.addEventListener).toHaveBeenCalledTimes(1);
  mutation(); mutation(); expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  stopThemeSync(); expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  expect(disconnect).toHaveBeenCalledTimes(1);
  mutation(); expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  startThemeSync(); expect(observer).toHaveBeenCalledTimes(2);
});

// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import type { FeatureContext } from '../content/core/feature-context.js';
import type { SharedContext } from '../content/features/ads-blocking/shared.js';
import { createTrackerBlocker } from '../content/features/ads-blocking/trackers.js';

vi.mock('../content/utils/injected-ready.js', () => ({
  waitForInjectedScript: vi.fn(async () => {}),
}));

it('preserves tracking images and noscript containers while removing tracking iframes', async () => {
  vi.useFakeTimers();
  const ctx = { injectScript: vi.fn(), sendEvent: vi.fn() } as unknown as FeatureContext;
  const shared = {
    loadStats: vi.fn(async () => {}), addListenerUser: vi.fn(),
    releaseListenerUser: vi.fn(), recordBlock: vi.fn(),
  } as unknown as SharedContext;
  const blocker = createTrackerBlocker(ctx, shared);
  const container = document.createElement('div');
  const markup = '<img src="https://top-fwz1.mail.ru/pixel.gif" width="1" height="1" style="display: none">'
    + '<noscript><img src="https://mc.yandex.ru/watch/123"></noscript>'
    + '<iframe src="https://doubleclick.net/tracker" srcdoc=""></iframe>';
  container.innerHTML = markup;
  document.body.append(container);
  try {
    blocker.enable();
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('noscript')).not.toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(shared.recordBlock).toHaveBeenCalledTimes(1);
    container.insertAdjacentHTML('beforeend', markup);
    await vi.advanceTimersByTimeAsync(3_100);
    expect(container.querySelectorAll('img[width="1"]')).toHaveLength(2);
    expect(container.querySelectorAll('noscript')).toHaveLength(2);
    expect(container.querySelector('iframe')).toBeNull();
    expect(shared.recordBlock).toHaveBeenCalledTimes(2);
  } finally {
    blocker.disable();
    container.remove();
    vi.useRealTimers();
  }
});

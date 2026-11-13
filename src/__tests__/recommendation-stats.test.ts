// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCallsPromoStats } from '../content/features/ads-blocking/recommendations/calls-stats.js';
import type { SharedContext } from '../content/features/ads-blocking/shared.js';
const recordBlock = vi.fn();
let tracker: ReturnType<typeof createCallsPromoStats>;
beforeEach(() => {
  vi.useFakeTimers(); recordBlock.mockClear();
  document.body.innerHTML = '<main id="spa_layout_content"><div id="calls"><section data-testid="calls_aside_menu"></section><section class="vkuiBanner__host"><img><a href="/promo">Promo</a></section></div></main>';
  document.documentElement.setAttribute('data-vkify-block_recommendations_calls', '');
  tracker = createCallsPromoStats({ recordBlock } as unknown as SharedContext);
});
afterEach(() => { tracker.disable(); vi.useRealTimers(); document.documentElement.removeAttribute('data-vkify-block_recommendations_calls'); document.body.innerHTML = ''; });
it('does not count a matching visible banner', async () => {
  tracker.enable(); await vi.advanceTimersByTimeAsync(100);
  expect(recordBlock).not.toHaveBeenCalled();
});
it('counts a CSS-hidden banner once through disable, re-enable and DOM reinsertion', async () => {
  const banner = document.querySelector<HTMLElement>('.vkuiBanner__host')!;
  banner.style.display = 'none';
  tracker.enable(); await vi.advanceTimersByTimeAsync(100);
  expect(recordBlock).toHaveBeenCalledOnce();
  expect(recordBlock.mock.calls[0][6]).toBe('block_recommendations_calls');
  tracker.disable(); tracker.enable();
  banner.remove(); document.getElementById('calls')!.append(banner);
  await vi.advanceTimersByTimeAsync(100);
  expect(recordBlock).toHaveBeenCalledOnce();
});
it('counts a hydrated banner only after it matches and is hidden', async () => {
  const banner = document.querySelector<HTMLElement>('.vkuiBanner__host')!;
  banner.querySelector('a')!.removeAttribute('href');
  tracker.enable(); await vi.advanceTimersByTimeAsync(100);
  expect(recordBlock).not.toHaveBeenCalled();
  banner.style.display = 'none'; banner.querySelector('a')!.setAttribute('href', '/promo');
  await vi.advanceTimersByTimeAsync(100);
  expect(recordBlock).toHaveBeenCalledOnce();
});
it('does not count hidden banners when the feature marker is absent', async () => {
  document.documentElement.removeAttribute('data-vkify-block_recommendations_calls');
  document.querySelector<HTMLElement>('.vkuiBanner__host')!.style.display = 'none';
  tracker.enable(); await vi.advanceTimersByTimeAsync(100);
  expect(recordBlock).not.toHaveBeenCalled();
});

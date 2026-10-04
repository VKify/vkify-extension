// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { finishLoadedVideoAds } from './video-ad-fallback.js';

afterEach(() => { document.body.innerHTML = ''; });
it('finishes only the known ad media inside the shadow ad container', () => {
  const host = document.createElement('div');
  host.className = 'shadow-root-container';
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<video id="main" src="https://vkuser.net/main.mp4"></video><div data-testid="ad-container"><video src="https://r.mradx.net/vrs/ad.mp4"></video></div>';
  const media = shadow.querySelector<HTMLVideoElement>('[data-testid="ad-container"] video')!;
  Object.defineProperty(media, 'duration', { configurable: true, value: 20 });
  const report = vi.fn();
  finishLoadedVideoAds(report);
  expect(media.currentTime).toBe(20);
  expect(shadow.querySelector<HTMLVideoElement>('#main')!.currentTime).toBe(0);
  expect(report).toHaveBeenCalledOnce();
  finishLoadedVideoAds(report);
  expect(report).toHaveBeenCalledOnce();
  media.src = 'https://vkuser.net/video.mp4';
  media.currentTime = 0;
  finishLoadedVideoAds(report);
  expect(media.currentTime).toBe(0);
});

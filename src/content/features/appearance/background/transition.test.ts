// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createWallpaperTransition } from './transition.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  document.body.innerHTML = '<style id="vkify-custom_background">#vkify-bg-container{position:fixed}#vkify-image-bg{background:red}</style><div id="vkify-bg-container"><div id="vkify-image-bg"></div></div>';
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it('keeps the previous wallpaper and its CSS until the new resource has loaded and faded in', async () => {
  const transition = createWallpaperTransition(vi.fn()), cleanup = vi.fn();
  const swap = transition.begin(cleanup), image = new EventTarget();
  swap.wait(image, 'load');
  expect(document.querySelector('#vkify-image-bg-previous')).not.toBeNull();
  expect(document.querySelector('#vkify-bg-container-previous style')?.textContent).toContain('#vkify-image-bg-previous');
  expect(swap.container.style.opacity).toBe('0');
  await vi.advanceTimersByTimeAsync(1000);
  expect(cleanup).not.toHaveBeenCalled();
  image.dispatchEvent(new Event('load'));
  await vi.advanceTimersByTimeAsync(16);
  expect(swap.container.style.opacity).toBe('1');
  expect(document.getElementById('vkify-bg-container-previous')).not.toBeNull();
  await vi.advanceTimersByTimeAsync(450);
  expect(document.getElementById('vkify-bg-container-previous')).toBeNull();
  expect(cleanup).toHaveBeenCalledOnce();
});

it('does not reveal an outdated image after a newer selection', async () => {
  const transition = createWallpaperTransition(vi.fn());
  const first = transition.begin(vi.fn()), oldImage = new EventTarget();
  first.wait(oldImage, 'load');
  const discard = vi.fn(), latest = transition.begin(discard), newImage = new EventTarget();
  latest.wait(newImage, 'load');
  oldImage.dispatchEvent(new Event('load'));
  await vi.advanceTimersByTimeAsync(20);
  expect(latest.container.style.opacity).toBe('0');
  expect(first.container.isConnected).toBe(false); expect(discard).toHaveBeenCalledOnce();
  newImage.dispatchEvent(new Event('load'));
  await vi.advanceTimersByTimeAsync(500);
  expect(latest.container.style.opacity).toBe('1');
  expect(document.querySelectorAll('#vkify-bg-container')).toHaveLength(1);
});

it('keeps the old wallpaper on a loading failure or timeout', async () => {
  const failure = vi.fn(), transition = createWallpaperTransition(failure);
  const swap = transition.begin(vi.fn()), image = new EventTarget();
  swap.wait(image, 'load');
  image.dispatchEvent(new Event('error'));
  expect(swap.container.isConnected).toBe(false);
  expect(document.getElementById('vkify-bg-container-previous')).not.toBeNull();
  expect(failure).toHaveBeenCalledOnce();
  const retry = transition.begin(vi.fn()); retry.wait(new EventTarget(), 'load');
  await vi.advanceTimersByTimeAsync(15000);
  expect(retry.container.isConnected).toBe(false); expect(failure).toHaveBeenCalledTimes(2);
});

it('waits for video frame readiness and fades out when resetting the wallpaper', async () => {
  const transition = createWallpaperTransition(vi.fn());
  const swap = transition.begin(vi.fn()), video = new EventTarget();
  swap.wait(video, 'loadeddata');
  video.dispatchEvent(new Event('loadedmetadata'));
  expect(swap.container.style.opacity).toBe('0');
  video.dispatchEvent(new Event('loadeddata'));
  await vi.advanceTimersByTimeAsync(500);
  const cleanup = vi.fn(); transition.clear(cleanup);
  expect(document.getElementById('vkify-bg-container')).toBeNull();
  expect(document.getElementById('vkify-bg-container-previous')).not.toBeNull();
  await vi.advanceTimersByTimeAsync(450);
  expect(document.getElementById('vkify-bg-container-previous')).toBeNull(); expect(cleanup).toHaveBeenCalledOnce();
});

it('respects reduced-motion preference while still waiting for loading', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  const transition = createWallpaperTransition(vi.fn()), cleanup = vi.fn();
  const swap = transition.begin(cleanup), iframe = new EventTarget();
  swap.wait(iframe, 'load');
  expect(swap.container.style.opacity).toBe('0');
  iframe.dispatchEvent(new Event('load'));
  expect(swap.container.style.opacity).toBe('1'); expect(cleanup).toHaveBeenCalledOnce();
});

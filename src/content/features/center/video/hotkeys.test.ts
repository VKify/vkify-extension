// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVideoHotkeysFeature, runVideoAction } from './hotkeys.js';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { DEFAULT_VIDEO_HOTKEYS } from '@/shared/video-hotkeys.js';
import { isValidSettingValue } from '@/shared/constants/settings-schema.js';

function player() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<div role="region" aria-label="Видеоплеер">
    <div data-testid="video-container"><video class="player-media"></video></div>
    <button data-testid="play-btn"></button><button data-testid="btn-next"></button>
    <button data-testid="btn-prev"></button><button data-testid="fullscreen-btn"></button>
    <div class="ads-container hidden"><div data-testid="ad-container"><video></video></div></div>
  </div>`;
  const region = root.querySelector<HTMLElement>('[role="region"]')!;
  vi.spyOn(region, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const media = root.querySelector<HTMLVideoElement>('.player-media')!;
  Object.defineProperty(media, 'duration', { configurable: true, value: 100 });
  return { host, root, region, media };
}
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('video shortcuts', () => {
  it('operates the main video in Shadow DOM and clamps seek, volume and speed', () => {
    const { media, root } = player();
    const click = vi.fn();
    root.querySelector('[data-testid="btn-next"]')!.addEventListener('click', click);
    expect(runVideoAction('next')).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    media.currentTime = 96;
    runVideoAction('seek_forward');
    expect(media.currentTime).toBe(100);
    media.currentTime = 3;
    runVideoAction('seek_backward');
    expect(media.currentTime).toBe(0);
    media.volume = 0.98;
    runVideoAction('volume_up');
    expect(media.volume).toBe(1);
    media.playbackRate = 0.25;
    runVideoAction('rate_down');
    expect(media.playbackRate).toBe(0.25);
    media.playbackRate = 3;
    runVideoAction('rate_up');
    expect(media.playbackRate).toBe(3);
    runVideoAction('rate_reset');
    expect(media.playbackRate).toBe(1);
  });

  it('does not seek the main video during a separate advertising break or without a player', () => {
    expect(runVideoAction('seek_forward')).toBe(false);
    const { media, root } = player();
    root.querySelector('.ads-container')!.classList.remove('hidden');
    root.querySelector('[data-testid="ad-container"] video')!.setAttribute('src', 'https://r.mradx.net/vrs/ad.mp4');
    media.currentTime = 5;
    expect(runVideoAction('seek_forward')).toBe(false);
    expect(media.currentTime).toBe(5);
  });

  it('uses saved shortcuts, ignores composed input events and tears down listeners', async () => {
    const { media, root } = player();
    const custom = { ...DEFAULT_VIDEO_HOTKEYS.seek_forward, code: 'KeyL' };
    const feature = createVideoHotkeysFeature({
      getSetting: vi.fn(async key => key === 'video_hotkey_seek_forward' ? custom : undefined),
      onStorageChange: vi.fn(() => vi.fn()),
    } as unknown as FeatureContext);
    await feature.enable();
    const press = (target: EventTarget) => {
      const e = new KeyboardEvent('keydown', { code: 'KeyL', ctrlKey: true, altKey: true, bubbles: true, composed: true, cancelable: true });
      target.dispatchEvent(e);
      return e;
    };
    expect(press(document).defaultPrevented).toBe(true);
    expect(media.currentTime).toBe(10);
    const input = document.createElement('input');
    root.append(input);
    expect(press(input).defaultPrevented).toBe(false);
    expect(media.currentTime).toBe(10);
    feature.disable();
    expect(press(document).defaultPrevented).toBe(false);
    expect(media.currentTime).toBe(10);
  });

  it('does not attach a late listener after disabling during settings load', async () => {
    player();
    let resolve!: (value: undefined) => void;
    const pending = new Promise<undefined>(r => { resolve = r; });
    const unsubscribe = vi.fn();
    const feature = createVideoHotkeysFeature({ getSetting: () => pending, onStorageChange: () => unsubscribe } as unknown as FeatureContext);
    const enabled = feature.enable();
    feature.disable();
    resolve(undefined);
    await enabled;
    const event = new KeyboardEvent('keydown', { code: 'KeyK', ctrlKey: true, altKey: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('imports valid customized shortcuts and rejects malformed objects', () => {
    expect(isValidSettingValue('video_hotkey_next', DEFAULT_VIDEO_HOTKEYS.next, 'import')).toBe(true);
    expect(isValidSettingValue('video_hotkey_next', { code: 'KeyK' }, 'import')).toBe(false);
    expect(isValidSettingValue('video_hotkey_next', DEFAULT_VIDEO_HOTKEYS.next, 'siteWrite')).toBe(false);
  });
});

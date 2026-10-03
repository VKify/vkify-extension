// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureManager } from '@/content/core/feature-manager.js';
import { createBackgroundFeatures } from './index.js';
import { DEFAULT_WALLPAPER_SCHEDULE, captureWallpaper } from '@/shared/wallpaper-schedule.js';

describe('scheduled background rendering', () => {
  const day = captureWallpaper({ custom_background: 'https://example.com/day.jpg' });
  const night = captureWallpaper({ custom_background: 'https://example.com/night.jpg' });
  let settings: Record<string, unknown>;
  let handlers: ReturnType<typeof createBackgroundFeatures>;
  const injectCSS = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', class extends EventTarget { complete = true; naturalWidth = 100; src = ''; });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    vi.setSystemTime(new Date(2026, 9, 3, 6, 59, 59));
    injectCSS.mockClear();
    settings = { custom_background: 'https://example.com/manual.jpg', background_type: 'image', wallpaper_schedule_enabled: true,
      wallpaper_schedule: JSON.stringify({ ...DEFAULT_WALLPAPER_SCHEDULE, day, night }) };
    handlers = createBackgroundFeatures({
      getSetting: async (key: string) => settings[key],
      getFeatureHandler: (key: string) => handlers[key], injectCSS, removeCSS: vi.fn(),
    } as unknown as FeatureManager);
  });
  afterEach(async () => {
    settings.wallpaper_schedule_enabled = false;
    await handlers.wallpaper_schedule_enabled.disable();
    await vi.advanceTimersByTimeAsync(1);
    await handlers.custom_background.disable();
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });
  it('switches at the boundary and restores manual wallpaper when disabled', async () => {
    await handlers.wallpaper_schedule_enabled.enable(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(injectCSS.mock.lastCall?.[1]).toContain('night.jpg');
    await vi.advanceTimersByTimeAsync(1100);
    expect(injectCSS.mock.lastCall?.[1]).toContain('day.jpg');
    expect(settings.custom_background).toContain('manual.jpg');
    settings.wallpaper_schedule_enabled = false;
    await handlers.wallpaper_schedule_enabled.disable();
    await vi.advanceTimersByTimeAsync(1);
    expect(injectCSS.mock.lastCall?.[1]).toContain('manual.jpg');
  });
  it('renders scheduled wallpaper with no manually selected background and recovers after sleep', async () => {
    settings.custom_background = '';
    await handlers.wallpaper_schedule_enabled.enable(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(injectCSS.mock.lastCall?.[1]).toContain('night.jpg');
    vi.setSystemTime(new Date(2026, 9, 3, 12));
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1);
    expect(injectCSS.mock.lastCall?.[1]).toContain('day.jpg');
    const count = injectCSS.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(injectCSS).toHaveBeenCalledTimes(count);
  });
});

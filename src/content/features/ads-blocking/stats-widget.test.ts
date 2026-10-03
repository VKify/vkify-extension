// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureContext } from '../../core/feature-context.js';
import { createAdStatsWidget } from './stats-widget.js';

vi.mock('../../ui/floating-widget.js', () => ({
  createFloatingWidget: () => {
    const root = document.createElement('section'), head = document.createElement('header'), body = document.createElement('div');
    root.append(head, body);
    return { root, head, body, mount: () => document.body.append(root), reattach: vi.fn(), show: vi.fn(), hide: vi.fn(), destroy: () => root.remove() };
  },
}));

type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
let listener: Listener;
let resolveRead: (data: Record<string, unknown>) => void;
let feature: ReturnType<typeof createAdStatsWidget>;
let frames: Map<number, FrameRequestCallback>;
let removeListener: ReturnType<typeof vi.fn>;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); for (const [id, cb] of frames) { frames.delete(id); cb(0); } };
const total = () => document.querySelector('.vkify-ad-stats__total')?.textContent;

beforeEach(() => {
  document.body.replaceChildren(); frames = new Map();
  vi.stubGlobal('requestAnimationFrame', vi.fn(cb => { const id = frames.size + 1; frames.set(id, cb); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(id => frames.delete(id)));
  removeListener = vi.fn();
  vi.stubGlobal('chrome', { storage: {
    local: { get: vi.fn(() => new Promise<Record<string, unknown>>(resolve => { resolveRead = resolve; })) },
    onChanged: { addListener: (cb: Listener) => { listener = cb; }, removeListener },
  } });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  feature = createAdStatsWidget({
    getSetting: async () => true, onStorageChange: () => () => {}, setSetting: vi.fn(),
  } as unknown as FeatureContext);
});
afterEach(async () => { await feature.disable(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ad statistics widget', () => {
  it('preserves newer storage events during hydration and coalesces updates', async () => {
    await feature.enable();
    listener({ stats_ads_blocked: { newValue: 8 } }, 'local');
    listener({ stats_ads_blocked: { newValue: 9 } }, 'local');
    resolveRead({ stats_ads_blocked: 2, stats_trackers_blocked: 3 });
    expect(frames.size).toBe(1);
    await flush(); expect(total()).toBe('12');
    listener({ stats_ads_blocked: { newValue: 0 }, stats_trackers_blocked: { newValue: 0 } }, 'local');
    await flush(); expect(total()).toBe('0');
  });
  it('defers rendering while the tab is hidden and ignores other storage areas', async () => {
    await feature.enable(); resolveRead({ stats_ads_blocked: 4 }); await flush();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    listener({ stats_ads_blocked: { newValue: 10 } }, 'local');
    expect(frames.size).toBe(0); expect(total()).toBe('4');
    listener({ stats_ads_blocked: { newValue: 99 } }, 'sync');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange')); await flush(); expect(total()).toBe('10');
  });
  it('cancels pending rendering and ignores a late read after disable', async () => {
    await feature.enable(); await feature.disable();
    expect(removeListener).toHaveBeenCalledWith(listener); expect(frames.size).toBe(0);
    resolveRead({ stats_ads_blocked: 10 }); await flush();
    expect(total()).toBeUndefined(); expect(frames.size).toBe(0);
  });
});

/**
 * Tests for the popup Zustand store — settings slice.
 *
 * Since step 5 of the shared-store migration, the slice is a thin DELEGATE over
 * the canonical `settingsStore` (src/shared/store): all storage IO, migrations
 * and the chrome.storage.onChanged listener live there. The popup slice only
 * (a) forwards writes to settingsStore and (b) mirrors its state back, so the
 * 40+ `useVKifyStore(s => s.settings)` consumers keep working unchanged.
 *
 * These tests cover that contract:
 *   - saveSetting / saveMultiple forward to settingsStore (which writes through)
 *   - initStorageSync mirrors settingsStore → popup store on every change
 *   - loadSettings reflects the canonical state
 *   - resetSettings delegates (auth/spy preserved, RESET_SETTINGS applied)
 * Non-UI-key filtering and onChanged reconciliation are the store's job and are
 * covered by settings-store.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageKey } from '../shared/constants/storage-keys.js';
import { RESET_SETTINGS } from '../shared/constants/defaults.js';
import { serializeSettings } from '../shared/settings-export.js';

// In-memory backing for chrome.storage.local. Stubbed before importing the store
// (its module graph — via settingsStore — touches chrome at import time).
const backing: Record<string, unknown> = {};

const storageMock = {
  get: vi.fn(async (keys?: string | string[] | null) => {
    if (keys == null) return { ...backing };
    if (Array.isArray(keys)) {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (k in backing) out[k] = backing[k];
      return out;
    }
    return keys in backing ? { [keys as string]: backing[keys as string] } : {};
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(backing, items);
  }),
  clear: vi.fn(async () => {
    for (const k of Object.keys(backing)) delete backing[k];
  }),
};

vi.stubGlobal('chrome', {
  storage: {
    local: storageMock,
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: { getManifest: () => ({ version: '1.7.0' }), sendMessage: vi.fn(async () => ({})) },
});

const { useVKifyStore } = await import('../popup/store/index.js');
const { __resetStorageSyncForTests } = await import('../popup/store/slices/settingsSlice.js');
const { settingsStore } = await import('../shared/store/settings.js');

/** Let the canonical store's fire-and-forget write-through settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  for (const k of Object.keys(backing)) delete backing[k];
  settingsStore.setState({ settings: {}, loading: false });
  useVKifyStore.setState({ settings: {}, loading: true, apiAdsReloadRequest: null });
  __resetStorageSyncForTests();
  vi.clearAllMocks();
});

describe('settingsSlice — saveSetting (delegation)', () => {
  it('forwards to settingsStore and writes through to storage', async () => {
    const ok = await useVKifyStore.getState().saveSetting('hide_stories', true);
    expect(ok).toBe(true);
    // Canonical store updated synchronously...
    expect(settingsStore.getState().settings.hide_stories).toBe(true);
    // ...and persisted to storage by the store's middleware.
    await flush();
    expect(storageMock.set).toHaveBeenCalledWith({ hide_stories: true });
  });

  it('saveMultiple forwards a batch to settingsStore', async () => {
    await useVKifyStore.getState().saveMultiple({ block_left_ads: false, hide_stories: true });
    expect(settingsStore.getState().settings.block_left_ads).toBe(false);
    expect(settingsStore.getState().settings.hide_stories).toBe(true);
  });

  it('requests an API reload only when an explicit write changes the API setting', async () => {
    useVKifyStore.getState().initStorageSync();
    settingsStore.setState({ settings: { block_feed_ads_api: true } });
    expect(useVKifyStore.getState().apiAdsReloadRequest).toBeNull();
    await useVKifyStore.getState().saveSetting('hide_stories', true);
    await useVKifyStore.getState().saveSetting('block_feed_ads_api', true);
    expect(useVKifyStore.getState().apiAdsReloadRequest).toBeNull();
    await useVKifyStore.getState().saveSetting('block_feed_ads_api', false);
    expect(useVKifyStore.getState().apiAdsReloadRequest).toEqual({ enabled: false });
    await useVKifyStore.getState().saveMultiple({ block_feed_ads_api: true, block_left_ads: true });
    expect(useVKifyStore.getState().apiAdsReloadRequest).toEqual({ enabled: true });
  });
});

describe('settingsSlice — mirror (initStorageSync)', () => {
  it('reflects settingsStore changes into the popup store', () => {
    useVKifyStore.getState().initStorageSync();
    // A change in the canonical store propagates to the popup store synchronously.
    settingsStore.getState().setSettings({ block_left_ads: false });
    expect(useVKifyStore.getState().settings.block_left_ads).toBe(false);
  });

  it('does the initial sync immediately on attach', () => {
    settingsStore.setState({ settings: { compact_spacing: true }, loading: false });
    useVKifyStore.getState().initStorageSync();
    expect(useVKifyStore.getState().settings.compact_spacing).toBe(true);
    expect(useVKifyStore.getState().loading).toBe(false);
  });
});

describe('settingsSlice — loadSettings (mirror read)', () => {
  it('reflects the canonical store state', async () => {
    settingsStore.setState({ settings: { hide_stories: true }, loading: false });
    await useVKifyStore.getState().loadSettings();
    expect(useVKifyStore.getState().settings.hide_stories).toBe(true);
    expect(useVKifyStore.getState().loading).toBe(false);
  });
});

describe('settingsSlice — resetSettings (delegation)', () => {
  it('preserves auth/spy keys and applies RESET_SETTINGS via the store', async () => {
    Object.assign(backing, {
      [StorageKey.VK_ACCESS_TOKEN]: 'tok',
      [StorageKey.ONLINE_SPY_STATS]: { foo: 1 },
      hide_stories: true,
      block_left_ads: false,
    });

    useVKifyStore.setState({ apiAdsReloadRequest: { enabled: true } });

    const ok = await useVKifyStore.getState().resetSettings();
    expect(ok).toBe(true);
    expect(useVKifyStore.getState().apiAdsReloadRequest).toBeNull();
    expect(storageMock.clear).toHaveBeenCalled();

    // Auth/spy data survives the reset...
    expect(backing[StorageKey.VK_ACCESS_TOKEN]).toBe('tok');
    expect(backing[StorageKey.ONLINE_SPY_STATS]).toEqual({ foo: 1 });
    // ...and RESET_SETTINGS defaults are re-applied.
    expect(backing.block_left_ads).toBe(RESET_SETTINGS.block_left_ads);
    expect(settingsStore.getState().settings.block_left_ads).toBe(RESET_SETTINGS.block_left_ads);
  });
});

describe('settingsSlice — legacy ads import', () => {
  it('migrates old backup choices before sanitizing and saving', async () => {
    useVKifyStore.setState({ apiAdsReloadRequest: { enabled: true } });
    const file = { text: async () => JSON.stringify({ settings: {
      hide_recommendations: false, hide_audio_ads: true, hidden_menu_items: [],
    } }) } as File;
    expect(await useVKifyStore.getState().importSettings(file)).toBe(true);
    expect(useVKifyStore.getState().apiAdsReloadRequest).toBeNull();
    expect(backing.block_recommendations_feed).toBe(false);
    expect(backing.block_recommendations_games).toBe(false);
    expect(backing.block_music_ads).toBe(true);
    expect(backing.block_yandex_browser_promo).toBe(false);
    expect(backing.block_recommendations_communities).toBe(true);
    expect(backing).not.toHaveProperty('hide_recommendations');
    expect(backing).not.toHaveProperty('hide_audio_ads');
  });
});

describe('settingsSlice — background import', () => {
  it.each(['wrapped', 'legacy'])('restores an uploaded 5 MiB image from a %s backup', async format => {
    const custom_background = `data:image/png;base64,${'A'.repeat(4 * Math.ceil(5 * 1024 * 1024 / 3))}`;
    const settings = { custom_background, background_type: 'image', background_dim: 45 };
    const json = format === 'wrapped' ? serializeSettings(settings) : JSON.stringify(settings);
    useVKifyStore.getState().initStorageSync();
    const file = { text: async () => json } as File;

    expect(await useVKifyStore.getState().importSettings(file)).toBe(true);
    expect(backing.custom_background === custom_background).toBe(true);
    expect(backing).toMatchObject({ background_type: 'image', background_dim: 45 });
    expect(settingsStore.getState().settings.custom_background === custom_background).toBe(true);
    expect(useVKifyStore.getState().settings.custom_background === custom_background).toBe(true);
  });
});

describe('settingsSlice — wallpaper schedule import', () => {
  const wallpaper = { url: 'https://example.com/day.jpg', type: 'image', presetId: '', webId: '', webSchema: '[]' };

  it.each([null, wallpaper])('preserves wallpaper slots while disabling incomplete schedules (%j)', async night => {
    const schedule = JSON.stringify({ dayStart: '08:00', nightStart: '23:00', day: wallpaper, night });
    const file = { text: async () => JSON.stringify({ settings: { wallpaper_schedule: schedule,
      wallpaper_schedule_enabled: true, custom_background: 'https://example.com/manual.jpg' } }) } as File;
    expect(await useVKifyStore.getState().importSettings(file)).toBe(true);
    expect(backing.wallpaper_schedule).toBe(schedule);
    expect(backing.wallpaper_schedule_enabled).toBe(!!night);
    expect(backing.custom_background).toBe('https://example.com/manual.jpg');
    expect(settingsStore.getState().settings.wallpaper_schedule_enabled).toBe(!!night);
  });

  it('initializes disabled scheduling when importing a legacy backup', async () => {
    const file = { text: async () => JSON.stringify({ custom_background: 'https://example.com/manual.jpg' }) } as File;
    expect(await useVKifyStore.getState().importSettings(file)).toBe(true);
    expect(backing.wallpaper_schedule_enabled).toBe(false);
    expect(JSON.parse(backing.wallpaper_schedule as string)).toEqual({ dayStart: '07:00', nightStart: '22:00', day: null, night: null });
  });
});

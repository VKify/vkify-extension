/**
 * Tests for the popup Zustand store — settings slice.
 *
 * Covers the behavior that the old SettingsContext hand-rolled and that the
 * 37 `useSettings()` consumers depend on:
 *   - saveSetting writes through to chrome.storage.local and updates state
 *   - loadSettings / storage.onChanged filter out non-UI keys (auth, spy data,
 *     runtime counters) so they never enter React state
 *   - resetSettings preserves auth/spy keys and applies RESET_SETTINGS
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageKey } from '../shared/constants/storage-keys.js';
import { RESET_SETTINGS } from '../shared/constants/defaults.js';

// In-memory backing for chrome.storage.local. Must be stubbed before importing
// the store (its module graph touches chrome).
const backing: Record<string, unknown> = {};
let changeListener:
  | ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void)
  | undefined;

const storageMock = {
  get: vi.fn(async (keys?: string | string[] | null) => {
    if (keys == null) return { ...backing };
    if (Array.isArray(keys)) {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (k in backing) out[k] = backing[k];
      return out;
    }
    return keys in backing ? { [keys]: backing[keys] } : {};
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
    onChanged: {
      addListener: vi.fn((cb: typeof changeListener) => {
        changeListener = cb;
      }),
      removeListener: vi.fn(),
    },
  },
  runtime: { getManifest: () => ({ version: '1.6.3' }) },
});

const { useVKifyStore } = await import('../popup/store/index.js');
const { __resetStorageSyncForTests } = await import('../popup/store/slices/settingsSlice.js');

beforeEach(() => {
  for (const k of Object.keys(backing)) delete backing[k];
  useVKifyStore.setState({ settings: {}, loading: true });
  vi.clearAllMocks();
});

describe('settingsSlice — saveSetting', () => {
  it('writes through to storage and updates state', async () => {
    const ok = await useVKifyStore.getState().saveSetting('hide_stories', true);
    expect(ok).toBe(true);
    expect(storageMock.set).toHaveBeenCalledWith({ hide_stories: true });
    expect(useVKifyStore.getState().settings.hide_stories).toBe(true);
  });
});

describe('settingsSlice — loadSettings', () => {
  it('keeps UI keys and drops auth/spy/runtime keys', async () => {
    Object.assign(backing, {
      hide_stories: true,
      [StorageKey.VK_ACCESS_TOKEN]: 'secret',
      stats_ads_blocked: 42,
      activity_123: [1, 2, 3],
    });

    await useVKifyStore.getState().loadSettings();
    const s = useVKifyStore.getState().settings;

    expect(s.hide_stories).toBe(true);
    expect(s[StorageKey.VK_ACCESS_TOKEN]).toBeUndefined();
    expect(s.stats_ads_blocked).toBeUndefined();
    expect(s.activity_123).toBeUndefined();
    expect(useVKifyStore.getState().loading).toBe(false);
  });
});

describe('settingsSlice — initStorageSync listener', () => {
  it('applies UI-key changes and ignores non-UI keys', async () => {
    __resetStorageSyncForTests();
    useVKifyStore.getState().initStorageSync();
    expect(changeListener).toBeDefined();

    changeListener!(
      {
        block_left_ads: { newValue: false, oldValue: true },
        stats_ads_blocked: { newValue: 99, oldValue: 0 },
      },
      'local',
    );

    const s = useVKifyStore.getState().settings;
    expect(s.block_left_ads).toBe(false);
    expect(s.stats_ads_blocked).toBeUndefined();
  });

  it('ignores changes from areas other than local', () => {
    __resetStorageSyncForTests();
    useVKifyStore.getState().initStorageSync();

    changeListener!({ hide_stories: { newValue: true } }, 'sync');
    expect(useVKifyStore.getState().settings.hide_stories).toBeUndefined();
  });
});

describe('settingsSlice — resetSettings', () => {
  it('preserves auth/spy keys and applies RESET_SETTINGS', async () => {
    Object.assign(backing, {
      [StorageKey.VK_ACCESS_TOKEN]: 'tok',
      [StorageKey.ONLINE_SPY_STATS]: { foo: 1 },
      hide_stories: true,
      block_left_ads: false,
    });

    const ok = await useVKifyStore.getState().resetSettings();
    expect(ok).toBe(true);
    expect(storageMock.clear).toHaveBeenCalled();

    // Auth/spy data survives the reset...
    expect(backing[StorageKey.VK_ACCESS_TOKEN]).toBe('tok');
    expect(backing[StorageKey.ONLINE_SPY_STATS]).toEqual({ foo: 1 });
    // ...and RESET_SETTINGS defaults are re-applied.
    expect(backing.block_left_ads).toBe(RESET_SETTINGS.block_left_ads);
    expect(useVKifyStore.getState().settings.block_left_ads).toBe(RESET_SETTINGS.block_left_ads);
  });
});

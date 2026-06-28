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
  runtime: { getManifest: () => ({ version: '1.7.0' }) },
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
  useVKifyStore.setState({ settings: {}, loading: true });
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

    const ok = await useVKifyStore.getState().resetSettings();
    expect(ok).toBe(true);
    expect(storageMock.clear).toHaveBeenCalled();

    // Auth/spy data survives the reset...
    expect(backing[StorageKey.VK_ACCESS_TOKEN]).toBe('tok');
    expect(backing[StorageKey.ONLINE_SPY_STATS]).toEqual({ foo: 1 });
    // ...and RESET_SETTINGS defaults are re-applied.
    expect(backing.block_left_ads).toBe(RESET_SETTINGS.block_left_ads);
    expect(settingsStore.getState().settings.block_left_ads).toBe(RESET_SETTINGS.block_left_ads);
  });
});

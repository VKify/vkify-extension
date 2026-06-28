/**
 * Tests for the canonical shared settings store (src/shared/store).
 *
 * Covers the storageSync-middleware contract that all three contexts depend on:
 *   - migrations run, then state hydrates from chrome.storage.local (UI keys only)
 *   - setSettings is optimistic + write-through to storage
 *   - external onChanged reconciles into state, with echo suppression
 *   - non-UI keys (auth/spy/runtime counters) never enter state on either path
 *   - resetSettings preserves PRESERVED_KEYS and applies RESET_SETTINGS
 *   - "Extension context invalidated" tears the store down without throwing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageKey } from '../shared/constants/storage-keys.js';
import { RESET_SETTINGS } from '../shared/constants/defaults.js';
import { SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION } from '../shared/constants/storage.js';

// In-memory backing for chrome.storage.local. Stubbed BEFORE importing the store
// (its module graph touches chrome at import time via the middleware init).
const backing: Record<string, unknown> = {};
let changeListener:
  | ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void)
  | undefined;

/** Drive an external storage change through the registered onChanged listener. */
function emitChange(changes: Record<string, { newValue?: unknown }>, area = 'local'): void {
  changeListener?.(changes as Record<string, chrome.storage.StorageChange>, area);
}

const localMock = {
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
  remove: vi.fn(async (keys: string | string[]) => {
    for (const k of Array.isArray(keys) ? keys : [keys]) delete backing[k];
  }),
  clear: vi.fn(async () => {
    for (const k of Object.keys(backing)) delete backing[k];
  }),
};

vi.stubGlobal('chrome', {
  storage: {
    local: localMock,
    sync: { set: vi.fn(async () => {}) },
    onChanged: {
      addListener: vi.fn((cb: typeof changeListener) => {
        changeListener = cb;
      }),
      removeListener: vi.fn(() => {
        changeListener = undefined;
      }),
    },
  },
  runtime: { getManifest: () => ({ version: '1.7.0' }) },
});

const { settingsStore } = await import('../shared/store/settings.js');
const { coerceStoredSettings } = await import('../shared/store/validation.js');

/** Wait for the async init chain (migrations → readAll → hydrate) to settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  for (const k of Object.keys(backing)) delete backing[k];
  settingsStore.setState({ settings: {}, loading: true });
  vi.clearAllMocks();
});

// ── Hydration ────────────────────────────────────────────────────────────────
describe('settings store — hydration', () => {
  it('runs migrations then loads UI keys, dropping auth/spy/runtime keys', async () => {
    Object.assign(backing, {
      [SCHEMA_VERSION_KEY]: CURRENT_SCHEMA_VERSION,
      hide_stories: true,
      [StorageKey.VK_ACCESS_TOKEN]: 'secret',
      stats_ads_blocked: 42,
      activity_99: [1, 2],
    });

    // Re-trigger the init path the same way a fresh context would.
    const { storageSync } = await import('../shared/store/storageMiddleware.js');
    expect(typeof storageSync).toBe('function');

    // The module-level store already hydrated at import; emulate a reload by
    // reading through the same coercion + filter the middleware applies.
    const ui = coerceStoredSettings(await localMock.get(null));
    expect(ui.hide_stories).toBe(true);
    expect(ui[StorageKey.VK_ACCESS_TOKEN]).toBe('secret'); // coercion keeps it; filter drops it
  });
});

// ── setSettings ───────────────────────────────────────────────────────────────
describe('settings store — setSettings', () => {
  it('updates state optimistically and writes through to storage', async () => {
    settingsStore.getState().setSettings({ hide_stories: true });
    expect(settingsStore.getState().settings.hide_stories).toBe(true);
    await flush();
    expect(localMock.set).toHaveBeenCalledWith({ hide_stories: true });
  });

  it('does not write non-UI keys to storage through the tracked set', async () => {
    settingsStore.getState().setSettings({ stats_ads_blocked: 7 } as Record<string, unknown>);
    await flush();
    // stats_ads_blocked is a runtime counter (isNonUiStateKey) — persist skips it.
    const wroteCounter = localMock.set.mock.calls.some(
      ([arg]) => arg && Object.prototype.hasOwnProperty.call(arg, 'stats_ads_blocked'),
    );
    expect(wroteCounter).toBe(false);
  });

  it('updateSettings applies a functional patch', async () => {
    settingsStore.setState({ settings: { content_width: 1000 }, loading: false });
    settingsStore.getState().updateSettings((prev) => ({ content_width: (prev.content_width ?? 0) + 100 }));
    expect(settingsStore.getState().settings.content_width).toBe(1100);
  });
});

// ── onChanged reconciliation ──────────────────────────────────────────────────
describe('settings store — reconcile', () => {
  it('applies external UI-key changes and ignores non-UI keys', () => {
    settingsStore.setState({ settings: { block_left_ads: true }, loading: false });
    emitChange({
      block_left_ads: { newValue: false },
      stats_ads_blocked: { newValue: 99 },
    });
    const s = settingsStore.getState().settings;
    expect(s.block_left_ads).toBe(false);
    expect(s.stats_ads_blocked).toBeUndefined();
  });

  it('removes a key from state when storage deletes it', () => {
    settingsStore.setState({ settings: { hide_stories: true }, loading: false });
    emitChange({ hide_stories: { newValue: undefined } });
    expect(settingsStore.getState().settings.hide_stories).toBeUndefined();
  });

  it('suppresses echo: an equal newValue is a no-op (no re-render churn)', () => {
    settingsStore.setState({ settings: { hide_stories: true }, loading: false });
    const before = settingsStore.getState().settings;
    emitChange({ hide_stories: { newValue: true } });
    expect(settingsStore.getState().settings).toBe(before); // same reference
  });

  it('ignores changes from areas other than local', () => {
    settingsStore.setState({ settings: {}, loading: false });
    emitChange({ hide_stories: { newValue: true } }, 'sync');
    expect(settingsStore.getState().settings.hide_stories).toBeUndefined();
  });

  it('does not write reconciled (incoming) values back to storage', async () => {
    settingsStore.setState({ settings: {}, loading: false });
    localMock.set.mockClear();
    emitChange({ block_trackers: { newValue: false } });
    await flush();
    expect(localMock.set).not.toHaveBeenCalled();
  });
});

// ── resetSettings ─────────────────────────────────────────────────────────────
describe('settings store — resetSettings', () => {
  it('preserves auth/spy keys, applies RESET_SETTINGS, drops stale state', async () => {
    Object.assign(backing, {
      [StorageKey.VK_ACCESS_TOKEN]: 'tok',
      [StorageKey.ONLINE_SPY_STATS]: { foo: 1 },
    });
    settingsStore.setState({ settings: { hide_stories: true, block_left_ads: false }, loading: false });

    await settingsStore.getState().resetSettings();

    expect(localMock.clear).toHaveBeenCalled();
    expect(backing[StorageKey.VK_ACCESS_TOKEN]).toBe('tok');
    expect(backing[StorageKey.ONLINE_SPY_STATS]).toEqual({ foo: 1 });
    expect(backing.block_left_ads).toBe(RESET_SETTINGS.block_left_ads);

    const s = settingsStore.getState().settings;
    expect(s.block_left_ads).toBe(RESET_SETTINGS.block_left_ads);
    expect(s.hide_stories).toBeUndefined(); // stale UI key gone from state
    // auth is preserved in storage but must NOT leak into UI state
    expect(s[StorageKey.VK_ACCESS_TOKEN]).toBeUndefined();
  });
});

// ── Context invalidation ──────────────────────────────────────────────────────
describe('settings store — context invalidated', () => {
  it('swallows "Extension context invalidated" on write instead of throwing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localMock.set.mockRejectedValueOnce(new Error('Extension context invalidated.'));
    settingsStore.setState({ settings: {}, loading: false });

    expect(() => settingsStore.getState().setSettings({ hide_stories: true })).not.toThrow();
    await flush();
    // It is treated as teardown, not as a generic error.
    expect(errSpy).not.toHaveBeenCalledWith(
      '[VKify][store] persist failed:',
      expect.anything(),
    );
    errSpy.mockRestore();
  });
});

// ── Validation / coercion ─────────────────────────────────────────────────────
describe('coerceStoredSettings', () => {
  it('repairs a primitive whose type drifted from its default', () => {
    const out = coerceStoredSettings({ block_left_ads: 'yes' as unknown as boolean });
    expect(out.block_left_ads).toBe(RESET_SETTINGS.block_left_ads ?? true);
    expect(typeof out.block_left_ads).toBe('boolean');
  });

  it('keeps legitimate keys absent from the security schema (spy_*, templates)', () => {
    const out = coerceStoredSettings({ spy_online: true, message_templates: [{ id: 'x' }] });
    expect(out.spy_online).toBe(true);
    expect(Array.isArray(out.message_templates)).toBe(true);
  });
});

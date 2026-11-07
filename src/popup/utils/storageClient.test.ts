import { afterEach, expect, it, vi } from 'vitest';
import { updateStorage } from './storageClient.js';

afterEach(() => vi.unstubAllGlobals());

it('serializes overlapping widget edits and merges each with the last persisted state', async () => {
  let stored = { widgetStack: { glassBlur: 12, glassOpacity: .3, position: { left: 100 } } };
  let finish!: () => void;
  const get = vi.fn(async () => structuredClone(stored));
  const set = vi.fn(async (patch: typeof stored) => {
    if (set.mock.calls.length === 1) await new Promise<void>(resolve => { finish = resolve; });
    stored = structuredClone(patch);
  });
  vi.stubGlobal('chrome', { storage: { local: { get, set } } });
  const blur = updateStorage(current => ({ widgetStack: { ...current.widgetStack as object, glassBlur: 60 } }));
  await vi.waitFor(() => expect(set).toHaveBeenCalledOnce());
  const opacity = updateStorage(current => ({ widgetStack: { ...current.widgetStack as object, glassOpacity: 0 } }));
  expect(get).toHaveBeenCalledOnce(); finish(); await Promise.all([blur, opacity]);
  expect(stored.widgetStack).toEqual({ glassBlur: 60, glassOpacity: 0, position: { left: 100 } });
});

it('reports a rejected save without blocking subsequent edits', async () => {
  const set = vi.fn().mockRejectedValueOnce(new Error('storage failed')).mockResolvedValue(undefined);
  vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(async () => ({ widgetStack: { glassBlur: 24 } })), set } } });
  await expect(updateStorage(() => ({ widgetStack: { glassBlur: 60 } }))).rejects.toThrow('storage failed');
  await updateStorage(current => ({ widgetStack: { ...current.widgetStack as object, glassOpacity: 0 } }));
  expect(set.mock.lastCall?.[0]).toEqual({ widgetStack: { glassBlur: 24, glassOpacity: 0 } });
});

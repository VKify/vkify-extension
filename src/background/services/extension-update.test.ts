import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/shared/constants/browser.js', () => ({ IS_FIREFOX: true }));
let stored: Record<string, unknown>;
vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '2.0.0' }) }, storage: { local: {
  get: async () => stored, set: async (items: Record<string, unknown>) => { Object.assign(stored, items); },
} } });

beforeEach(() => { stored = {}; vi.resetModules(); });
describe('Firefox release check', () => {
  it('shares concurrent requests, caches the release and compares numeric versions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tag_name: 'v2.1.0', assets: [{ name: 'vkify-2.1.0.xpi' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const { checkExtensionUpdate } = await import('./extension-update.js');
    const [a, b] = await Promise.all([checkExtensionUpdate(), checkExtensionUpdate()]);
    expect(a).toMatchObject({ available: true, currentVersion: '2.0.0', latestVersion: '2.1.0' });
    expect(b).toEqual(a);
    await checkExtensionUpdate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('allows retry after a network error without claiming the extension is up to date', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({
      ok: true, json: async () => ({ tag_name: 'v2.0.0', assets: [{ name: 'vkify.xpi' }] }),
    }));
    const { checkExtensionUpdate } = await import('./extension-update.js');
    await expect(checkExtensionUpdate()).rejects.toThrow('Offline');
    expect(await checkExtensionUpdate(true)).toMatchObject({ available: false });
  });
  it('reuses a persisted cache after the Firefox event page restarts', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stored = { extension_update_cache: {
      currentVersion: '2.0.0', latestVersion: '2.0.1', available: true, checkedAt: Date.now(),
    } };
    const { checkExtensionUpdate } = await import('./extension-update.js');
    expect(await checkExtensionUpdate()).toMatchObject({ available: true, latestVersion: '2.0.1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

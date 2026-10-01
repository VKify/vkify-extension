import { IS_FIREFOX } from '@/shared/constants/browser.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { RELEASE_API_URL, readReleaseVersion, isNewerVersion, type ExtensionUpdate } from '@/shared/extension-update.js';

let cached: ExtensionUpdate | null = null;
let pending: Promise<ExtensionUpdate> | null = null;

export async function checkExtensionUpdate(force = false): Promise<ExtensionUpdate> {
  if (!IS_FIREFOX) throw new Error('Firefox only');
  if (pending) return pending;
  if (cached && Date.now() >= cached.checkedAt && Date.now() - cached.checkedAt < (force ? 30_000 : 3_600_000)) return cached;
  pending = (async () => {
    // Firefox event pages can unload between popup openings; retain the cache across restarts.
    if (!cached) {
      try {
        const raw = await chrome.storage.local.get(StorageKey.EXTENSION_UPDATE_CACHE);
        const stored = raw[StorageKey.EXTENSION_UPDATE_CACHE] as ExtensionUpdate | undefined;
        const current = chrome.runtime.getManifest().version;
        if (stored?.currentVersion === current && typeof stored.latestVersion === 'string'
          && typeof stored.available === 'boolean' && Number.isFinite(stored.checkedAt)) cached = stored;
      } catch { /* A cache read failure must not prevent checking releases. */ }
    }
    const age = cached ? Date.now() - cached.checkedAt : Infinity;
    if (cached && age >= 0 && age < (force ? 30_000 : 3_600_000)) return cached;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(RELEASE_API_URL, {
        signal: controller.signal,
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-cache',
      });
      if (!response.ok) throw new Error(`Release check failed: ${response.status}`);
      const latestVersion = readReleaseVersion(await response.json());
      const currentVersion = chrome.runtime.getManifest().version;
      cached = { currentVersion, latestVersion, available: isNewerVersion(latestVersion, currentVersion), checkedAt: Date.now() };
      try { await chrome.storage.local.set({ [StorageKey.EXTENSION_UPDATE_CACHE]: cached }); }
      catch { /* The fetched result remains useful even when storage is full. */ }
      return cached;
    } finally {
      clearTimeout(timer);
    }
  })();
  try { return await pending; } finally { pending = null; }
}

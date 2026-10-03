import { EXPORT_EXCLUDED_KEYS, isNonUiStateKey } from '@/popup/store/keys.js';

/** The same portable, credential-free file for local and VK document exports. */
export function serializeSettings(settings: Record<string, unknown>): string {
  return JSON.stringify({
    version: chrome.runtime.getManifest().version,
    exportedAt: new Date().toISOString(),
    settings: Object.fromEntries(Object.entries(settings).filter(
      ([key]) => !isNonUiStateKey(key) && !EXPORT_EXCLUDED_KEYS.has(key),
    )),
  }, null, 2);
}

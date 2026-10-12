// Restore inputs at document_start so theme CSS can style elements as they appear.
// Extension storage remains authoritative; previews never enter the persistent cache.
import { applyThemeState, type ThemeInputs } from './state.js';
export { applyThemeState } from './state.js';

const MIRROR_KEY = 'vkify:theme';
export const THEME_MIRROR_KEYS = [
  'custom_theme', 'custom_accent', 'block_opacity', 'glass_blur', 'theme_radius', 'block_depth',
] as const;
let revision = 0;

function pickInputs(settings: Record<string, unknown>): ThemeInputs {
  return Object.fromEntries(THEME_MIRROR_KEYS.map(key => [key, settings[key]]));
}

function writeMirror(settings: Record<string, unknown>): void {
  try {
    const serialized = JSON.stringify(pickInputs(settings));
    if (localStorage.getItem(MIRROR_KEY) !== serialized) localStorage.setItem(MIRROR_KEY, serialized);
  } catch { /* quota / disabled storage */ }
}

/** Later settings or preview requests must supersede an in-flight startup read. */
export function invalidatePendingThemeRead(): number { return ++revision; }
export function getThemeStateRevision(): number { return revision; }

export function applyThemeFromMirror(): void {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return;
    const inputs: unknown = JSON.parse(raw);
    if (inputs && typeof inputs === 'object' && !Array.isArray(inputs)) applyThemeState(inputs);
  } catch { /* authoritative settings repair corrupt caches */ }
}

export function reconcileThemeFromSettings(settings: Record<string, unknown>): void {
  invalidatePendingThemeRead();
  applyThemeState(pickInputs(settings));
  writeMirror(settings);
}

/** Read only theme keys without waiting for DOMContentLoaded or application init. */
export function reconcileThemeEarlyFromStorage(): void {
  const request = revision;
  try {
    void chrome.storage.local.get([...THEME_MIRROR_KEYS]).then(settings => {
      if (request === revision) reconcileThemeFromSettings(settings);
    }).catch(() => {});
  } catch { /* orphaned extension context */ }
}

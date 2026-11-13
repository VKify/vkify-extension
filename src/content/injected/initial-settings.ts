import { PROTECTION_SETTINGS_SLOT } from '../../shared/constants/protection-startup.js';

/** Read initial flags synchronously while the injected script is executing. */
export function readInitialSettings(): Record<string, unknown> {
  try {
    const attribute = document.currentScript?.getAttribute('data-vkify-initial-settings');
    const value = attribute ? JSON.parse(attribute) : Reflect.get(window, PROTECTION_SETTINGS_SLOT);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
export function applyInitialSettings(): void {
  const settings = readInitialSettings();
  if (Object.keys(settings).length) window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: settings }));
}

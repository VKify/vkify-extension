/**
 * Публичный API канонического store настроек. Импортировать отсюда:
 *   import { useSettingsStore, settingsStore } from '@/shared/store';
 */
export { settingsStore, useSettingsStore, SYNC_MIRROR_KEYS } from './settings.js';
export { sanitizeForBoundary, coerceStoredSettings } from './validation.js';
export type { Settings, PartialSettings, SettingsState, SettingsStoreApi } from './types.js';

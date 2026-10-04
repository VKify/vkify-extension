import { sanitizeSettings } from '../constants/settings-schema.js';
import { serializeSettings } from '../settings-export.js';

/** Allow only portable schema settings, then remove export-only secrets. */
export function telegramSettingsBackup(raw: Record<string, unknown>): string {
  return serializeSettings(sanitizeSettings(raw, 'import'));
}

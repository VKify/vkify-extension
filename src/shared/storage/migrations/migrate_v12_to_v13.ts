import type { Migration } from './types.js';
import { parseClockSettings } from '../../clock/settings.js';

export const migrateV12ToV13: Migration = {
  to: 13,
  description: 'Add the optional page clock without changing existing preferences',
  migrate: old => ({ ...old, clock_enabled: old.clock_enabled === true,
    clock_settings: JSON.stringify(parseClockSettings(old.clock_settings)) }),
};

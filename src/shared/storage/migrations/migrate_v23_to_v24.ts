import type { Migration } from './types.js';
import { parseClockSettings } from '../../clock/settings.js';

export const migrateV23ToV24: Migration = {
  to: 24,
  description: 'Initialize extended clock appearance settings while preserving existing preferences',
  migrate: old => ({
    ...old,
    clock_settings: JSON.stringify(parseClockSettings(old.clock_settings)),
  }),
};

import type { Migration } from './types.js';
import { isSafeLogoResource } from '../../custom-logo.js';

export const migrateV26ToV27: Migration = {
  to: 27,
  description: 'Initialize optional custom header logo settings',
  migrate: old => ({
    ...old,
    custom_logo_enabled: typeof old.custom_logo_enabled === 'boolean' ? old.custom_logo_enabled : false,
    custom_logo: isSafeLogoResource(old.custom_logo) ? old.custom_logo : '',
  }),
};

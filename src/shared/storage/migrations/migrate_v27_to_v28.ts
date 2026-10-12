import type { Migration } from './types.js';
import { parseLogoColorMode, isLogoColor, DEFAULT_LOGO_COLOR } from '../../custom-logo.js';

export const migrateV27ToV28: Migration = {
  to: 28,
  description: 'Initialize custom header logo color preferences',
  migrate: old => ({
    ...old,
    custom_logo_color_mode: parseLogoColorMode(old.custom_logo_color_mode),
    custom_logo_color: isLogoColor(old.custom_logo_color) ? old.custom_logo_color : DEFAULT_LOGO_COLOR,
  }),
};

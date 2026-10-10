import type { Migration } from './types.js';

export const migrateV24ToV25: Migration = {
  to: 25,
  description: 'Initialize optional discussion reading settings',
  migrate: old => ({
    ...old,
    messages_global_scroll: typeof old.messages_global_scroll === 'boolean' ? old.messages_global_scroll : false,
    messages_disable_hover: typeof old.messages_disable_hover === 'boolean' ? old.messages_disable_hover : false,
  }),
};

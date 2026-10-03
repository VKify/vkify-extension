import type { Migration } from './types.js';

export const migrateV16ToV17: Migration = {
  to: 17,
  description: 'Add the open-profile block hiding preference without resetting user settings',
  migrate(old) {
    const next = { ...old };
    if (next.hide_open_profile_block === undefined) next.hide_open_profile_block = false;
    return next;
  },
};

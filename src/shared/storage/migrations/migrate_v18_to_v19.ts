import type { Migration } from './types.js';

export const migrateV18ToV19: Migration = {
  to: 19,
  description: 'Add the ad blocking statistics widget without resetting existing preferences or counters',
  migrate(old) {
    const next = { ...old };
    if (next.ad_stats_widget === undefined) next.ad_stats_widget = false;
    // Freeze the initial runtime defaults rather than importing a changing catalog.
    if (next['widget:ad-stats'] === undefined) {
      next['widget:ad-stats'] = { mode: 'free', visible: true, order: 0, position: null };
    }
    return next;
  },
};

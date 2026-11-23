import type { Migration } from './types.js';

export const migrateV40ToV41: Migration = {
  to: 41,
  description: 'Remove retired profile recommendation and promo settings',
  migrate: old => {
    const next = { ...old };
    delete next.hide_stories_discover;
    delete next.hide_profile_friends_recommendations;
    delete next.hide_promo_link;
    return next;
  },
};

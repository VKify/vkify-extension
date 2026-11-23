import { expect, it } from 'vitest';
import { migrateV40ToV41 } from './migrate_v40_to_v41.js';

it('removes retired options without changing remaining profile settings or the source', () => {
  const old = Object.freeze({ hide_stories_discover:true, hide_profile_friends_recommendations:true,
    hide_promo_link:true, hide_emoji_status:true, hide_open_profile_block:true, hide_profile_right_column:true });
  expect(migrateV40ToV41.migrate(old)).toEqual({ hide_emoji_status:true, hide_open_profile_block:true, hide_profile_right_column:true });
  expect(old.hide_promo_link).toBe(true);
});

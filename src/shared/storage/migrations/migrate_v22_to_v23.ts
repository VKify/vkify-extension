import type { Migration } from './types.js';
import { isVideoMenuSelection } from '../../constants/video-menu-items.js';

export const migrateV22ToV23: Migration = {
  to: 23,
  description: 'Initialize opt-in VK Video hiding preferences',
  migrate(old) {
    const next = { ...old };
    for (const key of ['hide_video_comments', 'hide_video_recommendations', 'collapse_video_playlist', 'hide_video_playlist',
      'hide_video_categories', 'hide_video_login_prompt']) {
      if (typeof next[key] !== 'boolean') next[key] = false;
    }
    if (!isVideoMenuSelection(next.hidden_video_menu_items)) next.hidden_video_menu_items = [];
    if (!isVideoMenuSelection(next.video_menu_items_order)) next.video_menu_items_order = [];
    return next;
  },
};


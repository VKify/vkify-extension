import type { Migration, RawSettings } from './types.js';

/**
 * Remaining preferences introduced since 9728d595 (inclusive).
 * Lyrics, clock and widget records already belong to v12–v14. Manual API
 * tools need no enable flags or seeded caches. Keep these defaults frozen:
 * future defaults must not change the meaning of this historical migration.
 */
export const V15_FEATURE_DEFAULTS: Readonly<RawSettings> = Object.freeze({
  voice_download: false,
  video_wallpaper: true,
  music_mini_player: false,
  mini_player_open: true,
  mini_player_collapsed: false,
  mini_player_download: true,
  mini_player_visualizer: true,
  mini_player_auto_show: true,
  mini_player_hotkey: 'Alt+M',
  mini_player_mode: 'compact',
  mini_player_pinned: false,
  mini_player_width: 340,
  mini_player_height: 580,
  prevent_story_views: false,
  prevent_notification_read: false,
  hide_channels_tab: false,
  hide_business_notifications: false,
  hide_profile_friends_recommendations: false,
  block_recommendations_video: true,
  dashboard_hero_enabled: true,
  telegram_notifications_enabled: false,
  telegram_bot_token: '',
  telegram_chat_id: '',
  telegram_dedupe_ttl_seconds: 60,
  telegram_messages_enabled: false,
  telegram_messages_preview: true,
  telegram_messages_chats: true,
  telegram_messages_respect_muted: true,
  // Preserve universal Telegram delivery for users who enabled it earlier.
  telegram_spy_activity_enabled: true,
  telegram_spy_online_enabled: true,
  telegram_spy_profile_enabled: true,
});

export const migrateV14ToV15: Migration = {
  to: 15,
  description: 'Backfill new music, privacy, hiding and Telegram preferences without resetting user data',
  migrate(old) {
    const next = { ...old };
    for (const [key, value] of Object.entries(V15_FEATURE_DEFAULTS)) {
      if (next[key] === undefined) next[key] = value;
    }
    return next;
  },
};

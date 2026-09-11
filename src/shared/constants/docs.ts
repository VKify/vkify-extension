import { siteUrl } from './site.js';

/**
 * Stable documentation targets for every user-facing feature in the popup.
 *
 * Keep the values in sync with `frontend/src/data/docs.js`. Several controls
 * intentionally share one article: nested options (notifications, intervals,
 * file naming, etc.) are explained together with their parent feature.
 */
const DOC_TARGETS: Record<string, readonly [slug: string, anchor: string]> = {
  // Appearance
  display_mode: ['view', 'display_mode'],
  minimalistic_sidebar: ['view', 'display_mode'],
  fixed_sidebar: ['view', 'display_mode'],
  sidebar_with_background: ['view', 'display_mode'],
  collapse_search: ['view', 'display_mode'],
  compact_spacing: ['view', 'display_mode'],
  content_width_enabled: ['view', 'display_mode'],
  page_offset_enabled: ['view', 'display_mode'],
  custom_theme: ['view', 'custom_theme'],
  custom_accent: ['view', 'custom_accent'],
  custom_font: ['view', 'custom_font'],
  visual_filters: ['view', 'visual_filters'],
  custom_background: ['view', 'custom_background'],
  appearance_profiles: ['view', 'appearance_profiles'],
  builtin_presets: ['view', 'builtin_presets'],
  share_theme: ['view', 'share_theme'],

  // Hiding
  hide_emoji_status: ['hiding', 'profile'],
  hide_stories_discover: ['hiding', 'profile'],
  hide_promo_link: ['hiding', 'profile'],
  hide_profile_right_column: ['hiding', 'profile'],
  hide_stories: ['hiding', 'feed'],
  hide_post_box: ['hiding', 'feed'],
  hide_post_comments: ['hiding', 'feed'],
  hide_feed_right_column: ['hiding', 'feed'],
  hide_recommended_channels: ['hiding', 'messenger'],
  hide_friends_suggestions: ['hiding', 'friends'],
  hide_recent_groups: ['hiding', 'communities'],
  hide_audio_ads: ['hiding', 'music'],
  hidden_menu_items: ['hiding', 'menu'],
  hide_menu_settings: ['hiding', 'menu'],
  hide_menu_counters: ['hiding', 'menu'],
  hide_recommendations: ['hiding', 'global'],
  hide_mini_chat: ['hiding', 'global'],
  hide_scroll_top: ['hiding', 'global'],

  // Center
  profile_swap_columns: ['center', 'profile_swap_columns'],
  expand_post_text: ['center', 'expand_post_text'],
  story_download: ['center', 'expand_post_text'],
  message_quick_copy: ['center', 'message_quick_copy'],
  dialog_export_enabled: ['center', 'message_quick_copy'],
  message_pin_notes: ['center', 'message_quick_copy'],
  messenger_swap_panels: ['center', 'message_quick_copy'],
  message_templates_enabled: ['center', 'message_quick_copy'],
  communities_swap_columns: ['center', 'communities_swap_columns'],
  communities_my_groups_redirect: ['center', 'communities_swap_columns'],
  photo_download: ['center', 'photo_download'],
  audio_download: ['center', 'audio_download'],
  audio_multi_upload: ['center', 'audio_download'],
  media_player_hotkeys: ['center', 'media_player_hotkeys'],
  audio_autoplay: ['center', 'media_player_hotkeys'],
  audio_equalizer: ['center', 'media_player_hotkeys'],
  video_download: ['center', 'video_download'],
  clip_download: ['center', 'clip_download'],

  // Notes, privacy, tracking and automation
  notes_view: ['notes', 'notes_view'],
  message_crypto: ['privacy', 'message_crypto'],
  hide_online: ['privacy', 'hide_online'],
  prevent_typing: ['privacy', 'anti_tracking'],
  prevent_read: ['privacy', 'anti_tracking'],
  blur_on_unfocus: ['privacy', 'anti_tracking'],
  hidden_dialogs: ['privacy', 'hidden_dialogs'],
  hide_dialogs_hotkey: ['privacy', 'hidden_dialogs'],
  spy_activity: ['onlinespy', 'spy_activity'],
  spy_online: ['onlinespy', 'spy_online'],
  profile_spy: ['onlinespy', 'profile_spy'],
  auto_add_friends: ['scripts', 'auto_add_friends'],
  keyboard_layout_switch: ['scripts', 'keyboard_layout_switch'],
  bypass_away_links: ['scripts', 'bypass_away_links'],

  // Ads and tools
  ads_content: ['ads', 'recommendations'],
  block_feed_ads_api: ['ads', 'ad_blocking'],
  block_left_ads: ['ads', 'ad_blocking'],
  block_trackers: ['ads', 'ad_blocking'],
  block_feed_ads_dom: ['ads', 'custom_block_words'],
  ads_keywords: ['ads', 'custom_block_words'],
  ads_stats: ['ads', 'ads_stats'],
  custom_css_enabled: ['css', 'custom_css_enabled'],
  performance_dashboard: ['more', 'performance_dashboard'],
  language: ['more', 'language'],
  api_method: ['more', 'api_method'],
  export_settings: ['more', 'export_settings'],
  import_settings: ['more', 'export_settings'],
  reset_settings: ['more', 'export_settings'],
  project_links: ['more', 'project_links'],
};

const PREFIX_TARGETS: ReadonlyArray<readonly [prefix: string, target: readonly [string, string]]> = [
  ['filter_', ['view', 'visual_filters']],
  ['menu_item_', ['hiding', 'menu']],
  ['block_recommendations_', ['ads', 'recommendations']],
  ['block_music_ads', ['ads', 'recommendations']],
  ['block_yandex_browser_promo', ['ads', 'recommendations']],
  ['message_templates_', ['center', 'message_quick_copy']],
  ['audio_download_', ['center', 'audio_download']],
  ['spy_online_', ['onlinespy', 'spy_online']],
  ['spy_browser_', ['onlinespy', 'spy_activity']],
  ['spy_save_', ['onlinespy', 'spy_activity']],
  ['profile_spy_', ['onlinespy', 'profile_spy']],
  ['spy_', ['onlinespy', 'spy_activity']],
];

export function getDocsPath(featureId: string): string | null {
  const direct = DOC_TARGETS[featureId];
  const target = direct ?? PREFIX_TARGETS.find(([prefix]) => featureId.startsWith(prefix))?.[1];
  return target ? `/docs/${target[0]}#${target[1]}` : null;
}

export function getDocsUrl(featureId: string): string | null {
  const path = getDocsPath(featureId);
  return path ? siteUrl(path) : null;
}

export const DOCUMENTED_FEATURE_IDS = Object.freeze(Object.keys(DOC_TARGETS));

/** Only booleans are baked into registered scripts; authoritative values stay in extension storage. */
export const PROTECTION_SETTING_KEYS = [
  'block_feed_ads_api', 'block_yandex_browser_promo', 'block_recommendations_feed',
  'block_recommendations_profile', 'block_trackers', 'block_music_ads',
  'block_recommendations_video', 'block_left_ads', 'block_recommendations_games',
  'block_recommendations_market', 'block_recommendations_communities', 'hide_recent_groups',
] as const;

export const PROTECTION_SETTINGS_SLOT = '__vkifyStartupProtectionSettings';
export const NATIVE_PROTECTION_MARKER = 'data-vkify-native-protection';
export const PROTECTION_MAIN_ID = 'vkify-protection-main';
export const PROTECTION_RELAY_ID = 'vkify-protection-relay';
export const PROTECTION_MATCHES = ['https://*.vk.ru/*', 'https://vkvideo.ru/*', 'https://*.vkvideo.ru/*'];

export function protectionSettings(data: Record<string, unknown>): Record<string, boolean> {
  return Object.fromEntries(PROTECTION_SETTING_KEYS.map(key => [key,
    key === 'hide_recent_groups' ? data[key] === true : data[key] !== false,
  ]));
}

export function protectionSettingFile(key: typeof PROTECTION_SETTING_KEYS[number]): string {
  return `injected/protection-setting-${key}.js`;
}

export const InjectedScript = {
  VK_API_BRIDGE:   'vk-api-bridge',
  VK_TOKEN:        'vk-token-extractor',
  ANTI_TRACKING:   'anti-tracking',
  SPY:             'spy-agent',
  FEED_AD_BLOCKER: 'feed-ad-blocker',
  COMMUNITY_CATALOG_BLOCKER: 'community-catalog-blocker',
  MY_GROUPS_NAVIGATION: 'my-groups-navigation',
  FRIENDS_SUGGESTIONS_FILTER: 'friends-suggestions-filter',
  TRACKER_BLOCKER: 'tracker-blocker',
  CATALOG_VISIBILITY_FILTER: 'catalog-visibility-filter',
  MUSIC_CATALOG_BLOCKER: 'music-catalog-blocker',
  PLAYER_CONTROL:  'player-control',
  AUDIO_DOWNLOAD:  'audio-downloader',
  EQUALIZER:       'equalizer',
} as const;

export type InjectedScriptName = typeof InjectedScript[keyof typeof InjectedScript];

export const PROTECTION_SCRIPTS: readonly InjectedScriptName[] = [
  InjectedScript.FEED_AD_BLOCKER, InjectedScript.TRACKER_BLOCKER,
  InjectedScript.CATALOG_VISIBILITY_FILTER, InjectedScript.COMMUNITY_CATALOG_BLOCKER,
  InjectedScript.MUSIC_CATALOG_BLOCKER,
];

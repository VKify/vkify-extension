export const InjectedScript = {
  VK_API_BRIDGE:   'vk-api-bridge',
  VK_API:          'vk-api',
  ANTI_TRACKING:   'anti-tracking',
  SPY:             'spy',
  AD_FEED_BLOCKER: 'ad-feed-blocker',
  TRACKER_BLOCKER: 'tracker-blocker',
  PLAYER_CONTROL:  'player-control',
  AUDIO_DOWNLOAD:  'audio-download',
} as const;

export type InjectedScriptName = typeof InjectedScript[keyof typeof InjectedScript];
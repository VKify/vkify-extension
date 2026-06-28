export const InjectedScript = {
  VK_API_BRIDGE:   'vk-api-bridge',
  VK_TOKEN:        'vk-token-extractor',
  ANTI_TRACKING:   'anti-tracking',
  SPY:             'spy-agent',
  FEED_AD_BLOCKER: 'feed-ad-blocker',
  TRACKER_BLOCKER: 'tracker-blocker',
  PLAYER_CONTROL:  'player-control',
  AUDIO_DOWNLOAD:  'audio-downloader',
  EQUALIZER:       'equalizer',
} as const;

export type InjectedScriptName = typeof InjectedScript[keyof typeof InjectedScript];
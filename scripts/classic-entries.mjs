// Single source of truth for the classic (IIFE) build entries.
// Imported by vite.config.ts and scripts/build.mjs.
// Paths are relative to the project root.

export const CLASSIC_ENTRIES = {
  content:                    'src/content/index.ts',
  'site-bridge':              'src/content/site-bridge.ts',
  embed:                      'src/content/embed.ts',
  'vk-wallpaper-frame':        'src/content/vk-wallpaper-frame.ts',
  // On-demand аудио-энкодер (hls.js + lamejs). НЕ content-script манифеста и НЕ
  // web_accessible — background инжектит его через chrome.scripting в ISOLATED-мир
  // только при первом скачивании, чтобы тяжёлые библиотеки не грузились на
  // document_start вместе с content.js. См. music/encoder.ts (прокси).
  'welcome-modal': 'src/content/ui/welcome-modal-entry.ts',
  'audio-encoder':            'src/content/features/center/music/download/encoder-entry.ts',
  'video-card-frames':        'src/content/features/center/video/card-frames-entry.ts',
  'injected-anti-tracking':     'src/content/injected/anti-tracking.ts',
  'injected-vk-token-extractor':'src/content/injected/vk-token-extractor.ts',
  'injected-vk-api-bridge':     'src/content/injected/vk-api-bridge.ts',
  'injected-spy-agent':         'src/content/injected/spy-agent.ts',
  'injected-feed-ad-blocker':   'src/content/injected/feed-ad-blocker.ts',
  'injected-community-catalog-blocker': 'src/content/injected/community-catalog-blocker.ts',
  'injected-my-groups-navigation': 'src/content/injected/my-groups-navigation.ts',
  'injected-friends-suggestions-filter': 'src/content/injected/friends-suggestions-filter.ts',
  'injected-tracker-blocker':   'src/content/injected/tracker-blocker.ts',
  'injected-catalog-visibility-filter': 'src/content/injected/catalog-visibility-filter.ts',
  'injected-music-catalog-blocker': 'src/content/injected/music-catalog-blocker.ts',
  'injected-player-control':    'src/content/injected/player-control.ts',
  'injected-audio-downloader':  'src/content/injected/audio-downloader.ts',
  'injected-equalizer':         'src/content/injected/equalizer.ts',
};

export const CLASSIC_ENTRY_NAMES = Object.keys(CLASSIC_ENTRIES);

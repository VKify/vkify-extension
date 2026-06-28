// Single source of truth for the classic (IIFE) build entries.
// Imported by vite.config.ts and scripts/build.mjs.
// Paths are relative to the project root.

export const CLASSIC_ENTRIES = {
  content:                    'src/content/index.ts',
  'site-bridge':              'src/content/site-bridge.ts',
  embed:                      'src/content/embed.ts',
  'injected-anti-tracking':     'src/content/injected/anti-tracking.ts',
  'injected-vk-token-extractor':'src/content/injected/vk-token-extractor.ts',
  'injected-vk-api-bridge':     'src/content/injected/vk-api-bridge.ts',
  'injected-spy-agent':         'src/content/injected/spy-agent.ts',
  'injected-feed-ad-blocker':   'src/content/injected/feed-ad-blocker.ts',
  'injected-tracker-blocker':   'src/content/injected/tracker-blocker.ts',
  'injected-player-control':    'src/content/injected/player-control.ts',
  'injected-audio-downloader':  'src/content/injected/audio-downloader.ts',
  'injected-equalizer':         'src/content/injected/equalizer.ts',
};

export const CLASSIC_ENTRY_NAMES = Object.keys(CLASSIC_ENTRIES);

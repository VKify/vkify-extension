// Single source of truth for the classic (IIFE) build entries.
// Imported by vite.config.ts and scripts/build.mjs.
// Paths are relative to the project root.

export const CLASSIC_ENTRIES = {
  content:                    'src/content/index.ts',
  'site-bridge':              'src/content/site-bridge.ts',
  'injected-anti-tracking':   'src/content/injected/anti-tracking.ts',
  'injected-vk-api':          'src/content/injected/injected-vk-api.ts',
  'injected-vk-api-bridge':   'src/content/injected/vk-api-bridge.ts',
  'injected-spy':             'src/content/injected/spy.ts',
  'injected-ad-feed-blocker': 'src/content/injected/ad-feed-blocker.ts',
  'injected-tracker-blocker': 'src/content/injected/tracker-blocker.ts',
  'injected-player-control':  'src/content/injected/player-control.ts',
};

export const CLASSIC_ENTRY_NAMES = Object.keys(CLASSIC_ENTRIES);

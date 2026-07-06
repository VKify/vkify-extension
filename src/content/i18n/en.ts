/**
 * English content-script dictionary. Same key tree as `ru.ts` (the fallback
 * language) — keep them in sync when migrating features.
 */
import type { Dict } from './index.js';

export const EN: Dict = {
  download: {
    common: {
      error: 'Error',
    },
    photo: {
      aria: 'Download photo in maximum quality',
      btn: 'Download',
      loading: 'Loading…',
      no_id: 'No ID',
      api_error: 'API error',
      no_sizes: 'No sizes',
      no_url: 'No link',
      done: 'Done ✓',
    },
    album: {
      btn: 'Download album',
      tooltip: 'Download album (ZIP)',
      confirm:
        'Download ALL photos from this album?\n\n' +
        'A ZIP archive will be created (or several, 500 photos each, for large albums).',
      job_title: 'Photo album',
      preparing: 'Preparing…',
      stopping: 'Stopping, saving what’s ready…',
      downloaded: 'Downloaded {{done}}/{{total}}',
      done: 'Done: {{ok}}/{{total}}',
      cancelled: 'Stopped: {{ok}}/{{total}}',
      failed_suffix: ' (errors: {{count}})',
    },
    music: {
      aria: 'Download track',
      track: 'Track',
      no_track: 'No track',
      queued: 'Queued',
      fetching: 'Fetching link',
      saving: 'Saving',
      done: 'Done',
    },
    clip: {
      btn: 'Download clip',
    },
    center: {
      title: 'Downloads',
      close: 'Close panel (downloads continue)',
      job_default: 'Download',
      cancel: 'Cancel',
      queued: 'Queued…',
      done: 'Done',
      error: 'Error',
      in_progress: '{{count}} in progress',
      all_done: 'done',
    },
  },
  embed: {
    iframe_title: 'VKify · Settings',
    menu_item: 'VKify Settings',
  },
  widget: {
    collapse: 'Collapse',
    collapse_toggle: 'Collapse/expand',
    close: 'Close',
  },
  perf: {
    na: 'n/a',
    mb: '{{value}} MB',
    ms: '{{value}} ms',
    load: 'Load',
    features: 'Active features',
    heavy: 'Heavy',
    api: 'API/min',
    mutations: 'Mutations',
    hint: 'API calls over 60 s · click for dashboard',
    close_title: 'Close (disable mini-widget)',
    body_title: 'Open full dashboard',
  },
  welcome: {
    title: 'Welcome!',
    subtitle: 'VKify installed successfully',
    features: {
      appearance_title: 'Appearance',
      appearance_desc: 'Themes, fonts, wallpapers, filters — VK the way you like it',
      ads_title: 'Ad blocking',
      ads_desc: 'Feed ads, banners and trackers — disabled',
      privacy_title: 'Privacy',
      privacy_desc: 'Hide conversations, encrypt messages',
      chats_title: 'Chat convenience',
      chats_desc: 'One-click copy, notes, conversation export',
      spy_title: 'Online tracking',
      spy_desc: 'Notifications about logins and activity',
    },
    hint:
      'Open settings via the extension icon in your browser, ' +
      'press <strong>Ctrl + K</strong> in the popup to search any feature, ' +
      'or right on the page at <strong>vk.com/vkify_settings</strong>',
    cta: 'Get started',
  },
};

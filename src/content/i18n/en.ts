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
  },
};

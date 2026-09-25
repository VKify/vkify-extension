// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { availablePlaylistQualities, selectPlaylistFile } from './playlist.js';
import { parsePlaylistIds } from './api.js';

describe('parsePlaylistIds', () => {
  it('parses a dedicated playlist URL', () => {
    expect(parsePlaylistIds({ pathname: '/playlist/-56169357_1048', search: '' }))
      .toEqual({ ownerId: -56169357, albumId: 1048 });
  });

  it('parses the playlist query on a video URL', () => {
    expect(parsePlaylistIds({ pathname: '/video-1_2', search: '?pl=-3_4' }))
      .toEqual({ ownerId: -3, albumId: 4 });
  });
});

describe('playlist video quality', () => {
  it('uses the requested quality when present', () => {
    expect(selectPlaylistFile({ mp4_720: '720', mp4_360: '360' }, 'mp4_720'))
      .toEqual({ url: '720', label: '720p' });
  });

  it('falls back to the closest lower quality', () => {
    expect(selectPlaylistFile({ mp4_480: '480', mp4_240: '240' }, 'mp4_720'))
      .toEqual({ url: '480', label: '480p' });
  });

  it('lists only qualities present in at least one video', () => {
    expect(availablePlaylistQualities([
      { files: { mp4_1080: 'a' } },
      { files: { mp4_360: 'b' } },
    ]).map(q => q.label)).toEqual(['1080p', '360p']);
  });
});

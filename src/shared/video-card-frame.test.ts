import { expect, it } from 'vitest';
import { collectVideoCards, firstVideoFrames, videoFrameApiMethod, videoFramePosition, videoSpriteFrame } from './video-card-frame.js';

export const video = () => ({ id: 2, owner_id: -1, title: 'UNCHANGED TITLE', duration: 100,
  image: [{ url: 'https://sun9.userapi.com/cover.jpg', width: 320, height: 180 }],
  first_frame: [{ url: 'https://sun9.userapi.com/first.jpg', width: 320, height: 180 }],
  timeline_thumbs: { count_total: 10, count_per_image: 6, count_per_row: 3, frame_width: 160, frame_height: 90,
    links: ['https://sun9.userapi.com/sheet0.jpg', 'https://sun9.userapi.com/sheet1.jpg'] } });

it.each(['start', 'middle', 'end'] as const)('locates the %s frame in VK compact sheets', position => {
  const frame = videoSpriteFrame(video(), position)!;
  expect(frame).toMatchObject(position === 'start' ? { x: 320, y: 0 } : position === 'middle' ? { x: 160, y: 90 } : { x: 0, y: 90 });
  expect(frame.url).toContain(position === 'end' ? 'sheet1' : 'sheet0');
});
it('uses UV frequency and clamps the last index', () => {
  const v = video(); Object.assign(v.timeline_thumbs, { is_uv: true, frequency: 10 });
  expect(videoSpriteFrame(v, 'middle')).toMatchObject({ x: 320, y: 90 });
  expect(videoSpriteFrame(v, 'end')).toMatchObject({ url: v.timeline_thumbs.links[1], x: 0, y: 90 });
});
it('selects middle and final sheets from the observed video.getByIds UV response', () => {
  const v = { ...video(), duration: 4796, timeline_thumbs: {
    count_per_image: 9, count_per_row: 3, count_total: 160, frame_width: 320, frame_height: 180,
    frequency: 30, is_uv: true, links: Array.from({ length: 18 }, (_, i) => `https://iv.okcdn.ru/videoPreview?uidx=${i}`),
  } };
  expect(videoSpriteFrame(v, 'middle')).toEqual({ url: v.timeline_thumbs.links[8], x: 320, y: 360, width: 320, height: 180 });
  expect(videoSpriteFrame(v, 'end')).toEqual({ url: v.timeline_thumbs.links[17], x: 0, y: 360, width: 320, height: 180 });
  expect(videoSpriteFrame(v, 'start')).toEqual({ url: v.timeline_thumbs.links[0], x: 320, y: 360, width: 320, height: 180 });
});
it('uses 3:30 for long videos, a duration-aware point for short videos, and never the opening sample', () => {
  const v = video(); Object.assign(v.timeline_thumbs, { is_uv: true, frequency: 10 });
  v.duration = 120;
  expect(videoSpriteFrame(v, 'start')).toMatchObject({ x: 0, y: 90 });
  v.duration = 8;
  expect(videoSpriteFrame(v, 'start')).toMatchObject({ x: 160, y: 0 });
  v.timeline_thumbs.count_total = 1;
  expect(videoSpriteFrame(v, 'start')).toBeNull();
});
it('also selects 3:30 in a five-minute video rather than a percentage of its duration', () => {
  const v = video(); v.duration = 300;
  Object.assign(v.timeline_thumbs, { is_uv: true, frequency: 10, count_total: 30,
    links: Array.from({ length: 5 }, (_, i) => `https://sun9.userapi.com/sheet${i}.jpg`) });
  expect(videoSpriteFrame(v, 'start')).toMatchObject({ url: v.timeline_thumbs.links[3], x: 0, y: 90 });
});
it.each([{ count_per_row: 0 }, { count_total: Infinity }, { frame_width: 100000 }, { links: ['https://evil.test/sheet.jpg'] }, { links: [] }])('rejects invalid sheets: %j', patch => {
  const v = video(); Object.assign(v.timeline_thumbs, patch); expect(videoSpriteFrame(v, 'middle')).toBeNull();
});
it.each([{ live: 1 }, { live_status: 'started' }, { upcoming: 1 }, { processing: 1 }, { restriction: {} }, { can_view: 0 }, { type: 'short_video' }])('preserves live, restricted and clip covers: %j', patch => {
  const v = { ...video(), ...patch }; expect(firstVideoFrames(v)).toEqual([]); expect(videoSpriteFrame(v, 'start')).toBeNull();
});
it('accepts only actual, trusted first frames and normalizes the setting', () => {
  const v = video(); expect(firstVideoFrames(v)).toEqual(v.first_frame);
  v.first_frame[0].url = 'https://userapi.com.evil.test/p.jpg'; expect(firstVideoFrames(v)).toEqual([]);
  for (const value of [null, 3, 'invalid', {}]) expect(videoFramePosition(value)).toBe('start');
});
it('preserves native base-frame resizing and decodes HTML-prefetched URL separators', () => {
  const v = { ...video(), first_frame: [{ url: 'https://sun9.userapi.com/first.jpg?x=1&amp;y=2', width: 0, height: 0, is_base: true }] };
  expect(firstVideoFrames(v)).toEqual([{ url: 'https://sun9.userapi.com/first.jpg?x=1&y=2', width: 320, height: 180, is_base: true }]);
});
it('discovers cards inside native batch, feed, search and catalog containers only', () => {
  const v = video();
  expect(collectVideoCards({ response: { responses: [{ body: { response: { videos: [v] } } }] } })).toEqual([v]);
  expect(collectVideoCards({ response: { items: [{ attachments: [{ type: 'video', video: v }] }] } })).toEqual([v]);
  expect(collectVideoCards({ response: { newsfeed_items: [{ item: { attachments: [{ video: v }] } }] } })).toEqual([v]);
  expect(collectVideoCards({ response: { catalog_videos: [{ snippet_marks: [], video: v }], videos: [{ ...video(), id: 99 }], albums: [{ ...video(), type: 'album' }] } }).map(item => item.id)).toEqual([2]);
  expect(collectVideoCards({ response: { catalog_videos: [], videos: [v] } })).toEqual([v]);
  expect(collectVideoCards({ unrelated: v, profiles: [v], image: [v] })).toEqual([]);
  const cycle: Record<string, unknown> = {}; cycle.response = cycle; expect(collectVideoCards(cycle)).toEqual([]);
});
it('bounds huge collections and never mistakes a photo or playlist for a card', () => {
  expect(collectVideoCards({ videos: Array.from({ length: 10000 }, video) })).toHaveLength(200);
  expect(collectVideoCards({ items: [{ ...video(), type: 'album' }, { ...video(), type: 'playlist' }, { ...video(), first_video_id: 5 }, { id: 1, owner_id: 2, image: [], name: 'playlist' }, { id: 0, owner_id: 1, image: [], title: 'invalid' }] })).toEqual([]);
});
it('gates inspection by VK route, including api.vkvideo.ru and batch.call', () => {
  for (const url of ['https://api.vkvideo.ru/method/batch.call?v=5', 'https://web.api.vk.ru/method/newsfeed.getFeed', '/method/catalog.getVideoShowcase', '/method/catalog.getVideoSearchWeb2', '/method/catalog.getSearchAll', '/method/catalog.replaceBlocks', '/method/video.getFromAlbum', '/method/video.getCatalogBlockItems', '/method/video.getComments', '/method/fave.get', '/method/video.feedVideosForYouBlockItems'])
    expect(videoFrameApiMethod(url, 'https://vk.ru')).not.toBeNull();
  for (const url of ['https://vk.ru.evil.test/method/video.get', 'https://evil.test/method/video.get', '/method/messages.get', '/method/video.trackAdEvent', '/method/video.getStatsToken', '/method/video.getAds', '/method/video.getGroupSettings', 'http://vk.ru/method/video.get'])
    expect(videoFrameApiMethod(url, 'https://vk.ru')).toBeNull();
});

// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { interceptLegacyVideoCatalogue, transformLegacyVideoPayload } from './card-frames-legacy.js';

const cover = 'https://sun9.userapi.com/cover.jpg?a=1&amp;b=2';
const frame = 'data:image/jpeg;base64,FRAME';
const html = `<aside><img src="https://sun9.userapi.com/avatar.jpg"></aside><div class="_video_item VideoCard" id="video_item_-1_2" data-thumb="${cover}"><a href="/video-1_2" onclick="Video.show(event)"><img class="VideoCard__thumbImg" src="${cover}" data-thumb="${cover}" alt="Русское название"></a></div>`;
const change = vi.fn(async (data: any) => { for (const video of data.videos) video.image = [{ url: frame }]; return true; });
afterEach(() => { vi.clearAllMocks(); Reflect.deleteProperty(window, 'ajax'); });

it('prepares only HTML card covers before delivery, preserving scripts, titles, links and avatars', async () => {
  const script = 'window.cur = {template: "' + cover + '"};', args = [false, html, script, { cache: true }];
  const result = await transformLegacyVideoPayload(args, change, () => true);
  expect(args[1]).toBe(html); expect(result[2]).toBe(script); expect(result[3]).toBe(args[3]);
  expect(result[1]).toBe(html.split(cover).join(frame));
  expect(change.mock.calls[0][0].videos).toHaveLength(1);
});
it('handles positional pagination videos while retaining all non-cover fields and other entities', async () => {
  const row: unknown[] = Array(20).fill('');
  row.splice(0, 9, -1, 2, cover, 'Исходное название', 0, '4:00', '<html>', null, { extra: true });
  row[19] = 240;
  const data = { videos: [row], playlists: [{ image: cover }], nextFrom: 'CURSOR' };
  const [result] = await transformLegacyVideoPayload([JSON.stringify(data)], change, () => true);
  const prepared = JSON.parse(result as string); expect(prepared.videos[0][2]).toBe(frame);
  prepared.videos[0][2] = cover; expect(prepared).toEqual(data);
});
it('leaves errors, malformed values, disabled work and oversized payloads untouched', async () => {
  for (const args of [['invalid'], ['{"videos":[[0,2,"https://sun9.userapi.com/a.jpg"]]}'], [' '.repeat(4 * 1024 * 1024) + html]])
    expect(await transformLegacyVideoPayload(args, change, () => true)).toBe(args);
  const args = [false, html, 'script']; let live = true;
  const result = await transformLegacyVideoPayload(args, async data => { await change(data); live = false; return true; }, () => live);
  expect(result).toBe(args);
});
it('wraps the early and replaced native AJAX objects, preserves failures and restores its descriptors', async () => {
  window.location.href = 'https://vkvideo.ru/politics';
  const stop = interceptLegacyVideoCatalogue(change);
  const original = vi.fn(async (..._args: unknown[]) => [false, html, 'SCRIPT']);
  const ajax = { promisifiedPost: original }; Reflect.set(window, 'ajax', ajax);
  const converted = await ajax.promisifiedPost('al_video.php', { __query: 'politics' });
  expect(converted[1]).toBe(html.split(cover).join(frame));
  const second = { promisifiedPost: vi.fn(async (..._args: unknown[]) => [false, html]) };
  Reflect.set(window, 'ajax', second); expect(ajax.promisifiedPost).toBe(original);
  expect((await second.promisifiedPost('/trends', { silent_loading: 1 }))[1]).toContain(frame);
  stop(); expect(Object.getOwnPropertyDescriptor(window, 'ajax')?.get).toBeUndefined();
});
it('does not intercept sport, other origins, unrelated requests or mutations', async () => {
  window.location.href = 'https://vksport.vkvideo.ru/sport';
  const stopSport = interceptLegacyVideoCatalogue(change);
  expect(Object.getOwnPropertyDescriptor(window, 'ajax')).toBeUndefined(); stopSport();
  window.location.href = 'https://vkvideo.ru/';
  const original = vi.fn(async (..._args: unknown[]) => [false, html]);
  const ajax = { promisifiedPost: original }; Reflect.set(window, 'ajax', ajax);
  const stop = interceptLegacyVideoCatalogue(change);
  for (const [url, params] of [['al_video.php?act=log_seen', { __query: 'trends' }], ['https://evil.test/trends', { silent_loading: 1 }], ['al_video.php', { act: 'delete', __query: 'trends' }], ['al_video.php', { act: 'web_token' }]])
    expect((await ajax.promisifiedPost(url, params))[1]).toBe(html);
  expect(change).not.toHaveBeenCalled(); stop();
});

// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installVideoCardFrameInterceptor } from './card-frames-interceptor.js';
import { interceptFeedPrefetch } from '@/content/injected/feed-prefetch.js';
import { dispatchPageEvent } from '@/content/utils/page-event.js';
import { VIDEO_FRAME_FIELDS } from './card-frame-metadata.js';

const card = () => ({ id: 2, owner_id: -1, title: 'DO NOT CHANGE', duration: 90,
  image: [{ url: 'https://sun9.userapi.com/cover.jpg', width: 320, height: 180 }],
  first_frame: [{ url: 'https://sun9.userapi.com/first.jpg', width: 320, height: 180 }],
  timeline_thumbs: { count_total: 3, count_per_image: 3, count_per_row: 3, frame_width: 160, frame_height: 90, links: ['https://sun9.userapi.com/sheet.jpg'] } });
const page = window as unknown as { cur?: { apiPrefetchCache: Array<{ method: string; response: unknown }> }; apiPrefetchReadyPromise?: Promise<unknown> };
const settings = (enabled: boolean, position = 'start') => dispatchPageEvent('vkify:video-frames:settings', { enabled, position });
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'x-native-header': 'kept' } });
const preparedFrame = { url: 'data:image/jpeg;base64,prepared', width: 160, height: 90 };
const prepareFrame = async () => preparedFrame;
let stop: () => void;
beforeEach(() => { window.location.href = 'https://vkvideo.ru/'; });
afterEach(() => { stop?.(); delete page.cur; delete page.apiPrefetchReadyPromise; vi.useRealTimers(); });

it('rewrites native catalog, batch and feed image data before VK sees the response', async () => {
  for (const data of [{ response: { videos: [card()] } }, { response: { responses: [{ body: { response: { videos: [card()] } } }] } },
    { response: { items: [{ attachments: [{ type: 'video', video: card() }] }] } }]) {
    const before = structuredClone(data);
    window.fetch = vi.fn(async () => json(data)); stop = installVideoCardFrameInterceptor(prepareFrame); settings(true);
    const response = await window.fetch('https://api.vkvideo.ru/method/batch.call'), body = await response.json();
    expect(JSON.stringify(body)).toContain('first.jpg'); expect(JSON.stringify(body)).not.toContain('cover.jpg');
    expect(JSON.stringify(body)).toContain('DO NOT CHANGE'); expect(response.headers.get('x-native-header')).toBe('kept');
    expect(data).toEqual(before); stop();
  }
});
it('does not recursively process its own metadata batch even if VK returns extra card fields', async () => {
  const response = json({ response: { items: [card()] } }); window.fetch = vi.fn(async () => response);
  const crop = vi.fn(), call = vi.fn(); stop = installVideoCardFrameInterceptor(crop, call); settings(true, 'middle');
  expect(await window.fetch('https://api.vkvideo.ru/method/video.getByIds', { method: 'POST', body: new URLSearchParams({ videos: '-1_2', video_fields: VIDEO_FRAME_FIELDS }) })).toBe(response);
  expect(crop).not.toHaveBeenCalled(); expect(call).not.toHaveBeenCalled();
});
it('does no image or metadata work in hidden tabs', async () => {
  const response = json({ response: { videos: [card()] } }); window.fetch = vi.fn(async () => response);
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true), clone = vi.spyOn(response, 'clone');
  try {
    stop = installVideoCardFrameInterceptor(prepareFrame); settings(true, 'middle');
    expect(await window.fetch('https://api.vkvideo.ru/method/catalog.getVideo')).toBe(response); expect(clone).not.toHaveBeenCalled();
  } finally { hidden.mockRestore(); }
});
it('returns unrelated/disabled/failed responses by identity without cloning or metadata requests', async () => {
  const response = json({ response: { videos: [card()] } }), clone = vi.spyOn(response, 'clone');
  window.fetch = vi.fn(async () => response); const call = vi.fn(); stop = installVideoCardFrameInterceptor(undefined, call);
  expect(await window.fetch('https://api.vkvideo.ru/method/catalog.getVideo')).toBe(response);
  settings(true);
  for (const url of ['https://evil.test/method/video.get', 'https://api.vk.ru/method/messages.getHistory', 'https://sun9.userapi.com/sheet.jpg']) expect(await window.fetch(url)).toBe(response);
  expect(clone).not.toHaveBeenCalled(); expect(call).not.toHaveBeenCalled();
});
it('does not retain late crops or delay the catalog beyond its deadline', async () => {
  vi.useFakeTimers();
  const response = json({ response: { videos: [card()] } }); window.fetch = vi.fn(async () => response);
  let resolve!: (value: { url: string; width: number; height: number }) => void;
  const crop = vi.fn(() => new Promise<{ url: string; width: number; height: number }>(r => { resolve = r; }));
  stop = installVideoCardFrameInterceptor(crop); settings(true, 'middle');
  const request = window.fetch('https://api.vkvideo.ru/method/catalog.getVideo');
  await vi.advanceTimersByTimeAsync(1100); expect(await request).toBe(response);
  settings(false); resolve({ url: 'data:image/jpeg;base64,test', width: 160, height: 90 });
  await vi.advanceTimersByTimeAsync(1); expect((await response.json()).response.videos[0].image[0].url).toContain('cover.jpg');
});
it('checks enable state after an awaited metadata response', async () => {
  const data = card(); Reflect.deleteProperty(data, 'first_frame'); Reflect.deleteProperty(data, 'timeline_thumbs');
  const response = json({ response: { videos: [data] } }); window.fetch = vi.fn(async () => response);
  let resolve!: (value: unknown) => void;
  const call = vi.fn(() => new Promise(r => { resolve = r; }));
  stop = installVideoCardFrameInterceptor(undefined, call); settings(true);
  const request = window.fetch('https://api.vkvideo.ru/method/catalog.getVideo');
  await vi.waitFor(() => expect(call).toHaveBeenCalledOnce()); settings(false);
  resolve({ items: [card()] }); expect(await request).toBe(response);
});
it('uses the actual preview API method, fields and domain instead of legacy video.get', async () => {
  const v = card(); Reflect.deleteProperty(v, 'timeline_thumbs');
  window.fetch = vi.fn(async () => json({ response: { videos: [v] } }));
  const api = vi.fn(async (method: string, params: { video_fields: string }) => {
    if (method !== 'video.getByIds' || params.video_fields !== 'image,timeline_thumbs') return { items: [v] };
    return { items: [card()] };
  });
  Reflect.set(window, 'vkApi', { api });
  try {
    stop = installVideoCardFrameInterceptor(async () => ({ url: 'data:image/jpeg;base64,real-frame', width: 160, height: 90 }));
    settings(true, 'middle');
    const data = await (await window.fetch('https://api.vkvideo.ru/method/catalog.getVideo')).json();
    expect(data.response.videos[0].image[0].url).toContain('real-frame');
    expect(api).toHaveBeenCalledWith('video.getByIds', { videos: '-1_2', video_fields: 'image,timeline_thumbs' }, { grouping: false, domain: 'api.vkvideo.ru' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  } finally { Reflect.deleteProperty(window, 'vkApi'); }
});
it('keeps completed API frames when a different sheet times out, without applying late results', async () => {
  vi.useFakeTimers();
  const slow = card(); slow.id = 3; slow.timeline_thumbs.links[0] += '?slow=1';
  window.fetch = vi.fn(async () => json({ response: { videos: [card(), slow] } }));
  let resolve!: (value: { url: string; width: number; height: number }) => void;
  const image = { url: 'data:image/jpeg;base64,completed', width: 160, height: 90 };
  stop = installVideoCardFrameInterceptor(async frame => frame.url.includes('slow') ? new Promise(done => { resolve = done; }) : image);
  settings(true, 'middle'); const work = window.fetch('https://api.vkvideo.ru/method/catalog.getVideo');
  await vi.advanceTimersByTimeAsync(1100); const response = await work, data = await response.json();
  expect(data.response.videos[0].image[0].url).toContain('completed');
  expect(data.response.videos[1].image[0].url).toContain('cover.jpg');
  resolve(image); await vi.advanceTimersByTimeAsync(1);
  expect(data.response.videos[1].image[0].url).toContain('cover.jpg');
});
it('processes initial and replaced HTML caches through VK readiness and restores unconsumed covers', async () => {
  window.fetch = vi.fn(); stop = installVideoCardFrameInterceptor(prepareFrame); settings(true);
  const v = card(); page.cur = { apiPrefetchCache: [{ method: 'catalog.getVideoShowcase', response: { videos: [v] } }] };
  await page.apiPrefetchReadyPromise; expect(v.image[v.image.length - 1]).toEqual(preparedFrame);
  const next = card(); page.cur.apiPrefetchCache = [{ method: 'video.get', response: { items: [next] } }];
  await page.apiPrefetchReadyPromise; expect(next.image[next.image.length - 1]).toEqual(preparedFrame);
  settings(false); expect(next.image[0].url).toContain('cover.jpg');
});
it('leaves a VK-owned readonly prefetch barrier and its cache untouched', async () => {
  window.fetch = vi.fn(); const crop = vi.fn(); stop = installVideoCardFrameInterceptor(crop); settings(true, 'middle');
  const original = Promise.resolve();
  Object.defineProperty(window, 'apiPrefetchReadyPromise', { configurable: true, writable: false, value: original });
  const v = card(); page.cur = { apiPrefetchCache: [{ method: 'catalog.getVideo', response: { videos: [v] } }] };
  await original; expect(crop).not.toHaveBeenCalled(); expect(v.image[0].url).toContain('cover.jpg'); expect(page.apiPrefetchReadyPromise).toBe(original);
});
it('composes with ad prefetch observers in either installation order', async () => {
  for (const adsFirst of [true, false]) {
    const ads = (entry: { response?: unknown }) => { const response = entry.response as { items?: Array<{ type: string }> }; if (response?.items) response.items = response.items.filter(i => i.type !== 'ads'); };
    let offAds: (() => void) | undefined;
    if (adsFirst) offAds = interceptFeedPrefetch(window, ads);
    window.fetch = vi.fn(); stop = installVideoCardFrameInterceptor(prepareFrame); settings(true);
    if (!adsFirst) offAds = interceptFeedPrefetch(window, ads);
    const v = card(); page.cur = { apiPrefetchCache: [{ method: 'newsfeed.getFeed', response: { items: [{ type: 'ads' }, { type: 'post', attachments: [{ video: v }] }] } }] };
    await page.apiPrefetchReadyPromise;
    const response = page.cur.apiPrefetchCache[0].response as { items: unknown[] };
    expect(response.items).toHaveLength(1); expect(v.image[v.image.length - 1]).toEqual(preparedFrame);
    settings(false);
    const next = { method: 'newsfeed.getFeed', response: { items: [{ type: 'ads' }, { type: 'post' }] } };
    page.cur.apiPrefetchCache = [next]; expect(next.response.items).toHaveLength(1);
    offAds?.(); stop(); delete page.cur;
  }
});
it('preserves malformed and oversized API responses', async () => {
  for (const response of [new Response('{bad', { headers: { 'content-type': 'application/json' } }), new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '99999999' } })]) {
    window.fetch = vi.fn(async () => response); stop = installVideoCardFrameInterceptor(prepareFrame); settings(true);
    expect(await window.fetch('https://api.vkvideo.ru/method/catalog.getVideo')).toBe(response); stop();
  }
});

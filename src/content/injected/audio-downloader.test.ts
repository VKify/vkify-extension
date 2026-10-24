// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { tupleArtwork } from '@/shared/music-artwork.js';

const w = window as Window & { __vkifyAudioDl?: boolean; ajax?: unknown; vk?: { id: number } };
let listeners: ReturnType<typeof vi.spyOn> | undefined;

afterEach(() => {
  for (const [name, listener] of listeners?.mock.calls ?? []) window.removeEventListener(name, listener);
  listeners?.mockRestore();
  delete w.__vkifyAudioDl;
  delete w.ajax;
  delete w.vk;
});

const streamUrl = 'https://psv4.vkuseraudio.net/audio/very-long-signed-resource-path/index.m3u8?token=test';

async function initDownloader() {
  vi.resetModules();
  listeners = vi.spyOn(window, 'addEventListener');
  await import('./audio-downloader.js');
}

function requestUrl(audioData: unknown[]): Promise<string> {
  const response = new Promise<string>(resolve => {
    window.addEventListener('vkify:audio:url-response', event => resolve((event as CustomEvent).detail.url), { once: true });
  });
  window.dispatchEvent(new CustomEvent('vkify:audio:get-url', { detail: { requestId: 'test', audioData } }));
  return response;
}

it.each([
  [1234567890, 'AhaUDw9KAwO4DhiTB2vWl2fZBNvUzwv1Dw9ZCM5JpwXOlNrVzxm6Ag4TzgvOCNb2ys95ywvLCY12nguVm3nOp3nOAwqVDI1YAs9LDxHKlMTVBMLNz2TO#AqSZmdKWmZaZmdmW'],
  [5000000001, 'AhrZl2vYlw4UBNrOz251B3aUDgSVzgLZBM9ZAxmZyxj1zxvYDNb2DtrLzd1Hl2D4Dgf2BtPWBY9LBMuTB3mTCY50zwL5zw84CNrJp2vOlY1KDwLLzgTS#AqSXmJmOnty3odK='],
])('decodes VK BigInt shuffle for user %s without a network request', async (id, extra) => {
  w.vk = { id: Number(id) };
  await initDownloader();
  expect(await requestUrl([42, 7, `https://vk.ru/audio_api_unavailable.mp3?extra=${extra}`])).toBe(streamUrl);
});

it.each([
  (tuple: unknown[]) => [tuple],
  (tuple: unknown[]) => ({ payload: [0, [[tuple]]] }),
  (tuple: unknown[]) => ({ data: { audios: [tuple] } }),
])('resolves a URL from wrapped reload_audios responses', async wrap => {
  const tuple = [42, 7, streamUrl, 'Song', 'Artist', 200];
  w.ajax = { post: vi.fn((_url, _params, callbacks) => callbacks.onDone(wrap(tuple))) };
  await initDownloader();
  expect(await requestUrl([42, 7])).toBe(streamUrl);
});

it('loads stream URLs with actionHash and urlHash after metadata-only reload_audios', async () => {
  const tuple: unknown[] = [42, 7, '', 'Song', 'Artist', 200];
  tuple[13] = 'add/edit/action/delete/replace/url/restore';
  const post = vi.fn((_url, params, callbacks) => {
    callbacks.onDone({ payload: [0, [[params.act === 'reload_audio' ? [...tuple.slice(0, 2), streamUrl, ...tuple.slice(3)] : tuple]]] });
  });
  w.ajax = { post };
  await initDownloader();
  const response = new Promise<{ info: { url: string; title: string } }>(resolve => {
    window.addEventListener('vkify:audio:track-info-response', event => resolve((event as CustomEvent).detail), { once: true });
  });
  window.dispatchEvent(new CustomEvent('vkify:audio:get-track-info', { detail: { requestId: 'test', trackId: '7_42' } }));
  expect((await response).info).toMatchObject({ url: streamUrl, title: 'Song' });
  expect(post).toHaveBeenCalledTimes(2);
  expect(post).toHaveBeenNthCalledWith(2, 'al_audio.php', { act: 'reload_audio', ids: '7_42_action_url', al: 1 }, expect.any(Object));
});

it('returns an empty URL when VK ajax throws, allowing a retry', async () => {
  w.ajax = { post: vi.fn(() => { throw new Error('VK ajax unavailable'); }) };
  await initDownloader();
  expect(await requestUrl([42, 7])).toBe('');
});

it('returns the same large artwork as the mini-player bridge from reload_audios', async () => {
  vi.resetModules();
  const tuple = [42, 7, 'https://psv4.vkuseraudio.net/audio/very-long-signed-resource-path/index.m3u8?token=test', 'Song', 'Artist', 200];
  tuple[14] = ',https://sun9-1.vkuserphoto.ru/large.jpg';
  w.ajax = { post: vi.fn((_url, _params, callbacks) => callbacks.onDone({ payload: [0, [[tuple]]] })) };
  listeners = vi.spyOn(window, 'addEventListener');
  await import('./audio-downloader.js');
  const response = new Promise<{ info: { coverUrl: string } }>(resolve => {
    window.addEventListener('vkify:audio:track-info-response', event => resolve((event as CustomEvent).detail), { once: true });
  });
  window.dispatchEvent(new CustomEvent('vkify:audio:get-track-info', { detail: { requestId: 'test', trackId: '7_42' } }));
  expect((await response).info.coverUrl).toBe(tupleArtwork(tuple));
  expect(tupleArtwork(tuple)).toBe('https://sun9-1.vkuserphoto.ru/large.jpg');
});

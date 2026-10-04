// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { tupleArtwork } from '@/shared/music-artwork.js';

const w = window as Window & { __vkifyAudioDl?: boolean; ajax?: unknown };
let listeners: ReturnType<typeof vi.spyOn> | undefined;

afterEach(() => {
  for (const [name, listener] of listeners?.mock.calls ?? []) window.removeEventListener(name, listener);
  listeners?.mockRestore();
  delete w.__vkifyAudioDl;
  delete w.ajax;
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

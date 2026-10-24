// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import Hls from 'hls.js/light';
import type { LoaderCallbacks, LoaderConfiguration, LoaderContext } from 'hls.js';
import { createSourceLoader } from './source-loader.js';

const browser = vi.hoisted(() => ({ IS_FIREFOX: false }));
vi.mock('@/shared/constants/browser.js', () => browser);

afterEach(() => {
  browser.IS_FIREFOX = false;
  vi.restoreAllMocks();
});

const url = 'https://audio.vkuseraudio.net/index.m3u8';
const manifest = '#EXTM3U\n#EXTINF:10,\nsegment.ts';
const config = {} as LoaderConfiguration;
function callbacks() {
  return { onSuccess: vi.fn(), onError: vi.fn(), onTimeout: vi.fn() } as unknown as LoaderCallbacks<LoaderContext>;
}

it('serves the initial manifest without another network request', async () => {
  const network = vi.spyOn(Hls.DefaultConfig.loader.prototype, 'load').mockImplementation(() => {});
  const Loader = createSourceLoader(url, manifest);
  const loader = new Loader(Hls.DefaultConfig);
  const cb = callbacks();
  loader.load({ url, responseType: 'text' }, config, cb);
  await Promise.resolve();
  expect(network).not.toHaveBeenCalled();
  expect(cb.onSuccess).toHaveBeenCalledWith(expect.objectContaining({ url, data: manifest, code: 200 }), loader.stats, loader.context, null);
  loader.destroy();
});

it('delegates child playlists and binary segments to the normal loader', () => {
  const network = vi.spyOn(Hls.DefaultConfig.loader.prototype, 'load').mockImplementation(() => {});
  const Loader = createSourceLoader(url, manifest);
  const loader = new Loader(Hls.DefaultConfig);
  const cb = callbacks();
  for (const context of [
    { url: 'https://audio.vkuseraudio.net/child.m3u8', responseType: 'text' as const },
    { url: 'https://audio.vkuseraudio.net/segment.ts', responseType: 'arraybuffer' as const },
  ]) {
    loader.load(context, config, cb);
    expect(network).toHaveBeenLastCalledWith(context, config, cb);
  }
  expect(network).toHaveBeenCalledTimes(2);
  loader.destroy();
});

it('does not deliver the cached manifest after cancellation', async () => {
  const Loader = createSourceLoader(url, manifest);
  const loader = new Loader(Hls.DefaultConfig);
  const cb = callbacks();
  loader.load({ url, responseType: 'text' }, config, cb);
  loader.abort();
  await Promise.resolve();
  expect(cb.onSuccess).not.toHaveBeenCalled();
  loader.destroy();
});

it('preserves the Firefox AES rewrite for the initial manifest', async () => {
  browser.IS_FIREFOX = true;
  const Loader = createSourceLoader(url, '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:10,\nsegment.ts');
  const loader = new Loader(Hls.DefaultConfig);
  const cb = callbacks();
  loader.load({ url, responseType: 'text' }, config, cb);
  await Promise.resolve();
  expect(cb.onSuccess).toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringContaining('#EXT-X-KEY:METHOD=NONE') }), loader.stats, loader.context, null);
  loader.destroy();
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LoaderCallbacks, LoaderConfiguration, LoaderContext } from 'hls.js';

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllGlobals();
});

it('waits for the native Firefox promise API in a freshly injected script', async () => {
  // chrome in Firefox returns undefined; the background response arrives later.
  const callbackSend = vi.fn(() => undefined);
  let respond!: (value: unknown) => void;
  const promiseSend = vi.fn(() => new Promise(resolve => { respond = resolve; }));
  const firefoxApi = { runtime: { sendMessage: promiseSend } };
  vi.stubGlobal('chrome', { runtime: { sendMessage: callbackSend } });
  vi.stubGlobal('browser', firefoxApi);
  vi.stubGlobal('__vkifyApi', undefined);
  const { BackgroundLoader } = await import('./bg-loader.js');

  // Even if another sandbox exposes the callback API again, the loader keeps
  // the native promise API rather than relying on a prior global assignment.
  vi.stubGlobal('chrome', { runtime: { sendMessage: callbackSend } });
  const loader = new BackgroundLoader();
  const context: LoaderContext = { url: 'https://audio.userapi.com/index.m3u8', responseType: 'text' };
  const onSuccess = vi.fn();
  const onError = vi.fn();
  loader.load(context, {} as LoaderConfiguration, { onSuccess, onError } as unknown as LoaderCallbacks<LoaderContext>);
  expect(onSuccess).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
  expect(callbackSend).not.toHaveBeenCalled();
  expect(promiseSend).toHaveBeenCalledOnce();

  respond({ success: true, status: 200, dataB64: btoa('#EXTM3U\n#EXTINF:10,\nsegment.ts') });
  await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  expect(onSuccess.mock.calls[0][0].data).toContain('#EXTM3U');
  expect(onError).not.toHaveBeenCalled();
});

it('reports the background failure through the HLS error callback', async () => {
  vi.stubGlobal('browser', { runtime: { sendMessage: vi.fn().mockResolvedValue({ success: false, error: 'HTTP 403' }) } });
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn(() => undefined) } });
  vi.stubGlobal('__vkifyApi', undefined);
  const { BackgroundLoader } = await import('./bg-loader.js');
  const loader = new BackgroundLoader();
  const onError = vi.fn();
  loader.load({ url: 'https://audio.userapi.com/index.m3u8', responseType: 'text' }, {} as LoaderConfiguration,
    { onSuccess: vi.fn(), onError } as unknown as LoaderCallbacks<LoaderContext>);
  await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
  expect(onError.mock.calls[0][0]).toEqual({ code: 0, text: 'HTTP 403' });
});

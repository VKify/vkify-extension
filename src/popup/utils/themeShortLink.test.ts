import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { sendMessage } from '@/shared/messaging.js';
import { createThemeShortener } from './themeShortLink.js';
vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
const url = 'https://vkify.ru/theme/eyJ2IjoyfQ';
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());
it('uses the existing VK API bridge with private statistics', async () => {
  vi.mocked(sendMessage).mockResolvedValue({ success: true, data: { short_url: 'https://vk.cc/abc123', access_key: 'not-saved' } } as never);
  await expect(createThemeShortener()(url)).resolves.toBe('https://vk.cc/abc123');
  expect(sendMessage).toHaveBeenCalledWith({ type: 'VK_API_CALL', method: 'utils.getShortLink', params: { url, private: 1 } });
});
it('shortens VK theme links through the same API', async () => {
  const request = vi.fn(async () => ({ short_url: 'https://vk.cc/vktheme' }));
  const vkUrl = 'https://vk.ru/vkify?vkify_theme=eyJ2IjoyfQ';
  await expect(createThemeShortener(request)(vkUrl)).resolves.toBe('https://vk.cc/vktheme');
  expect(request).toHaveBeenCalledWith(vkUrl);
});
it('deduplicates pending requests and reuses completed links without mixing themes', async () => {
  let finish!: (data: unknown) => void;
  const request = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const shorten = createThemeShortener(request);
  const first = shorten(url), second = shorten(url);
  expect(first).toBe(second); expect(request).toHaveBeenCalledOnce();
  finish({ short_url: 'https://vk.cc/abc123' });
  await first; await shorten(url);
  expect(request).toHaveBeenCalledOnce();
  const different = shorten(url + 'A');
  finish({ short_url: 'https://vk.cc/other' });
  expect(await different).toBe('https://vk.cc/other');
  expect(request).toHaveBeenCalledTimes(2);
});
it('allows retry after API failure', async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ short_url: 'https://vk.cc/retry' });
  const shorten = createThemeShortener(request);
  await expect(shorten(url)).rejects.toThrow('unavailable');
  await expect(shorten(url)).resolves.toBe('https://vk.cc/retry');
  expect(request).toHaveBeenCalledTimes(2);
});
it.each(['http://vk.cc/id', 'https://vk.cc.evil.test/id', 'javascript:alert(1)', 'https://user@vk.cc/id', 'https://vk.cc:8443/id', 'https://vk.cc/id?track=1', 'https://vk.cc/id#hash', 'https://vk.cc/'])('rejects an unexpected returned URL: %s', async short_url => {
  await expect(createThemeShortener(async () => ({ short_url }))(url)).rejects.toThrow();
});
it.each(['https://evil.test/theme/id', 'https://vkify.ru/profile', 'https://vkify.ru/theme/id?secret=1', 'https://vkify.ru/theme/id#hash', 'https://vk.ru/vkify', 'https://vk.ru/vkify?vkify_theme=id&extra=1', 'https://vk.ru/vkify?vkify_theme=id&vkify_theme=other', 'https://vk.ru/other?vkify_theme=id', 'https://vk.ru.evil.test/vkify?vkify_theme=id', 'http://vk.ru/vkify?vkify_theme=id'])('never submits a non-theme URL: %s', async value => {
  const request = vi.fn();
  await expect(createThemeShortener(request)(value)).rejects.toThrow('Invalid theme URL');
  expect(request).not.toHaveBeenCalled();
});
it('bounds waiting and lets the user retry a timed-out request', async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce({ short_url: 'https://vk.cc/ready' });
  const shorten = createThemeShortener(request);
  const failure = expect(shorten(url)).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(15_000); await failure;
  await expect(shorten(url)).resolves.toBe('https://vk.cc/ready');
});

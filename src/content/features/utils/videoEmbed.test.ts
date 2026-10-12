// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { parseVideoUrl, setupYouTubePlayback, setupVimeoPlayback, type YouTubePlaybackController } from './videoEmbed.js';
import { parseVideoUrl as parsePreviewVideoUrl } from '@/shared/videoEmbed.js';

it.each([
  'https://www.twitch.tv/titanthef',
  'https://www.twitch.tv/videos/123456',
  'https://player.twitch.tv/?channel=titanthef',
  'https://clips.twitch.tv/ExampleClip',
  'https://www.dailymotion.com/video/x123456',
  'https://www.dailymotion.com/embed/video/x123456',
  'https://dai.ly/x123456',
])('rejects the removed video provider in wallpaper and preview parsers: %s', url => {
  expect(parseVideoUrl(url)).toBeNull();
  expect(parsePreviewVideoUrl(url)).toBeNull();
});

let controller: YouTubePlaybackController | undefined;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { controller?.destroy(); controller = undefined; vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

function fixture(volume: number) {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const post = vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation(() => {});
  controller = setupYouTubePlayback(iframe, volume);
  const messages = () => post.mock.calls.map(([message]) => JSON.parse(message as string));
  iframe.dispatchEvent(new Event('load'));
  return { iframe, post, messages };
}

it('sends the actual YouTube volume and explicitly mutes zero without navigating', () => {
  const { iframe, messages } = fixture(25);
  expect(messages()).toContainEqual({ event: 'command', func: 'setVolume', args: [25] });
  controller!.setVolume(75);
  expect(messages().slice(-2)).toEqual([
    { event: 'command', func: 'setVolume', args: [75] },
    { event: 'command', func: 'unMute', args: [] },
  ]);
  controller!.setVolume(0);
  expect(messages().slice(-2)).toEqual([
    { event: 'command', func: 'setVolume', args: [0] },
    { event: 'command', func: 'mute', args: [] },
  ]);
  expect(iframe.src).toBe('');
});

it('retries with the latest volume and reapplies it when the player becomes ready', async () => {
  const { iframe, post, messages } = fixture(80);
  controller!.setVolume(0); post.mockClear();
  await vi.advanceTimersByTimeAsync(400);
  expect(messages().slice(-2)).toEqual([
    { event: 'command', func: 'setVolume', args: [0] },
    { event: 'command', func: 'mute', args: [] },
  ]);
  controller!.setVolume(35); post.mockClear();
  const ready = (origin: string) => window.dispatchEvent(new MessageEvent('message', {
    origin, source: iframe.contentWindow, data: JSON.stringify({ event: 'onReady' }),
  }));
  ready('https://evil.example'); expect(post).not.toHaveBeenCalled();
  ready('https://www.youtube.com');
  expect(messages()).toContainEqual({ event: 'command', func: 'setVolume', args: [35] });
  controller!.destroy(); post.mockClear();
  await vi.advanceTimersByTimeAsync(5000);
  ready('https://www.youtube.com');
  expect(post).not.toHaveBeenCalled();
});

it('controls Vimeo volume and mute, keeping the latest value across readiness and retries', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const post = vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation(() => {});
  controller = setupVimeoPlayback(iframe, 25);
  iframe.dispatchEvent(new Event('load'));
  expect(post).toHaveBeenCalledWith({ method: 'setVolume', value: 0.25 }, 'https://player.vimeo.com');
  controller.setVolume(0); post.mockClear();
  await vi.advanceTimersByTimeAsync(400);
  expect(post.mock.calls.map(([message]) => message)).toContainEqual({ method: 'setMuted', value: true });
  const ready = (origin: string) => window.dispatchEvent(new MessageEvent('message', {
    origin, source: iframe.contentWindow, data: JSON.stringify({ event: 'ready' }),
  }));
  post.mockClear(); ready('https://evil.example'); expect(post).not.toHaveBeenCalled();
  controller.setVolume(70); post.mockClear(); ready('https://player.vimeo.com');
  expect(post).toHaveBeenCalledWith({ method: 'setVolume', value: 0.7 }, 'https://player.vimeo.com');
  expect(post).toHaveBeenCalledWith({ method: 'setMuted', value: false }, 'https://player.vimeo.com');
  controller.destroy(); post.mockClear();
  await vi.advanceTimersByTimeAsync(5000); ready('https://player.vimeo.com');
  expect(post).not.toHaveBeenCalled();
  expect(iframe.src).toBe('');
});

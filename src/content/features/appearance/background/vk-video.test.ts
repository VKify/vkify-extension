// @vitest-environment happy-dom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { FeatureManager } from '@/content/core/feature-manager.js';
import { createBackgroundFeatures } from './index.js';
import { fetchVideoData } from '../../center/video/api.js';

vi.mock('../../center/video/api.js', () => ({ fetchVideoData: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(fetchVideoData).mockReset();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

function fixture() {
  const settings: Record<string, unknown> = {
    custom_background: 'https://vkvideo.ru/video-1_2', background_type: 'embed', background_video_speed: 50,
  };
  const manager = { getSetting: async (key: string) => settings[key], injectCSS: vi.fn(), removeCSS: vi.fn() } as unknown as FeatureManager;
  return { settings, handlers: createBackgroundFeatures(manager) };
}

it('discards a late VK API result after switching to another wallpaper', async () => {
  let resolve!: (data: Awaited<ReturnType<typeof fetchVideoData>>) => void;
  vi.mocked(fetchVideoData).mockReturnValue(new Promise(done => { resolve = done; }));
  const { settings, handlers } = fixture();
  const pending = handlers.custom_background.enable!();
  await vi.advanceTimersByTimeAsync(0);
  settings.custom_background = 'https://example.com/image.png'; settings.background_type = 'image';
  await handlers.custom_background.enable!();
  resolve({ files: { mp4_720: 'https://example.com/video.mp4' }, title: 'video' });
  await pending;
  expect(document.getElementById('vkify-image-bg')).not.toBeNull();
  expect(document.getElementById('vkify-video-bg')).toBeNull();
});

it('does not restore a wallpaper after it was cleared while the API request was pending', async () => {
  let resolve!: (data: Awaited<ReturnType<typeof fetchVideoData>>) => void;
  vi.mocked(fetchVideoData).mockReturnValue(new Promise(done => { resolve = done; }));
  const { handlers } = fixture();
  const pending = handlers.custom_background.enable!();
  await vi.advanceTimersByTimeAsync(0);
  await handlers.custom_background.disable!();
  resolve({ files: { mp4_720: 'https://example.com/video.mp4' }, title: 'video' });
  await pending;
  expect(document.getElementById('vkify-video-bg')).toBeNull();
});

it('keeps a speed change made before video metadata loads', async () => {
  vi.mocked(fetchVideoData).mockResolvedValue({ files: { mp4_720: 'https://example.com/video.mp4' }, title: 'video' });
  const { settings, handlers } = fixture();
  await handlers.custom_background.enable!();
  settings.background_video_speed = 200;
  await handlers.background_video_speed.enable!();
  const video = document.getElementById('vkify-video-bg') as HTMLVideoElement;
  video.dispatchEvent(new Event('loadedmetadata'));
  expect(video.playbackRate).toBe(2);
  expect(document.getElementById('vkify-embed-bg')).toBeNull();
});

it('silences VK video when zero volume invokes the disable handler', async () => {
  vi.mocked(fetchVideoData).mockResolvedValue({ files: { mp4_720: 'https://example.com/video.mp4' }, title: 'video' });
  const { settings, handlers } = fixture();
  settings.background_video_volume = 40;
  await handlers.custom_background.enable!();
  const video = document.getElementById('vkify-video-bg') as HTMLVideoElement;
  video.dispatchEvent(new Event('loadedmetadata'));
  await Promise.resolve();
  expect(video.volume).toBe(0.4);
  expect(video.muted).toBe(false);
  settings.background_video_volume = 0;
  await handlers.background_video_volume.disable!();
  expect(video.volume).toBe(0);
  expect(video.muted).toBe(true);
});

it('does not unmute a video after a pending play resolves if the slider moved to zero', async () => {
  let finish!: () => void;
  vi.mocked(HTMLMediaElement.prototype.play).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  vi.mocked(fetchVideoData).mockResolvedValue({ files: { mp4_720: 'https://example.com/video.mp4' }, title: 'video' });
  const { settings, handlers } = fixture();
  settings.background_video_volume = 40;
  await handlers.custom_background.enable!();
  const video = document.getElementById('vkify-video-bg') as HTMLVideoElement;
  video.dispatchEvent(new Event('loadedmetadata'));
  settings.background_video_volume = 0;
  await handlers.background_video_volume.disable!();
  finish(); await Promise.resolve();
  expect(video.volume).toBe(0);
  expect(video.muted).toBe(true);
});

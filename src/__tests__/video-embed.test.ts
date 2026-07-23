import { describe, expect, it } from 'vitest';
import { parseVideoUrl } from '../shared/videoEmbed.js';

describe('parseVideoUrl — current VK domains', () => {
  it.each([
    'https://vk.ru/video-123_456',
    'https://m.vk.ru/clip-123_456',
    'https://vkvideo.ru/video-123_456',
  ])('parses %s', (url) => {
    expect(parseVideoUrl(url)).toMatchObject({
      platform: 'vk',
      type: 'embed',
      embedUrl: expect.stringContaining('https://vkvideo.ru/video_ext.php?oid=-123&id=456'),
    });
  });
});

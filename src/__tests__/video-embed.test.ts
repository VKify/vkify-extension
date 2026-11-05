import { describe, expect, it } from 'vitest';
import { parseVideoUrl } from '../shared/videoEmbed.js';
import { parseVideoUrl as parseContentVideoUrl } from '../content/features/utils/videoEmbed.js';

describe('parseVideoUrl — current VK domains', () => {
  it.each([parseVideoUrl, parseContentVideoUrl])('supports modal video links in both wallpaper parsers', parse => {
    const result = parse('https://vk.ru/vkify?z=video-235511300_456239154');
    expect(result?.platform).toBe('vk');
    const url = new URL(result!.embedUrl);
    expect(url.searchParams.get('oid')).toBe('-235511300');
    expect(url.searchParams.get('id')).toBe('456239154');
    expect(url.searchParams.get('loop')).toBe('1');
  });
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

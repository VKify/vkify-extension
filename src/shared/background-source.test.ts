import { expect, it, vi } from 'vitest';
import { shouldCacheBackground } from './background-source.js';
import { prepareBackground } from './prepare-background.js';
import { collectShareParams, hasLocalThemeBackground } from '../popup/utils/themeShare.js';
it('automatically uses original URLs for VKify and VK', () => {
  for (const url of ['https://vkify.ru/wallpapers/images/a.jpg', 'https://sun9.userapi.com/a.jpg']) {
    expect(shouldCacheBackground(url)).toBe(false);
  }
  expect(shouldCacheBackground('https://other.test/a.jpg')).toBe(true);
  expect(shouldCacheBackground('https://vkify.ru.evil.test/a.jpg')).toBe(true);
});
it('shares the source of a local copy without putting image bytes into the theme', () => {
  const settings = { custom_background: 'data:image/png;base64,AAAA', background_source_url: 'https://vkify.ru/a.jpg', background_type: 'image' as const };
  expect(hasLocalThemeBackground(settings)).toBe(false);
  expect(collectShareParams(settings)).toContainEqual({ key: 'custom_background', value: settings.background_source_url });
  expect(JSON.stringify(collectShareParams(settings))).not.toContain('base64');
  expect(hasLocalThemeBackground({ custom_background: settings.custom_background })).toBe(true);
});
it('automatically converts external images at the receiver and preserves their source', async () => {
  const fetchImage = vi.fn(async () => ({ success: true, dataUrl: 'data:image/png;base64,AAAA' }));
  const settings = { custom_background: 'https://vkify.ru/a.jpg', background_type: 'image' as const };
  expect(await prepareBackground(settings, fetchImage)).toMatchObject({ custom_background: settings.custom_background, background_source_url: settings.custom_background });
  expect(fetchImage).not.toHaveBeenCalled();
  const external = { ...settings, custom_background: 'https://other.test/a.jpg' };
  expect(await prepareBackground(external, fetchImage)).toMatchObject({ custom_background: 'data:image/png;base64,AAAA', background_source_url: external.custom_background });
  expect(await prepareBackground({ custom_background: '' }, fetchImage)).toMatchObject({ background_source_url: '' });
  fetchImage.mockRejectedValueOnce(new Error('offline'));
  expect(await prepareBackground(external, fetchImage)).toMatchObject({ custom_background: external.custom_background });
});

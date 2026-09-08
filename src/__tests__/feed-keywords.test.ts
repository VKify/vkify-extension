import { expect, it } from 'vitest';
import { feedItemText, matchFeedWord, normalizeFeedWords } from '../shared/utils/feed-keywords.js';
import { DEFAULT_SETTINGS, RESET_SETTINGS } from '../shared/constants/defaults.js';
import { ADS_PROTECTION_SETTINGS } from '../shared/constants/ads-protection.js';

it('normalizes imported lists and ignores empty or invalid entries', () => {
  const block = normalizeFeedWords([' ВЕБИНАР ', 'вебинар', '', ' ', null, 1]);
  expect(block).toEqual(['вебинар']);
  expect(matchFeedWord('Серия вебинаров', { block, allow: [] })).toBe('вебинар');
  expect(matchFeedWord('Серия вебинаров VKify', { block, allow: ['vkify'] })).toBeNull();
  expect(normalizeFeedWords('казино')).toEqual([]);
});

it('reads reposts and attachment descriptions without treating URLs as post text', () => {
  const item = { text: 'Пост', copy_history: [{ text: 'Репост' }],
    attachments: [{ link: { title: 'Вебинар', description: 'Описание', url: 'https://casino.example' } }],
    tracking: { text: 'казино' } };
  expect(feedItemText(item)).toBe('Пост\nРепост\nВебинар\nОписание');
});

it('reaches full protection with DOM off in default and reset settings', () => {
  for (const settings of [DEFAULT_SETTINGS, RESET_SETTINGS]) {
    expect(settings.block_feed_ads_dom).toBe(false);
    expect(ADS_PROTECTION_SETTINGS.every(key => settings[key] === true)).toBe(true);
  }
});

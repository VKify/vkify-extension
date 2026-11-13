// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { filterLegacyFeedRightText, isLegacyFeedRightUrl } from './feed-right-legacy.js';

const promo = '<div class="page_block apps_feedRightAppsBlock_single_app--promo" data-testid="feed_apps_right_block"><a data-block-type="featured_promo_game"></a><a class="apps_feedRightAppsBlock__name">Новогодняя почта в «Ёлочке 2027»</a></div>';
const organic = '<section id="continue-apps">Продолжить игру</section>';

it('removes the observed legacy game promotion from HTML inside VK payloads, preserving scripts and unrelated blocks', () => {
  const titles: string[] = [];
  const body = { payload: [0, [organic + promo, 'window.legacyReady=true;']], lang: { name: 'VK' } };
  const result = JSON.parse(filterLegacyFeedRightText(JSON.stringify(body), title => titles.push(title)));
  expect(result).toEqual({ ...body, payload: [0, [organic, 'window.legacyReady=true;']] });
  expect(titles).toEqual(['Новогодняя почта в «Ёлочке 2027»']);
});

it('supports raw HTML and the optional legacy prefix without treating arbitrary text as a promotion', () => {
  const report = () => {};
  expect(filterLegacyFeedRightText(organic + promo, report)).toBe(organic);
  const prefixed = '<!--' + JSON.stringify({ payload: [0, [promo, '']] });
  expect(filterLegacyFeedRightText(prefixed, report)).toBe('<!--' + JSON.stringify({ payload: [0, ['', '']] }));
  for (const unchanged of [organic, 'feed_apps_right_block', 'broken {', JSON.stringify({ error: 'try again' }),
    '<div data-testid="feed_apps_right_block">Обычные игры</div>']) {
    expect(filterLegacyFeedRightText(unchanged, report)).toBe(unchanged);
  }
});

it('matches only the same-origin right-block endpoint', () => {
  window.location.href = 'https://vk.ru/feed';
  expect(isLegacyFeedRightUrl('/al_feed_right_block.php?act=default')).toBe(true);
  for (const url of ['/al_feed.php', '/feed?source=al_feed_right_block.php', 'https://vk.ru.invalid/al_feed_right_block.php'])
    expect(isLegacyFeedRightUrl(url)).toBe(false);
});

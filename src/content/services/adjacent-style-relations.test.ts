// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { startAdjacentStyleRelations } from './adjacent-style-relations.js';

let stop: (() => void) | undefined;
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
const flag = (name: string) => document.documentElement.setAttribute(`data-vkify-${name}`, '');
afterEach(() => {
  stop?.(); stop = undefined; vi.restoreAllMocks(); document.body.replaceChildren();
  for (const attribute of [...document.documentElement.attributes]) if (attribute.name.startsWith('data-vkify-')) document.documentElement.removeAttribute(attribute.name);
});

it('updates the immediate sibling on insertion, identity changes and removal without document rescans or layout', async () => {
  flag('block_recommendations_communities');
  document.body.innerHTML = '<section><div id="anchor" data-testid="similar-group-block"></div><div id="gap"></div></section><main id="comments"></main>';
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() => { throw new Error('layout read'); });
  stop = startAdjacentStyleRelations();
  const gap = document.getElementById('gap')!;
  expect(gap.hasAttribute('data-vkify-after-community-promo')).toBe(true);
  const documentQuery = vi.spyOn(document.documentElement, 'querySelectorAll');
  const anchor = document.getElementById('anchor')!;
  anchor.insertAdjacentHTML('afterend', '<div id="replacement"></div>'); await settle();
  const replacement = document.getElementById('replacement')!;
  expect(gap.hasAttribute('data-vkify-after-community-promo')).toBe(false);
  expect(replacement.hasAttribute('data-vkify-after-community-promo')).toBe(true);
  document.getElementById('comments')!.innerHTML = '<div><span>New comment</span></div>'; await settle();
  expect(documentQuery).not.toHaveBeenCalled();
  anchor.setAttribute('data-testid', 'ordinary'); await settle();
  expect(replacement.hasAttribute('data-vkify-after-community-promo')).toBe(false);
  anchor.setAttribute('data-testid', 'similar-group-block'); await settle();
  expect(replacement.hasAttribute('data-vkify-after-community-promo')).toBe(true);
  anchor.remove(); await settle();
  expect(replacement.hasAttribute('data-vkify-after-community-promo')).toBe(false);
});

it('tracks conditional music spacers, parent predicates and feature lifecycle', async () => {
  flag('block_music_ads'); flag('hide_post_box'); flag('theme-radius');
  document.body.innerHTML = '<section><div data-testid="subscriptionbanner"></div><div id="music"></div></section><div id="feed"><div data-testid="feed_publish_block"></div><div id="post-gap"></div></div><div data-testid="group-header"><div data-testid="communityheader_cover"></div><div id="cover-title"></div></div>';
  stop = startAdjacentStyleRelations();
  const music = document.getElementById('music')!;
  expect(music.hasAttribute('data-vkify-after-music-subscription')).toBe(false);
  music.style.setProperty('--vkit_internal--spacing_gap_size', '12px'); await settle();
  expect(music.hasAttribute('data-vkify-after-music-subscription')).toBe(true);
  document.getElementById('feed')!.setAttribute('data-testid', 'feed_main_container'); await settle();
  expect(document.getElementById('post-gap')!.hasAttribute('data-vkify-after-post-box')).toBe(true);
  expect(document.getElementById('cover-title')!.hasAttribute('data-vkify-after-community-cover')).toBe(true);
  music.removeAttribute('style'); await settle();
  expect(music.hasAttribute('data-vkify-after-music-subscription')).toBe(false);
  document.documentElement.removeAttribute('data-vkify-theme-radius'); await settle();
  expect(document.getElementById('cover-title')!.hasAttribute('data-vkify-after-community-cover')).toBe(false);
  flag('theme-radius'); await settle();
  expect(document.getElementById('cover-title')!.hasAttribute('data-vkify-after-community-cover')).toBe(true);
  stop(); stop = undefined;
  expect(document.querySelector('[data-vkify-after-post-box], [data-vkify-after-community-cover]')).toBeNull();
});

it('retains shared promo targets until the last link is gone and only marks the nearest premium section', async () => {
  flag('block_recommendations_feed'); flag('block_recommendations_video');
  document.body.innerHTML = '<main id="spa_layout_content"><div><section><a id="one" href="https://yandex.ru/project/browser/vk/one"></a><a id="two" href="https://yandex.ru/project/browser/vk/two"></a></section></div><div id="browser-gap"></div><section id="outer"><a href="https://vk.ru/vkpremium"></a><section id="inner"><a href="https://vk.ru/vkpremium"></a></section><div id="inner-gap"></div></section><div id="outer-gap"></div></main>';
  stop = startAdjacentStyleRelations();
  const gap = document.getElementById('browser-gap')!;
  expect(gap.hasAttribute('data-vkify-after-browser-promo')).toBe(true);
  document.getElementById('one')!.remove(); await settle();
  expect(gap.hasAttribute('data-vkify-after-browser-promo')).toBe(true);
  document.getElementById('two')!.setAttribute('href', '/unrelated'); await settle();
  expect(gap.hasAttribute('data-vkify-after-browser-promo')).toBe(false);
  const inner = document.getElementById('inner-gap')!;
  expect(inner.hasAttribute('data-vkify-after-premium')).toBe(true);
  expect(document.getElementById('outer-gap')!.hasAttribute('data-vkify-after-premium')).toBe(false);
  inner.textContent = 'Content'; await settle();
  expect(inner.hasAttribute('data-vkify-after-premium')).toBe(false);
  inner.firstChild!.textContent = ''; await settle();
  // An empty text node follows the browser's actual :empty semantics.
  expect(inner.hasAttribute('data-vkify-after-premium')).toBe(inner.matches(':empty'));
});

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

it('leaves music spacers intact and tracks parent predicates and feature lifecycle', async () => {
  flag('block_music_ads'); flag('hide_post_box'); flag('theme-radius');
  document.body.innerHTML = '<section><div data-testid="subscriptionbanner"></div><div id="music"></div></section><div id="feed"><div data-testid="feed_publish_block"></div><div id="post-gap"></div></div><div data-testid="group-header"><div data-testid="communityheader_cover"></div><div id="cover-title"></div></div>';
  stop = startAdjacentStyleRelations();
  const music = document.getElementById('music')!;
  expect(music.hasAttribute('data-vkify-after-music-subscription')).toBe(false);
  music.style.setProperty('--vkit_internal--spacing_gap_size', '12px'); await settle();
  expect(music.hasAttribute('data-vkify-after-music-subscription')).toBe(false);
  document.getElementById('feed')!.setAttribute('data-testid', 'feed_main_container'); await settle();
  expect(document.getElementById('post-gap')!.hasAttribute('data-vkify-after-post-box')).toBe(false);
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

it('marks only the empty card next to catalog subscriptions and restores it when content arrives', async () => {
  const previous = location.href;
  history.replaceState(null, '', '/groups');
  try {
    flag('block_recommendations_communities');
    document.body.innerHTML = `<main id="spa_layout_content">
      <section><div role="tablist"><div role="tab">Subscriptions</div></div></section>
      <div class="native-spacer"></div>
      <section id="empty">
        <span><div role="heading" aria-level="2"><span title=""><span></span></span></div></span>
        <span><div role="heading" aria-level="2"><span title=""><span></span></span></div></span>
      </section>
      <section id="unrelated"></section>
    </main>`;
    stop = startAdjacentStyleRelations();
    const card = document.getElementById('empty')!;
    const marker = 'data-vkify-empty-community-recommendations';
    expect(card.hasAttribute(marker)).toBe(true);
    expect(card.previousElementSibling?.hasAttribute(marker)).toBe(true);
    expect(document.getElementById('unrelated')!.hasAttribute(marker)).toBe(false);
    card.querySelector('[role="heading"]')!.textContent = 'New content';
    await settle();
    expect(card.hasAttribute(marker)).toBe(false);
    expect(card.previousElementSibling?.hasAttribute(marker)).toBe(false);
  } finally {
    history.replaceState(null, '', previous);
  }
});

it('does not track former CSS promo spacers after their API migration', async () => {
  flag('block_yandex_browser_promo'); flag('block_recommendations_video'); flag('block_recommendations_communities');
  document.body.innerHTML = '<main id="spa_layout_content"><div data-testid="similar-group-block"></div><div id="community-gap"></div><div><section><a href="https://yandex.ru/project/browser/vk/promo"></a></section></div><div id="browser-gap"></div><section><a href="https://vk.ru/vkpremium"></a></section><div id="premium-gap"></div></main>';
  stop = startAdjacentStyleRelations();
  for (const id of ['community-gap', 'browser-gap', 'premium-gap'])
    expect([...document.getElementById(id)!.attributes].some(attribute => attribute.name.startsWith('data-vkify-'))).toBe(false);
});

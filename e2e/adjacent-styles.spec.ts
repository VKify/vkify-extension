import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installStyleRelations } from './style-relations-fixture.js';

test('adjacent promo, feed and cover styles follow DOM changes and restore when disabled', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const flags = ['block_recommendations_communities', 'block_recommendations_feed', 'block_recommendations_video', 'block_music_ads', 'hide_stories', 'hide_post_box', 'hide_open_profile_block', 'theme-radius'];
    const files = ['ads-blocking/recommendations/communities', 'ads-blocking/recommendations/feed', 'ads-blocking/recommendations/video', 'ads-blocking/recommendations/music', 'hiding/feed/hide-stories', 'hiding/feed/hide-post-box', 'hiding/profile/hide-open-profile-block', 'appearance/theme/theme-radius'];
    const css = (await Promise.all(files.map(file => readFile(`src/content/features/${file}.css`, 'utf8')))).join('\n');
    await page.setContent(`<html ${flags.map(flag => `data-vkify-${flag}`).join(' ')}><head><style>
      :root{--vkify-block-radius:24px;--vkify-block-radius-half:12px}div{min-height:12px}.title{border-radius:3px}${css}
    </style></head><body><main id="spa_layout_content">
      <section><div id="community" data-testid="similar-group-block">Promo</div><div id="community-gap">Gap</div></section>
      <section><div data-testid="profile-open-closed-profile-block">Open profile</div><div id="profile-gap">Gap</div></section>
      <section><div id="stories" class="StoriesSection--fixture">Stories</div><div id="stories-gap">Gap</div></section>
      <section data-testid="feed_main_container"><div data-testid="feed_publish_block">Post</div><div id="post-gap">Gap</div></section>
      <section><div data-testid="posting_form_by_owner_skeleton">Skeleton</div><div id="skeleton-gap">Gap</div></section>
      <section><div data-testid="subscriptionbanner">Subscribe</div><div id="music-gap" style="--vkit_internal--spacing_gap_size:12px">Gap</div></section>
      <div id="browser-promo"><section><a href="https://yandex.ru/project/browser/vk/test">Browser</a></section></div><div id="browser-gap">Gap</div>
      <section id="premium"><a href="https://vk.ru/vkpremium">Premium</a></section><div id="premium-gap"></div>
      <section id="header" data-testid="group-header"><div data-testid="communityheader_cover">Cover</div><div id="title" class="title">Title</div></section>
      <div id="unrelated">Regular content</div>
    </main></body></html>`);
    await installStyleRelations(page);
    const gaps = ['community-gap', 'profile-gap', 'stories-gap', 'post-gap', 'skeleton-gap', 'music-gap', 'browser-gap', 'premium-gap'];
    for (const id of gaps) await expect(page.locator(`#${id}`)).toBeHidden();
    await expect(page.locator('#unrelated')).toBeVisible();
    await expect(page.locator('#title')).toHaveCSS('border-bottom-left-radius', '24px');
    await page.locator('#community').evaluate(element => element.insertAdjacentHTML('afterend', '<div id="replacement">New spacer</div>'));
    await expect(page.locator('#replacement')).toBeHidden();
    await expect(page.locator('#community-gap')).toBeVisible();
    await page.locator('#community').evaluate(element => element.remove());
    await expect(page.locator('#replacement')).toBeVisible();
    await page.locator('#stories').evaluate(element => element.className = 'ordinary');
    await expect(page.locator('#stories-gap')).toBeVisible();
    await page.locator('#music-gap').evaluate(element => (element as HTMLElement).style.removeProperty('--vkit_internal--spacing_gap_size'));
    await expect(page.locator('#music-gap')).toBeVisible();
    await page.locator('#premium-gap').evaluate(element => element.textContent = 'Real content');
    await expect(page.locator('#premium-gap')).toBeVisible();
    await page.locator('#premium-gap').evaluate(element => element.textContent = '');
    await expect(page.locator('#premium-gap')).toBeHidden();
    await page.locator('#premium a').evaluate(element => element.setAttribute('href', '/other'));
    await expect(page.locator('#premium')).toBeVisible();
    await expect(page.locator('#premium-gap')).toBeVisible();
    await page.locator('#browser-promo a').evaluate(element => element.setAttribute('href', '/other'));
    await expect(page.locator('#browser-gap')).toBeVisible();
    await page.locator('#header').evaluate(element => element.setAttribute('data-testid', 'ordinary-header'));
    await expect(page.locator('#title')).toHaveCSS('border-bottom-left-radius', '3px');
    await page.evaluate(flags => { for (const flag of flags) document.documentElement.removeAttribute(`data-vkify-${flag}`); }, flags);
    for (const id of gaps) await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(page.locator('[data-vkify-after-community-promo], [data-vkify-after-post-box], [data-vkify-after-open-profile]')).toHaveCount(0);
  } finally { await browser.close(); }
});

import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

test('indexed recommendations preserve native selector matches across all section types', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    await page.setContent(`<main id="spa_layout_content">
      <div data-testid="channels-recommendation-block">Channels</div><div data-testid="channel-post-recommendation-block">Posts</div>
      <article>Groups<div><section data-testid="groups-recommendation-block"></section></div></article>
      <div data-testid="feed_apps_right_block">Apps</div>
      <div>Browser<section><p><a href="https://yandex.ru/project/browser/vk/promo">Install</a></p></section></div>
      <section data-testid="catalog-section-social_recommend">Games</section><a data-testid="catalog-section-promo_banner">Game banner</a>
      <section data-testid="market-catalog-block">Market<div title="Может заинтересовать"></div></section>
      <div><section data-testid="calls_aside_menu"></section><section class="vkuiBanner__host">Calls<img><a href="/call">CTA</a></section><section>Unrelated<img><a href="/other"></a></section></div>
      <a class="ImageBanner-module_banner--hash">Profile</a><div class="ConvoList__conversationsBar">Messenger</div>
      <div>Close<button aria-label="Закрыть" class="ConversationsBar__close"></button></div>
      <div data-testid="subscriptionbanner">Subscribe</div><div>Music<a href="/vk_music?musbanner=1">CTA</a></div>
      <div data-testid="AudioCatalog_SectionListenEachOther">Listen</div>
      <section>Outer<section>Inner<a href="https://vk.ru/vkpremium">Premium</a></section></section>
      <section>Mixed<a href="https://vk.ru/vkpremium">Direct</a><section>Nested<a href="https://vk.ru/vkpremium">Nested link</a></section></section>
      <div id="spa_root"><ins data-ad-slot="one">Video ad</ins></div><ins data-ad-slot="outside">Outside</ins>
      <section data-testid="similar-group-block">Communities</section><a id="l_invite_promo">Invite</a><a id="l_invite_menu_promo">Invite menu</a>
    </main>`);
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { createRecommendationTracker, RECOMMENDATION_SECTIONS } from './src/content/features/ads-blocking/recommendations/tracker.ts';
      const expected = [], actual = [];
      for (const [section, config] of Object.entries(RECOMMENDATION_SECTIONS)) {
        const seen = new Set();
        for (const selector of config.selectors) for (const element of document.querySelectorAll(selector)) {
          if (seen.has(element)) continue; seen.add(element);
          const text = (element.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 240);
          const href = element instanceof HTMLAnchorElement ? element.href : element.querySelector('a[href]')?.href;
          expected.push([section, [text, href, 'Селектор: ' + selector].filter(Boolean).join('\\n')]);
        }
      }
      const tracker = createRecommendationTracker({ loadStats: async () => {}, recordBlock: (...args) => actual.push([args[6], args[2]]) });
      for (const section of Object.keys(RECOMMENDATION_SECTIONS)) tracker.enable(section);
      window.recommendationResult = { expected: expected.map(JSON.stringify).sort(), actual: actual.map(JSON.stringify).sort() };
      for (const section of Object.keys(RECOMMENDATION_SECTIONS)) tracker.disable(section);
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const result = await page.evaluate(() => (window as unknown as { recommendationResult: { expected: string[]; actual: string[] } }).recommendationResult);
    expect(result.expected.length).toBeGreaterThan(20);
    expect(result.actual).toEqual(result.expected);
  } finally { await browser.close(); }
});

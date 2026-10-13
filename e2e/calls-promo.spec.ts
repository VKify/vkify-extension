import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { CALLS_PROMO_SELECTOR } from '../src/content/features/ads-blocking/recommendations/calls-selectors.js';

for (const href of ['https://vk.ru/@vk-sovmestniy-prosmotr','https://vk.com/@vk-sovmestniy-prosmotr','/@vk-sovmestniy-prosmotr','https://vk.ru/@calls-room-promo-example']) {
  test(`calls promo and following spacer hide safely (${href})`, async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
    try {
      const page = await browser.newPage();
      const css = await readFile('src/content/features/ads-blocking/recommendations/calls.css','utf8');
      // Calls column structure from the supplied HTML; only decorative SVGs omitted.
      await page.setContent(`<html><head><style>body{margin:0} section{height:40px} [style*="spacing_gap_size"]{height:16px}${css}</style></head><body>
        <div id="spa_layout_content"><div class="vkitInternalTwoColumnLayoutColumn"><div style="position:sticky;top:64px" id="aside">
          <section data-testid="calls_aside_menu">Calls navigation</section>
          <div id="before" class="vkit-S4nqJ8" style="--vkit_internal--spacing_gap_size:16px"></div>
          <section id="promo" class="vkit-yLAZP5 vkuiInternalTappable"><div aria-hidden="true"><div class="ReactionsBanner__image--GEWJp"><img alt="Some alt"></div></div><a href="${href}">Подробнее</a></section>
          <div id="after" class="vkit-S4nqJ8" style="--vkit_internal--spacing_gap_size:16px"></div>
          <section id="app" class="vkuiInternalGroup"><img alt="VK application"><a class="vkuiInternalTappable" href="https://apps.rustore.ru/app/com.vkontakte.android">Install VK</a></section>
          <div id="footer"></div>
        </div></div><section id="unrelated" class="vkuiBanner__host"><img alt="Some alt"><a href="${href}">Same article outside calls sidebar</a></section></div>
        <section id="outside"><a href="${href}">Outside page content</a></section>
      </body></html>`);
      await expect(page.locator(CALLS_PROMO_SELECTOR)).toHaveCount(1);
      await page.evaluate(() => document.documentElement.setAttribute('data-vkify-block_recommendations_calls',''));
      await expect(page.locator('#promo')).toBeHidden();
      await expect(page.locator('#after')).toBeHidden();
      // A rotating campaign can replace its CTA, image and hashed classes.
      await page.locator('#promo a').evaluate(el => el.setAttribute('href','https://vk.ru/@another-call-feature'));
      await page.locator('#promo img').evaluate(el => el.setAttribute('alt','Participants in rooms'));
      await expect(page.locator('#promo')).toBeHidden();
      await expect(page.locator(CALLS_PROMO_SELECTOR)).toHaveCount(1);
      // Support the previous VKUI banner component too.
      await page.locator('#promo').evaluate(el => el.className='vkuiBanner__host');
      await expect(page.locator('#promo')).toBeHidden();
      for (const selector of ['[data-testid="calls_aside_menu"]','#before','#app','#unrelated','#outside']) await expect(page.locator(selector)).toBeVisible();
      expect((await page.locator('#app').boundingBox())!.y).toBe(56);
      await page.locator('#aside').evaluate(el => el.innerHTML=el.innerHTML.replaceAll('vkit-S4nqJ8','new-spacing-hash').replaceAll('vkit-yLAZP5','new-banner-hash'));
      await expect(page.locator('#promo')).toBeHidden();
      await expect(page.locator('#after')).toBeHidden();
      // The adjacent element must actually be a spacer, not an arbitrary card.
      await page.locator('#after').evaluate(el => el.removeAttribute('style'));
      await expect(page.locator('#after')).toHaveCSS('display','block');
      await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-block_recommendations_calls'));
      await expect(page.locator('#promo')).toBeVisible();
    } finally { await browser.close(); }
  });
}

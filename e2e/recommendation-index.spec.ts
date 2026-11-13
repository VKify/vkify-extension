import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { installStyleRelations } from './style-relations-fixture.js';

test('only CSS-hidden calls promos produce DOM statistics after other sections move to API', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile('src/content/features/ads-blocking/recommendations/calls.css', 'utf8');
    await page.setContent('<html data-vkify-block_recommendations_calls><style>' + css + '</style><body><main id="spa_layout_content">' +
      '<div id="aside"><section data-testid="calls_aside_menu">Navigation</section><section id="promo" class="vkuiBanner__host">Calls<img><a href="/call">CTA</a></section></div>' +
      '<section id="ordinary" class="vkuiBanner__host">Ordinary card<img><a href="/other">Link</a></section>' +
      '<section id="premium"><a href="https://vk.ru/vkpremium">Premium</a></section><div data-testid="similar-group-block">Communities</div>' +
      '<div data-testid="channels-recommendation-block">Channels</div></main></body></html>');
    await installStyleRelations(page);
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { createCallsPromoStats } from './src/content/features/ads-blocking/recommendations/calls-stats.ts';
      const records = [];
      const tracker = createCallsPromoStats({ recordBlock: (...args) => records.push({ section: args[6], method: args[3] }) });
      tracker.enable();
      window.callsStats = { records, tracker };
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const records = () => page.evaluate(() => (window as any).callsStats.records);
    await expect.poll(records).toEqual([{ section: 'block_recommendations_calls', method: 'dom' }]);
    await expect(page.locator('#promo')).toBeHidden();
    for (const selector of ['#ordinary', '#premium', '[data-testid="similar-group-block"]', '[data-testid="channels-recommendation-block"]'])
      await expect(page.locator(selector)).toBeVisible();
    await page.locator('#aside').evaluate(el => el.insertAdjacentHTML('beforeend', '<section id="hydrated" class="vkuiBanner__host">New campaign<img><a>CTA</a></section>'));
    await expect(page.locator('#hydrated')).toBeVisible();
    expect(await records()).toHaveLength(1);
    await page.locator('#hydrated a').evaluate(el => el.setAttribute('href', '/new'));
    await expect(page.locator('#hydrated')).toBeHidden();
    await expect.poll(async () => (await records()).length).toBe(2);
    await page.evaluate(() => {
      (window as any).callsStats.tracker.disable();
      document.documentElement.removeAttribute('data-vkify-block_recommendations_calls');
    });
    await expect(page.locator('#promo')).toBeVisible();
    await expect(page.locator('#hydrated')).toBeVisible();
    expect(await records()).toHaveLength(2);
  } finally { await browser.close(); }
});

import { test, expect, chromium } from '@playwright/test';
import { build } from './esbuild-fixture.js';
import { resolve } from 'node:path';

test('download waits for native hover actions and sits before the menu', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { injectVkuiButtons } from './src/content/features/center/music/download/controls.ts';
      window.scan = injectVkuiButtons;
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') },
    define: { __VKIFY_SITE_URL__: JSON.stringify('https://vkify.ru'), __VKIFY_BROWSER__: JSON.stringify('chrome') } });
    await page.setContent(`<div data-testentitytag="audio" data-audio-id="1_2">
      <div aria-disabled="false"><a href="/audio1_2">Track</a><div id="duration">3:40</div></div>
    </div><script>${bundle.outputFiles[0].text}</script>`);
    const scan = () => page.evaluate(() => (window as unknown as { scan(): void }).scan());
    await scan();
    await expect(page.locator('.vkify-dl-btn')).toHaveCount(0);
    const mountActions = () => page.locator('[aria-disabled]').evaluate(el => {
      el.insertAdjacentHTML('beforeend', `<div id="actions" role="group"><div class="native-wrap"><button style="width:24px;height:24px">Add</button></div><div role="button" id="menu"><div><button><svg class="vkuiIcon--more_20"></svg></button></div></div></div>`);
    });
    await mountActions();
    await scan();
    await scan();
    await expect(page.locator('#actions .vkify-dl-btn')).toHaveCount(1);
    await expect(page.locator('#duration .vkify-dl-btn')).toHaveCount(0);
    await expect(page.locator('#actions > [data-vkify-adl-wrap] + #menu')).toHaveCount(1);
    await expect(page.locator('[data-vkify-adl-wrap]')).toHaveClass('native-wrap');
    await page.locator('#actions').evaluate(el => el.remove());
    await scan();
    await expect(page.locator('.vkify-dl-btn')).toHaveCount(0);
    await mountActions();
    await scan();
    await expect(page.locator('#actions .vkify-dl-btn')).toHaveCount(1);
  } finally { await browser.close(); }
});

import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('built extension restores the clip control without test IDs through rerenders and setting changes', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ language: 'ru', onboarding_done: true, first_run: false, clip_download: true }));
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<style>
      .ClipsFeedControlsLayout__root--current{position:absolute;left:500px;top:100px}
      .group{display:flex;flex-direction:column;gap:16px}.native-button{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center}
      </style><div data-clip-id="-221396877_456246804" data-active="true"></div>
      <div class="ClipsFeedControlsLayout__root--current"><div class="group" style="--rounded-group-gap:16px"><div class="native-wrapper"><div><button class="native-button" aria-label="Лайк"><svg class="vkuiIcon--like_outline_28"></svg></button></div></div></div></div>` }));
    await page.goto('https://vk.ru/clip-221396877_456246804');
    const button = page.locator('#vkify-clip-dl-btn');
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName('Скачать клип');
    const download = (await button.boundingBox())!;
    const like = (await page.getByRole('button', { name: 'Лайк', exact: true }).boundingBox())!;
    expect(download.x).toBe(like.x);
    expect(download.y + download.height).toBeLessThanOrEqual(like.y);
    expect(download.width).toBe(52);
    await page.locator('.ClipsFeedControlsLayout__root--current').evaluate(el => {
      el.querySelector('[data-vkify-clip-download]')?.remove();
      el.replaceWith(el.cloneNode(true));
    });
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();
    await worker.evaluate(() => chrome.storage.local.set({ clip_download: false }));
    await expect(button).toHaveCount(0);
    await expect(page.locator('[data-vkify-clip-download]')).toHaveCount(0);
    await worker.evaluate(() => chrome.storage.local.set({ clip_download: true }));
    await expect(button).toBeVisible();
    await expect(button).toHaveCount(1);
  } finally { await context.close(); }
});

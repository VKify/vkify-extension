import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('equalizer opens from current players, survives rerendering and follows its setting', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ language: 'ru', onboarding_done: true, first_run: false, audio_equalizer: true }));
    const page = await context.newPage();
    const group = `<div role="group" class="native-group"><button class="native-button" style="width:24px;height:24px;min-width:24px;min-height:24px" aria-label="Микс по треку"><svg class="vkuiIcon--music_note_wave_outline_24"></svg></button><button class="native-button" aria-label="Показать текст"><svg class="vkuiIcon--text_tt_outline_24"></svg></button></div>`;
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<style>
      .native-group{display:flex;gap:8px;align-items:center}.native-button{display:flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0}
      </style><header>${group}</header><main>${group}<div data-audio-id="1_2">${group}</div></main>` }));
    await page.goto('https://vk.ru/binaryghost');
    const buttons = page.locator('[data-vkify-eq-btn]');
    await expect(buttons).toHaveCount(2);
    await expect(page.locator('[data-audio-id] [data-vkify-eq-btn]')).toHaveCount(0);
    const panel = page.locator('[data-vkify-widget="equalizer"]');
    const headerButton = page.locator('header [data-vkify-eq-btn]');
    await expect(headerButton).toBeVisible();
    expect((await headerButton.boundingBox())!.width).toBe(24);
    await headerButton.click();
    await expect(panel).toBeVisible();
    await expect(panel.locator('input[type="range"]')).toHaveCount(11);
    await headerButton.click();
    await expect(panel).toBeHidden();
    await page.locator('header .native-group').evaluate(el => { el.querySelector('[data-vkify-eq-btn]')?.remove(); el.replaceWith(el.cloneNode(true)); });
    await expect(buttons).toHaveCount(2);
    await headerButton.click();
    await expect(panel).toBeVisible();
    await worker.evaluate(() => chrome.storage.local.set({ audio_equalizer: false }));
    await expect(buttons).toHaveCount(0);
    await expect(panel).toHaveCount(0);
    await worker.evaluate(() => chrome.storage.local.set({ audio_equalizer: true }));
    await expect(buttons).toHaveCount(2);
  } finally { await context.close(); }
});

import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('previews a shared VK theme locally, cancels, then saves only on confirmation', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    headless: true, channel: 'chromium', executablePath: process.env.PW_CHROME_PATH,
    args: ['--no-sandbox', '--disable-features=DisableLoadExtensionCommandLineSwitch',
      '--disable-extensions-except=' + extension, '--load-extension=' + extension],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ first_run: false, onboarding_done: true, language: 'en', custom_theme: '#111111' }));
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><div id="page_body">VK fixture</div></body></html>' }));
    const encoded = Buffer.from(JSON.stringify({ v: 2, p: { custom_theme: '#abcdef' } })).toString('base64url');
    const url = 'https://vk.ru/vkify?vkify_theme=' + encoded;
    const saved = () => worker.evaluate(async () => (await chrome.storage.local.get('custom_theme')).custom_theme);
    await page.goto('https://vk.ru/vkify');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('vkify:theme'))).toBeTruthy();
    const savedMirror = await page.evaluate(() => localStorage.getItem('vkify:theme'));
    await page.goto(url);
    const dialog = page.getByRole('dialog', { name: 'Theme preview' });
    await expect(dialog).toBeVisible();
    expect(await saved()).toBe('#111111');
    const previewColor = await page.evaluate(() => document.documentElement.style.getPropertyValue('--vkify-n00'));
    expect(previewColor).toBeTruthy();
    expect(await page.evaluate(() => localStorage.getItem('vkify:theme'))).toBe(savedMirror);
    await expect(page).toHaveURL('https://vk.ru/vkify');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--vkify-n00'))).not.toBe(previewColor);
    expect(await saved()).toBe('#111111');
    await page.goto(url);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Apply theme', exact: true }).click();
    await expect.poll(saved).toBe('#abcdef');
    await expect(dialog).toHaveCount(0);
    // VK changes routes without a document load.
    await page.evaluate(target => {
      history.pushState({}, '', target);
      document.title = 'New VK route';
    }, url);
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  } finally { await context.close(); }
});

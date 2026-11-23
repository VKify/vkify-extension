import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('filtered community recommendations leave no card or spacer and restore when content arrives', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done:true, first_run:false, block_recommendations_communities:true }));
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType:'text/html', body: `<html data-vkify-community-for-you-filtered><style>
      section{padding:8px;border:1px solid gray;border-radius:12px}.gap{height:16px}
      </style><main id="spa_layout_content"><section id="recent">Recently visited</section>
      <section id="subscriptions"><div role="tablist"><div role="tab">All communities</div></div><a href="/vkify">VKify</a></section>
      <div class="gap"></div><section id="empty"><span><div role="heading" aria-level="2"><span></span></div></span></section>
      <section id="unrelated"></section></main></html>` }));
    await page.goto('https://vk.ru/groups');
    await expect(page.locator('#empty')).toBeHidden();
    await expect(page.locator('.gap')).toBeHidden();
    await expect(page.locator('#recent')).toBeVisible();
    await expect(page.locator('#subscriptions')).toBeVisible();
    await expect(page.locator('#unrelated')).toBeVisible();
    await page.locator('#empty').evaluate(el => el.querySelector('[role="heading"]')!.textContent = 'Loaded content');
    await expect(page.locator('#empty')).toBeVisible();
    await expect(page.locator('.gap')).toBeVisible();
    await page.locator('#empty').evaluate(el => el.querySelector('[role="heading"]')!.textContent = '');
    await expect(page.locator('#empty')).toBeHidden();
    await worker.evaluate(() => chrome.storage.local.set({ block_recommendations_communities:false }));
    await expect(page.locator('#empty')).toBeVisible();
    await expect(page.locator('.gap')).toBeVisible();
  } finally { await context.close(); }
});

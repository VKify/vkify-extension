import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

for (const embedded of [false, true]) test('copies a portable theme from ' + (embedded ? 'the embedded settings' : 'the extension popup'), async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    headless: true, channel: 'chromium',
    args: ['--no-sandbox', '--disable-features=DisableLoadExtensionCommandLineSwitch',
      '--disable-extensions-except=' + extension, '--load-extension=' + extension],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const base = worker.url().replace(/\/[^/]*$/, '');
    const page = await context.newPage();
    await page.goto(base + '/index.html');
    await page.evaluate(async () => {
      await chrome.storage.local.set({ onboarding_done: true, first_run: false, language: 'en',
        custom_theme: '#0A0E14', custom_accent: '#FFB454',
        custom_background: 'data:image/png;base64,' + 'A'.repeat(200_000) });
    });
    if (embedded) {
      await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html',
        body: '<html><body><iframe style="width:1000px;height:1200px" allow="clipboard-write" src="' + base + '/index.html?embed=1"></iframe></body></html>' }));
      await page.goto('https://vk.ru/clipboard-fixture');
    } else await page.reload();
    const app = embedded ? page.frameLocator('iframe').first() : page;
    await expect(app.locator('#root.ready')).toBeVisible();
    await app.getByText('A link with your appearance for a friend', { exact: true }).click();
    await expect(app.getByText('Uploaded backgrounds are not shared. Use an image URL to include the background.', { exact: true })).toBeVisible();
    await app.locator('[data-vkify-anchor="share_theme"]').getByRole('button', { name: 'Share theme', exact: true }).click();
    await expect(app.getByText('Link copied without the uploaded background', { exact: true })).toBeVisible();
    // Read permission is granted only after copying, so it cannot mask a missing write permission.
    const reader = await context.newPage();
    await reader.route('https://clipboard.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Clipboard reader</body></html>' }));
    await context.grantPermissions(['clipboard-read'], { origin: 'https://clipboard.test' });
    await reader.goto('https://clipboard.test');
    const copied = await reader.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/^https:\/\/vkify\.ru\/theme\//);
    const encoded = copied.split('/theme/')[1];
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    expect(payload.v).toBe(2);
    expect(JSON.stringify(payload)).toContain('#FFB454');
    expect(payload.p).not.toHaveProperty('cb');
    expect(new URL(copied).pathname.length).toBeLessThan(128 * 1024);
  } finally { await context.close(); }
});

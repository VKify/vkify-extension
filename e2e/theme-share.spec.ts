import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

for (const embedded of [false, true]) test('copies a portable theme from ' + (embedded ? 'the embedded settings' : 'the extension popup'), async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    headless: true, channel: 'chromium', executablePath: process.env.PW_CHROME_PATH,
    args: ['--no-sandbox', '--disable-features=DisableLoadExtensionCommandLineSwitch',
      '--disable-extensions-except=' + extension, '--load-extension=' + extension],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const base = worker.url().replace(/\/[^/]*$/, '');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ onboarding_done: true, first_run: false, language: 'en',
        custom_theme: '#0A0E14', custom_accent: '#FFB454',
        custom_background: 'data:image/png;base64,' + 'A'.repeat(200_000) });
    });
    const page = await context.newPage();
    page.on('console', message => { if (message.type() === 'error' && message.text().includes('Share error')) console.log(message.text()); });
    if (embedded) {
      await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html',
        body: '<html><body><iframe style="width:1000px;height:1200px" allow="clipboard-write" src="' + base + '/index.html?embed=1"></iframe></body></html>' }));
      await page.goto('https://vk.ru/clipboard-fixture');
    } else await page.goto(base + '/index.html');
    const app = embedded ? page.frameLocator('iframe').first() : page;
    await expect(app.locator('#root.ready')).toBeVisible();
    await app.getByRole('button', { name: /^Share theme A link with your appearance for a friend/ }).click();
    await expect(app.getByText('Uploaded backgrounds are not shared. Use an image URL to include the background.', { exact: true })).toBeVisible();
    await page.bringToFront();
    const share = app.locator('[data-vkify-anchor="share_theme"]').getByRole('button', { name: 'Share theme', exact: true });
    await share.focus();
    await expect.poll(() => share.evaluate(el => el.ownerDocument.hasFocus())).toBe(true);
    // Record the transient toast so slow full-suite runs cannot miss its timeout.
    await share.evaluate(el => {
      const doc = el.ownerDocument;
      (doc.defaultView as any).shareCopyObserved = false;
      const observer = new MutationObserver(() => {
        if (doc.body.textContent?.includes('Link copied without the uploaded background')) {
          (doc.defaultView as any).shareCopyObserved = true;
          observer.disconnect();
        }
      });
      observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    });
    await share.click();
    await expect.poll(() => app.locator('[data-vkify-anchor="share_theme"]').evaluate(el =>
      (el.ownerDocument.defaultView as any).shareCopyObserved)).toBe(true);
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

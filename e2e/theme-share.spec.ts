import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

for (const mode of ['popup', 'embed', 'fallback'] as const) test('shares a theme through vk.cc: ' + mode, async () => {
  const embedded = mode !== 'popup';
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
    await context.addInitScript(({ fail }) => {
      if (location.protocol !== 'chrome-extension:') return;
      const original = chrome.runtime.sendMessage.bind(chrome.runtime);
      (window as any).shortenerCalls = [];
      (window as any).shortenerFail = fail;
      chrome.runtime.sendMessage = ((message: any) => {
        if (message.type === 'VK_API_CALL' && message.method === 'utils.getShortLink') {
          (window as any).shortenerCalls.push(message);
          return new Promise(resolve => setTimeout(() => resolve((window as any).shortenerFail
            ? { success: false, error: 'fixture API unavailable' }
            : { success: true, data: { short_url: 'https://vk.cc/VkifyTest' } }), 120));
        }
        return original(message);
      }) as typeof chrome.runtime.sendMessage;
    }, { fail: mode === 'fallback' });
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
    const dialog = app.getByRole('dialog', { name: 'Share theme', exact: true });
    const link = dialog.getByRole('textbox', { name: 'Theme link', exact: true });
    if (mode === 'fallback') {
      await expect(dialog.getByRole('alert')).toContainText('Could not shorten');
      await expect(link).toHaveValue(/^https:\/\/vkify\.ru\/theme\//);
      await dialog.locator(':scope > div').screenshot({ path: 'test-results/theme-share-' + mode + '.png' });
      await dialog.getByRole('button', { name: 'Copy original link', exact: true }).click();
    } else {
      await expect(link).toHaveValue('https://vk.cc/VkifyTest');
      await dialog.locator(':scope > div').screenshot({ path: 'test-results/theme-share-' + mode + '.png' });
      await dialog.getByRole('button', { name: 'Copy link', exact: true }).click();
    }
    await expect.poll(() => app.locator('[data-vkify-anchor="share_theme"]').evaluate(el =>
      (el.ownerDocument.defaultView as any).shareCopyObserved)).toBe(true);
    await expect(dialog).toHaveCount(0);
    // Read permission is granted only after copying, so it cannot mask a missing write permission.
    const reader = await context.newPage();
    await reader.route('https://clipboard.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Clipboard reader</body></html>' }));
    await context.grantPermissions(['clipboard-read'], { origin: 'https://clipboard.test' });
    await reader.goto('https://clipboard.test');
    const copied = await reader.evaluate(() => navigator.clipboard.readText());
    const calls = await app.locator('[data-vkify-anchor="share_theme"]').evaluate(el => (el.ownerDocument.defaultView as any).shortenerCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0].params.private).toBe(1);
    if (mode === 'fallback') expect(copied).toBe(calls[0].params.url);
    else expect(copied).toBe('https://vk.cc/VkifyTest');
    const encoded = calls[0].params.url.split('/theme/')[1];
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    expect(payload.v).toBe(2);
    expect(JSON.stringify(payload)).toContain('#FFB454');
    expect(payload.p).not.toHaveProperty('cb');
    expect(new URL(calls[0].params.url).pathname.length).toBeLessThan(128 * 1024);
    await page.bringToFront();
    await share.click();
    if (mode === 'fallback') {
      await expect(dialog.getByRole('alert')).toBeVisible();
      await app.locator('[data-vkify-anchor="share_theme"]').evaluate(el => { (el.ownerDocument.defaultView as any).shortenerFail = false; });
      await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(link).toHaveValue('https://vk.cc/VkifyTest');
      expect(await app.locator('[data-vkify-anchor="share_theme"]').evaluate(el => (el.ownerDocument.defaultView as any).shortenerCalls.length)).toBe(3);
    } else {
      await expect(link).toHaveValue('https://vk.cc/VkifyTest');
      expect(await app.locator('[data-vkify-anchor="share_theme"]').evaluate(el => (el.ownerDocument.defaultView as any).shortenerCalls.length)).toBe(1);
    }
    const shortening = dialog.getByRole('switch', { name: 'Shorten link', exact: true });
    await expect(shortening).toBeChecked();
    await shortening.click();
    await expect(link).toHaveValue(/^https:\/\/vkify\.ru\/theme\//);
    const countBeforeSwitch = await app.locator('[data-vkify-anchor="share_theme"]').evaluate(el => (el.ownerDocument.defaultView as any).shortenerCalls.length);
    await dialog.getByRole('combobox', { name: 'Share link via' }).selectOption('vk');
    await expect(link).toHaveValue(/^https:\/\/vk\.ru\/vkify\?vkify_theme=/);
    expect(await app.locator('[data-vkify-anchor="share_theme"]').evaluate(el => (el.ownerDocument.defaultView as any).shortenerCalls.length)).toBe(countBeforeSwitch);
    await shortening.click();
    await expect(link).toHaveValue('https://vk.cc/VkifyTest');
    const latestCall = await app.locator('[data-vkify-anchor="share_theme"]').evaluate(el => (el.ownerDocument.defaultView as any).shortenerCalls.at(-1));
    expect(latestCall.params.url).toMatch(/^https:\/\/vk\.ru\/vkify\?vkify_theme=/);
    await shortening.click();
    await expect(link).toHaveValue(latestCall.params.url);
  } finally { await context.close(); }
});

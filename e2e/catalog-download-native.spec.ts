import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Exercise real extension host permissions; the CDN deliberately sends no CORS headers.
for (const hosts of [['video.vkuser.net', 'video.vkuser.net'], ['vkvd578.okcdn.ru', 'vkvd450.okcdn.ru']]) {
test(`video ZIP uses real permissions and session cookies on ${hosts.join(', ')}`, async ({}, info) => {
  const extension = resolve('dist/chrome');
  // Windows may only have Playwright's headless shell; it cannot load extensions.
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = process.env.PW_CHROME_PATH || (process.platform === 'win32' && existsSync(edge) ? edge : undefined);
  const context = await chromium.launchPersistentContext('', {
    headless: true, channel: 'chromium', executablePath,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const page = await context.newPage(), origin = new URL(worker.url()).host;
    await page.goto(`chrome-extension://${origin}/index.html`);
    await page.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: false, language: 'en' }));
    const cookies: string[] = [];
    await context.addCookies([...new Set(hosts)].map(domain => ({ name: 'zip_fixture', value: 'session', domain, path: '/', secure: true, sameSite: 'None' as const })));
    await page.route(url => hosts.includes(url.hostname), route => {
      cookies.push(route.request().headers()['cookie'] || '');
      return route.fulfill({ contentType: 'video/mp4', body: `MP4:${new URL(route.request().url()).pathname}` });
    });
    await page.addInitScript(cdnHosts => {
      const original = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = (async (message: any) => {
        if (message.type === 'GET_VK_TOKEN') return { token: 'fixture', userId: '123', status: 'valid' };
        if (message.type === 'VK_API_CALL') {
          if (message.method === 'users.get') return { success: true, data: [{ id: 123, first_name: 'Fixture' }] };
          if (message.method === 'video.getAlbums') return { success: true, data: { count: 0, items: [] } };
          if (message.method === 'video.get') {
            if (message.params.videos) {
              const id = Number(String(message.params.videos).split('_')[1]);
              return { success: true, data: { items: [{ files: { mp4_1080: `https://${cdnHosts[id - 1]}/${message.params.videos}.mp4` } }] } };
            }
            return { success: true, data: { count: 2, items: [1, 2].map(id => ({ owner_id: 123, id, title: `Video ${id}`, duration: 65 })) } };
          }
        }
        return original(message);
      }) as typeof chrome.runtime.sendMessage;
    }, hosts);
    await page.reload();
    for (const host of hosts) expect(await page.evaluate(domain => chrome.permissions.contains({ origins: [`https://${domain}/*`] }), host)).toBe(true);
    await page.getByRole('button', { name: 'Center', exact: true }).click();
    await page.getByRole('button', { name: /^Video Tools/ }).click();
    await page.getByRole('button', { name: /Saved video catalog/ }).click();
    await page.getByRole('button', { name: 'Load video library', exact: true }).click();
    await page.getByRole('button', { name: 'Select all · 2', exact: true }).click();
    await page.locator('.ct-catalog-download').screenshot({ path: info.outputPath('video-download-options-light.png') });
    await page.setViewportSize({ width: 400, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.locator('.ct-catalog-download').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.locator('.ct-catalog-download').screenshot({ path: info.outputPath('video-download-options-dark-narrow.png') });
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download ZIP · 2', exact: true }).click();
    const download = await downloading, bytes = await readFile((await download.path())!);
    expect(bytes.includes(Buffer.from('MP4:/123_1.mp4'))).toBe(true);
    expect(bytes.includes(Buffer.from('MP4:/123_2.mp4'))).toBe(true);
    expect(cookies).toHaveLength(2);
    expect(cookies.every(cookie => cookie.includes('zip_fixture=session'))).toBe(true);
    await expect(page.locator('.ct-catalog-download')).toContainText('Files in ZIP: 2');
    await page.locator('.ct-catalog-download').screenshot({ path: info.outputPath('native-video-zip.png') });
  } finally { await context.close(); }
});
}

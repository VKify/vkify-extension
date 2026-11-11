import { test, expect, chromium, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';


/** Runs compiled UI against fixtures; it never sends writes to a real VK account. */
async function mount(page: Page, target: 'chrome' | 'firefox') {
  await page.route('http://vkify.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    try {
      const body = await readFile(resolve('dist', target, path === '/' ? 'index.html' : path.slice(1)));
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
      await route.fulfill({ body, contentType: types[extname(path)] ?? (path === '/' ? 'text/html' : 'application/octet-stream') });
    } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  await page.addInitScript(() => {
    const event = { addListener() {}, removeListener() {} };
    const data: Record<string, unknown> = { language: 'en', onboarding_done: true, first_run: false };
    (window as any).chrome = {
      storage: { local: { get: async () => ({ ...data }), set: async (values: object) => Object.assign(data, values) }, sync: { set: async () => {} }, onChanged: event },
      permissions: { contains: async () => true, onAdded: event, onRemoved: event },
      runtime: { id: 'fixture', onMessage: event, getURL: (path: string) => 'http://vkify.test/' + path,
        getManifest: () => ({ version: '2.0.0' }), sendMessage: async (message: any) => {
          if (message.type === 'PING') return { pong: true, hasVKHostPermission: true };
          if (message.type === 'GET_VK_TOKEN') return { token: '', status: 'missing' };
          return { success: true };
        } },
    };
  });
  await page.goto('http://vkify.test/?embed=1');
  await expect(page.locator('#root.ready')).toBeVisible();
  await page.getByRole('button', { name: 'Center', exact: true }).click();
}


test('photo search settings use themed controls and save provider selection', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 540, height: 1050 } });
  try {
    await mount(page, 'chrome');
    await page.getByRole('button', { name: /^Photos / }).click();
    await expect(page.locator('.photo-search-settings')).toHaveCount(0);
    await page.getByRole('button', { name: /Search by image/ }).click();
    const panel = page.locator('.photo-search-settings');
    await expect(panel).toBeVisible();
    await expect(page.getByText('Keyboard shortcut Ctrl/Cmd + Shift + F', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Search button on image hover', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Open in background', { exact: true })).toHaveCount(0);
    const rows = panel.locator('.photo-search-settings__provider label');
    const initialOrder = await rows.allTextContents();
    // Toggling a provider must leave every row in place, including disabled ones.
    await panel.getByLabel('Yandex', { exact: true }).uncheck();
    await expect(rows).toHaveText(initialOrder);
    await panel.getByLabel('Yandex', { exact: true }).check();
    await panel.getByLabel('IQDB', { exact: true }).check();
    await expect(rows).toHaveText(initialOrder);
    await panel.getByLabel('IQDB', { exact: true }).uncheck();
    await expect(rows).toHaveText(initialOrder);
    await panel.getByLabel('Bing', { exact: true }).check();
    await expect(panel.getByLabel('Bing', { exact: true })).toBeChecked();
    await panel.getByRole('button', { name: 'Button below photo: Bing', exact: true }).click();
    await panel.getByRole('button', { name: 'Button below photo: Yandex', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Button below photo: Bing', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('button', { name: 'Button below photo: Yandex', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.locator('.photo-search-settings__provider')).toHaveCount(8);
    await expect(panel.getByText('Bing', { exact: true })).toHaveCount(1);
    await panel.getByRole('button', { name: 'Default search engine: Bing', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Default search engine: Bing', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('button', { name: 'Default search engine: Google Lens', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(rows).toHaveText(initialOrder);
    const up = panel.getByRole('button', { name: 'Move up: Bing', exact: true });
    await up.click();
    const reordered = [...initialOrder];
    const bingIndex = reordered.indexOf('Bing');
    const wildberriesIndex = reordered.indexOf('Wildberries');
    [reordered[bingIndex], reordered[wildberriesIndex]] = [reordered[wildberriesIndex], reordered[bingIndex]];
    await expect(rows).toHaveText(reordered);
    await panel.getByLabel('Bing', { exact: true }).uncheck();
    await expect(rows).toHaveText(reordered);
    await panel.getByLabel('Bing', { exact: true }).check();
    await expect(rows).toHaveText(reordered);
    await panel.screenshot({ path: info.outputPath('photo-search-settings.png') });
  } finally { await browser.close(); }
});

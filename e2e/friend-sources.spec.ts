import { chromium, expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { resolve, extname } from 'node:path';
import { readFile } from 'node:fs/promises';

let browser: Browser, context: BrowserContext;
test.beforeAll(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH || undefined });
  context = await browser.newContext();
  await context.route('http://vkify.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    try {
      const body = await readFile(resolve('dist/chrome', path === '/' ? 'index.html' : path.slice(1)));
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
      await route.fulfill({ body, contentType: path === '/' ? 'text/html' : types[extname(path)] ?? 'application/octet-stream' });
    } catch { await route.fulfill({ status: 404, body: '' }); }
  });
});
test.afterAll(async () => { await browser?.close(); });

async function pageWithFixtures(progress = false) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 900, height: 950 });
  await page.addInitScript(({ progress }) => {
    const listeners: ((changes: unknown, area: string) => void)[] = [];
    const event = { addListener() {}, removeListener() {} };
    const data: Record<string, unknown> = { language: 'en', onboarding_done: true, first_run: false, vk_user_id: '1' };
    const storage = {
      async get() { return { ...data }; },
      async set(values: Record<string, unknown>) {
        const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { oldValue: data[key], newValue: value }]));
        Object.assign(data, values); listeners.forEach(listener => listener(changes, 'local'));
      },
      async remove() {}, async clear() {},
    };
    const runtime = { id: 'fixture', getManifest: () => ({ version: '1.8.6' }), getURL: (path: string) => 'http://vkify.test/' + path, onMessage: event };
    Object.assign(window, { chrome: {
      storage: { local: storage, sync: storage, onChanged: { addListener: (fn: (changes: unknown, area: string) => void) => listeners.push(fn), removeListener: (fn: unknown) => { const index = listeners.indexOf(fn as never); if (index >= 0) listeners.splice(index, 1); } } },
      runtime, permissions: { contains: async () => true, onAdded: event, onRemoved: event },
      tabs: { onCreated: event, onRemoved: event, onUpdated: event }, i18n: { getUILanguage: () => 'en' },
    } });
    const win = window as unknown as { requests: Record<string, unknown>[] };
    win.requests = [];
    chrome.runtime.sendMessage = (async (message: { type: string; reference?: string; limit?: number }) => {
      if (message.type === 'GET_VK_TOKEN') return { token: 'fixture', userId: '1', status: 'valid' };
      if (message.type === 'VK_API_CALL') return { success: true, data: [{ id: 1, first_name: 'Fixture' }] };
      if (message.type === 'LIST_PARSER_GROUPS') return { success: true, userId: '1', total: 1, groups: [{ id: 100, name: 'My community', photo_100: 'https://avatar.test/community.svg' }] };
      if (message.type === 'START_GROUP_PARSER') {
        win.requests.push(message);
        if (progress) {
          // Deliberately omit storage events to verify the live-state fallback.
          data.group_parser_state = { status: 'running', phase: 'loading', inFlight: true, userId: '1', ids: [], limit: 2000, group: { id: 100, name: 'My community' } };
          setTimeout(() => { data.group_parser_state = { status: 'running', phase: 'waiting', nextAt: Date.now() + 30000, userId: '1', ids: [2], total: 2, limit: 2000, group: { id: 100, name: 'My community' } }; }, 1400);
          setTimeout(() => { data.group_parser_state = { status: 'completed', userId: '1', ids: [2, 3], total: 2, limit: 2000, group: { id: 100, name: 'My community' } }; }, 4500);
          return { success: true };
        }
        await chrome.storage.local.set({ group_parser_state: { status: 'limit', userId: '1', ids: [2, 3], total: 50, limit: 2, group: { id: 100, name: 'My community' } } });
        return { success: true };
      }
      if (message.type === 'START_AUTO_ADD_FRIENDS') { win.requests.push(message); return { success: true }; }
      if (message.type === 'PING') return { pong: true, hasVKHostPermission: true };
      if (message.type === 'QUERY_VK_TABS') return { count: 1 };
      if (message.type === 'GET_API_METHOD') return { hasVKTab: true, nativeApiAvailable: true };
      return { success: true };
    }) as typeof chrome.runtime.sendMessage;
  }, { progress });
  await page.route('https://avatar.test/community.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#5181b8"/></svg>' }));
  await page.goto('http://vkify.test/?embed=1');
  await expect(page.locator('#root.ready')).toBeVisible();
  await page.getByRole('button', { name: 'Center', exact: true }).click();
  return page;
}

test('file import and native shared checkbox gate an API run with the selected IDs', async () => {
  const page = await pageWithFixtures();
  await page.getByRole('button', { name: /^Friends / }).click();
  await page.getByRole('button', { name: /Auto add friends/ }).click();
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('list');
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(start).toBeDisabled();
  await page.getByLabel('Upload TXT, CSV or JSON').setInputFiles({ name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from('id,name\n2,Alice\n3,Bob\n2,Alice') });
  await expect(page.getByText('2 people', { exact: true })).toBeVisible();
  const checkbox = page.getByRole('checkbox', { name: /I understand the risk/ });
  await expect(checkbox).toHaveClass(/vkify-checkbox/);
  await expect(checkbox).toHaveCSS('appearance', 'none');
  await checkbox.check(); await expect(start).toBeEnabled();
  await start.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { requests: { source?: { ids: number[] } }[] }).requests[0]?.source?.ids)).toEqual([2, 3]);
  await page.getByLabel('Upload TXT, CSV or JSON').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('2\nnot-a-user') });
  await expect(page.getByRole('alert').filter({ hasText: 'Use IDs' })).toContainText('Use IDs'); await expect(start).toBeDisabled();
  await page.screenshot({ path: 'test-results/auto-add-friends-list.png', fullPage: true });
  await page.close();
});

test('parser offers own communities or a link, exports partial IDs and shares them with friends', async () => {
  const page = await pageWithFixtures();
  await page.getByRole('button', { name: /^Communities / }).click();
  await page.getByRole('button', { name: /Member parser/ }).click();
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.getByRole('button', { name: 'Community', exact: true }).click();
  const option = page.getByRole('option', { name: 'My community' });
  await expect(option.locator('img')).toBeVisible();
  await option.click();
  await page.getByRole('button', { name: 'Collect', exact: true }).click();
  await expect(page.getByText('Limit reached · partial list', { exact: false })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'TXT', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('vkify-members-100.txt');
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('link');
  await page.getByRole('textbox', { name: 'Community', exact: true }).fill('https://vk.ru/club100');
  await page.getByRole('button', { name: 'Collect', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { requests: { reference?: string }[] }).requests.slice(-1)[0]?.reference)).toBe('https://vk.ru/club100');
  await page.screenshot({ path: 'test-results/community-parser.png', fullPage: true });
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  const friends = page;
  await friends.getByRole('button', { name: /^Friends / }).click();
  await friends.getByRole('button', { name: /Auto add friends/ }).click();
  await friends.getByRole('combobox', { name: 'Source', exact: true }).selectOption('community');
  await expect(friends.getByText('2 people', { exact: true })).toBeVisible();
  await friends.getByRole('checkbox', { name: /I understand the risk/ }).check();
  await friends.getByRole('button', { name: 'Start', exact: true }).click();
  await expect.poll(() => friends.evaluate(() => (window as unknown as { requests: { source?: { ids: number[]; ownerId: string } }[] }).requests.slice(-1)[0]?.source)).toMatchObject({ ids: [2, 3], ownerId: '1' });
  await friends.close();
});

 test('parser updates the current page, saved count and countdown before completion without storage events', async () => {
  const page = await pageWithFixtures(true);
  await page.getByRole('button', { name: /^Communities / }).click();
  await page.getByRole('button', { name: /Member parser/ }).click();
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.getByRole('button', { name: 'Collect', exact: true }).click();
  await expect(page.getByText('Loading page 1…')).toBeVisible();
  await expect(page.locator('.parser-progress strong')).toHaveText('1 / 2');
  await expect(page.getByText(/Next page in \d+ s/)).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/community-parser-progress.png', fullPage: true });
  await expect(page.getByText('Complete', { exact: true })).toBeVisible();
  await expect(page.locator('.parser-progress strong')).toHaveText('2 / 2');
  await page.getByText('Limits', { exact: true }).click();
  await expect(page.locator('.info-disclosure')).toHaveAttribute('open', '');
  await expect(page.locator('.info-disclosure__icon svg')).toBeVisible();
  await page.close();
});

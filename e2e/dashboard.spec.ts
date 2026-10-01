import { test, expect, chromium, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

async function mountDashboard(page: Page, browser: 'chrome' | 'firefox'): Promise<void> {
  await page.route('http://vkify.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const relative = path === '/' ? 'index.html' : path.slice(1);
    try {
      const body = await readFile(resolve('dist', browser, relative));
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
      await route.fulfill({ body, contentType: types[extname(relative)] ?? 'application/octet-stream' });
    } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  await page.addInitScript(() => {
    const events = new Set<(changes: Record<string, unknown>, area: string) => void>();
    const noopEvent = { addListener() {}, removeListener() {} };
    const photo = 'http://vkify.test/icons/icon48.png';
    const data: Record<string, any> = { language: 'en', onboarding_done: true, first_run: false, dashboard_hero_enabled: true, vkify_notes: [
      { id: 'saved', text: 'Saved author photo', author: 'Alice', authorPhoto: photo, peerId: 42, peerTitle: 'Notes fixture', cmid: 1, addedAt: Date.now() },
      { id: 'old', text: 'Recover older avatar', author: 'Alice', peerId: 42, peerTitle: 'Notes fixture', cmid: 2, addedAt: Date.now() - 1000 },
      { id: 'broken', text: 'Broken photo fallback', author: 'Offline', authorPhoto: 'http://vkify.test/missing.png', peerTitle: 'Offline fixture', addedAt: Date.now() - 2000 },
    ] };
    const write = async (items: Record<string, unknown>) => {
      const changes = Object.fromEntries(Object.entries(items).map(([key, value]) => [key, { oldValue: data[key], newValue: value }]));
      Object.assign(data, items);
      for (const callback of events) callback(changes, 'local');
    };
    (window as any).fixture = { data, opened: [], failMutation: false, failUpdate: false };
    (window as any).chrome = {
      storage: {
        local: { get: async () => ({ ...data }), set: write, remove: async () => {}, clear: async () => {} },
        sync: { set: async () => {} },
        onChanged: { addListener: (fn: any) => events.add(fn), removeListener: (fn: any) => events.delete(fn) },
      },
      permissions: { contains: async () => true, onAdded: noopEvent, onRemoved: noopEvent },
      runtime: {
        id: 'fixture', getURL: (path: string) => 'http://vkify.test/' + path.replace(/^\//, ''),
        getManifest: () => ({ version: '1.8.6' }), onMessage: noopEvent,
        sendMessage: async (message: Record<string, any>) => {
          if (message.type === 'PING') return { pong: true, hasVKHostPermission: true };
          if (message.type === 'GET_VK_TOKEN') return { token: 'fixture', userId: '123', status: 'valid' };
          if (message.type === 'QUERY_VK_TABS') return { count: 1 };
          if (message.type === 'GET_API_METHOD') return { hasVKTab: true, nativeApiAvailable: true };
          if (message.type === 'CHECK_EXTENSION_UPDATE') return (window as any).fixture.failUpdate ? { success: false } : {
            success: true, update: { currentVersion: '1.8.6', latestVersion: '1.9.0', available: true, checkedAt: Date.now() },
          };
          if (message.type === 'OPEN_TAB') { (window as any).fixture.opened.push(message.url); return { success: true }; }
          if (message.type === 'VK_API_CALL') return { success: true, data: message.method === 'messages.getByConversationMessageId'
            ? { items: [{ conversation_message_id: 2, from_id: 42 }] }
            : [{ id: 42, first_name: 'Alice', photo_50: photo, photo_100: photo }] };
          if (message.type === 'MUTATE_NOTES') {
            if ((window as any).fixture.failMutation) return { success: false, error: 'Storage failed' };
            await write({ vkify_notes: message.action === 'clear' ? [] : data.vkify_notes.filter((note: any) => note.id !== message.id) });
            return { success: true, notes: data.vkify_notes };
          }
          return { success: true };
        },
      },
    };
  });
  await page.goto('http://vkify.test/?embed=1');
  await expect(page.locator('#root.ready')).toBeVisible();
}

test('appearance profiles save new settings, restore them and report failed writes', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
  try {
    await mountDashboard(page, 'chrome');
    await page.evaluate(async () => {
      await (window as any).chrome.storage.local.set({ clock_enabled: true, clock_settings: '{}',
        music_visualizer: true, music_lyrics: true, web_wallpaper_id: 'aurora',
        web_wallpaper_values: '{"aurora":{"speed":2}}', hide_feed_right_column: true,
        hidden_menu_items: ['l_aud'], custom_css: '.page { color:red; }', custom_css_enabled: true,
        telegram_bot_token: 'secret', prevent_read: true });
    });
    await page.getByRole('button', { name: 'Style', exact: true }).click();
    await page.getByRole('button', { name: /My profiles Saved appearances/ }).click();
    await page.getByPlaceholder('Profile name').fill('Complete profile');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Complete profile', { exact: true })).toBeVisible();
    const snapshot = await page.evaluate(() => (window as any).fixture.data.appearance_profiles[0].settings);
    expect(snapshot).toMatchObject({ clock_enabled: true, music_visualizer: true, music_lyrics: true,
      hide_feed_right_column: true, hidden_menu_items: ['l_aud'], custom_css_enabled: true,
      web_wallpaper_values: '{"aurora":{"speed":2}}' });
    expect(snapshot).not.toHaveProperty('telegram_bot_token');
    expect(snapshot).not.toHaveProperty('prevent_read');
    await page.evaluate(async () => (window as any).chrome.storage.local.set({ clock_enabled: false, music_visualizer: false, hidden_menu_items: [], custom_css: '' }));
    await page.getByRole('button', { name: 'Apply profile', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.clock_enabled)).toBe(true);
    await page.evaluate(() => {
      const storage = (window as any).chrome.storage.local;
      const original = storage.set;
      storage.set = async (items: Record<string, unknown>) => {
        if ('appearance_profiles' in items) throw new Error('Storage failed');
        return original(items);
      };
    });
    await page.getByPlaceholder('Profile name').fill('Failed profile');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Could not save the profile changes. Please try again.')).toBeVisible();
    await expect(page.getByText('Failed profile', { exact: true })).toHaveCount(0);
  } finally { await browser.close(); }
});

test('built Notes dashboard renders avatars, recovers old photos, searches and handles storage errors', async ({}, testInfo) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await mountDashboard(page, 'chrome');
    await page.getByRole('button', { name: 'Notes', exact: true }).click();
    await page.getByRole('button', { name: /Notes fixture/ }).click();
    const cards = page.locator('[data-vkify-anchor="notes_view"] article');
    await expect(cards.locator('img')).toHaveCount(2);
    await expect.poll(() => cards.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('notes.png'), fullPage: true });
    await page.evaluate(() => { (window as any).fixture.failMutation = true; });
    await cards.first().getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(cards).toHaveCount(2);
    await expect(page.getByText('Could not save changes. Please try again.')).toBeVisible();
    await page.evaluate(() => { (window as any).fixture.failMutation = false; });
    await page.getByRole('searchbox').fill('Recover older');
    await expect(cards).toHaveCount(1);
    await cards.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(cards).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await page.getByRole('searchbox').fill('Broken photo');
    await expect(cards.getByRole('img', { name: 'Offline' })).toBeVisible();
    await expect(cards.locator('img')).toHaveCount(0);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({ path: testInfo.outputPath('notes-narrow.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});

test('built Firefox More dashboard offers an update through the official installation page', async ({}, testInfo) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
  try {
    await mountDashboard(page, 'firefox');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Settings and tools' })).toBeVisible();
    await expect(page.getByText('Version 1.9.0 is available')).toBeVisible();
    await page.getByRole('button', { name: 'Install update', exact: true }).click();
    expect(await page.evaluate(() => (window as any).fixture.opened)).toEqual(['https://vkify.ru/firefox']);
    await page.screenshot({ path: testInfo.outputPath('more-firefox.png'), fullPage: true });
    await page.evaluate(() => { (window as any).fixture.failUpdate = true; });
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await expect(page.getByText('Could not check for updates. Please try again later.')).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({ path: testInfo.outputPath('more-narrow.png'), fullPage: true });
    await page.locator('.dashboard-nav-item').getByRole('button', { name: /Language/ }).click();
    await expect(page.getByRole('heading', { name: /Language/ }).first()).toBeVisible();
  } finally { await browser.close(); }
});

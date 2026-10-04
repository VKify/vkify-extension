import { test, expect, chromium, type Locator } from '@playwright/test';
import { resolve, extname } from 'node:path';
import { readFile } from 'node:fs/promises';

const fieldStyle = (field: Locator) => field.evaluate(element => {
  const style = getComputedStyle(element);
  return { background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius,
    fontSize: style.fontSize, height: style.height, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom };
});

test('wallpaper galleries load playlists and photos, paginate and apply inside the extension', async ({}, testInfo) => {
  test.setTimeout(60000);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  const context = await browser.newContext();
  try {
    const ui = await context.newPage();
    const originalPhoto = await ui.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 4096; canvas.height = 2304;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#127abc'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff'; ctx.fillRect(100, 100, 1, 1);
      return canvas.toDataURL('image/png');
    });
    await ui.setViewportSize({ width: 680, height: 850 });
    await ui.route('http://vkify.test/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      const path = pathname === '/' ? 'index.html' : pathname.slice(1);
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
      try { await route.fulfill({ body: await readFile(resolve('dist/chrome', path)), contentType: types[extname(path)] ?? 'application/octet-stream' }); }
      catch { await route.fulfill({ status: 404 }); }
    });
    await ui.route('https://wallpapers.test/**', route => route.request().url().endsWith('original.png')
      ? route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: Buffer.from(originalPhoto.split(',')[1], 'base64') })
      : route.fulfill({ contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' },
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#1c3c71"/><stop offset="1" stop-color="#15c9b5"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><circle cx="750" cy="160" r="90" fill="#f4dd9a"/><path d="M0 450L280 170L600 450L800 280L960 470V540H0" fill="#162b46"/></svg>' }));
    await ui.addInitScript(() => {
      const data: Record<string, unknown> = { onboarding_done: true, first_run: false, language: 'en' };
      const events = new Set<(changes: Record<string, unknown>, area: string) => void>();
      const noopEvent = { addListener() {}, removeListener() {} };
      (window as any).chrome = {
        storage: { local: {
          get: async () => ({ ...data }),
          set: async (patch: Record<string, unknown>) => {
            const changes = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, { oldValue: data[key], newValue: value }]));
            Object.assign(data, patch); events.forEach(callback => callback(changes, 'local'));
          }, remove: async () => {},
        }, sync: { set: async () => {} }, onChanged: { addListener: (callback: any) => events.add(callback), removeListener: (callback: any) => events.delete(callback) } },
        permissions: { contains: async () => true, onAdded: noopEvent, onRemoved: noopEvent },
        runtime: { id: 'fixture', getURL: (path: string) => 'http://vkify.test/' + path.replace(/^\//, ''), getManifest: () => ({ version: '2.0.0' }), onMessage: noopEvent,
          sendMessage: async (message: { type: string }) => {
            if (message.type === 'PING') return { pong: true, hasVKHostPermission: true };
            if (message.type === 'QUERY_VK_TABS') return { count: 1 };
            if (message.type === 'GET_API_METHOD') return { hasVKTab: true, nativeApiAvailable: true };
            return { success: true };
          },
        },
      };
    });
    await ui.addInitScript(() => {
      const original = chrome.runtime.sendMessage.bind(chrome.runtime);
      const poster = 'https://wallpapers.test/preview.svg';
      const video = (id: number, title: string, date: number) => ({ owner_id: -777, id, title, date, image: [{ width: 960, url: poster }],
        player: `https://vkvideo.ru/video_ext.php?oid=-777&id=${id}&hash=fixture` });
      const photo = (id: number, text: string, date: number) => ({ owner_id: -235511300, id, text, date, sizes: [
        { width: 960, height: 540, url: poster }, { width: 4096, height: 2304, url: 'https://wallpapers.test/original.png' },
      ] });
      chrome.runtime.sendMessage = ((message: { type: string; method?: string; params?: Record<string, unknown> }) => {
        if (message.type === 'GET_VK_TOKEN') return Promise.resolve({ token: 'fixture', userId: '123', status: 'valid' });
        if (message.type !== 'VK_API_CALL') return original(message);
        const params = message.params ?? {};
        let data: unknown = [];
        if (message.method === 'utils.resolveScreenName') data = { type: 'group', object_id: 777 };
        if (message.method === 'video.getAlbums') data = { count: 2, items: [{ id: 9, title: 'Nature', count: 1 }, { id: 2, title: 'Anime', count: 2 }] };
        if (message.method === 'video.get') data = params.album_id === 9 ? { count: 1, items: [video(9, 'Forest', 40)] }
          : params.offset ? { count: 3, items: [video(3, 'Stars', 10)] } : { count: 3, items: [video(1, 'Sea', 30), video(2, 'Clouds', 20)] };
        if (message.method === 'photos.get') data = params.offset ? { count: 3, items: [photo(3, 'Desert #Games', 10)] }
          : { count: 3, items: [photo(1, 'Mountains #Film #Games', 30), photo(2, 'Lake #film', 20)] };
        return Promise.resolve({ success: true, data });
      }) as typeof chrome.runtime.sendMessage;
    });
    await ui.goto('http://vkify.test/?embed=1');
    await expect(ui.locator('#root.ready')).toBeVisible();
    await ui.getByRole('button', { name: 'Style', exact: true }).click();
    await ui.getByRole('button', { name: /Background.*Wallpaper, video/ }).click();
    const tabs = ui.getByRole('group', { name: 'Background', exact: true });
    await expect(tabs.getByRole('button')).toHaveText(['Photo wallpapers', 'Video wallpapers', 'Custom', 'Schedule', 'Adjust']);
    await expect(ui.getByRole('button', { name: 'Presets', exact: true })).toHaveCount(0);
    await ui.getByRole('button', { name: 'Video wallpapers', exact: true }).click();
    await expect(ui.getByRole('button', { name: 'Sea', exact: true })).toBeVisible();
    const category = ui.getByRole('combobox', { name: 'Category · playlist' });
    await expect(category.locator('option')).toHaveText(['All categories', 'Anime (2)', 'Nature (1)']);
    await ui.getByRole('button', { name: 'Load more' }).click();
    await expect(ui.getByRole('button', { name: 'Stars', exact: true })).toBeVisible();
    await expect(ui.getByRole('button', { name: 'Load more' })).toHaveCount(0);
    await ui.getByRole('searchbox', { name: 'Search loaded wallpapers' }).fill('sea');
    await expect(ui.getByRole('button', { name: 'Clouds', exact: true })).toHaveCount(0);
    await ui.getByRole('button', { name: 'Sea', exact: true }).click();
    await expect.poll(() => ui.evaluate(async () => (await chrome.storage.local.get('background_type')).background_type)).toBe('embed');
    expect(await ui.evaluate(async () => (await chrome.storage.local.get('custom_background')).custom_background)).toContain('hash=fixture');
    await ui.getByRole('searchbox', { name: 'Search loaded wallpapers' }).fill('');
    await category.selectOption('9');
    await expect(ui.getByRole('button', { name: 'Forest', exact: true })).toBeVisible();
    await expect(ui.getByRole('button', { name: 'Sea', exact: true })).toHaveCount(0);
    await ui.screenshot({ path: testInfo.outputPath('video-wallpapers.png'), fullPage: true });
    await ui.getByRole('button', { name: 'Photo wallpapers', exact: true }).click();
    await expect(ui.getByRole('button', { name: 'Mountains #Film #Games', exact: true })).toBeVisible();
    await expect(ui.getByRole('combobox', { name: 'Category · playlist' })).toHaveCount(0);
    const photoCategory = ui.getByRole('combobox', { name: 'Category · tag' });
    await expect(photoCategory).toHaveCSS('appearance', 'none');
    const decoration = await photoCategory.evaluate(element => {
      const field = element.getBoundingClientRect();
      const shell = element.parentElement!;
      const arrow = shell.querySelector('.form-control-icon--trailing')!.getBoundingClientRect();
      const icon = shell.querySelector('.form-control-icon--leading')!.getBoundingClientRect();
      return { rightInset: field.right - arrow.right, leftInset: icon.left - field.left,
        centerOffset: Math.abs((arrow.top + arrow.height / 2) - (field.top + field.height / 2)),
        paddingRight: getComputedStyle(element).paddingRight, paddingLeft: getComputedStyle(element).paddingLeft };
    });
    expect(decoration).toMatchObject({ rightInset: 12, leftInset: 12, paddingRight: '40px', paddingLeft: '40px' });
    expect(decoration.centerOffset).toBeLessThan(0.5);
    await expect(photoCategory.locator('option')).toHaveText(['All categories', '#Film (2)', '#Games (1)']);
    await photoCategory.selectOption('games');
    await expect(ui.getByRole('button', { name: 'Lake #film', exact: true })).toHaveCount(0);
    await ui.getByRole('button', { name: 'Load more' }).click();
    await expect(ui.getByRole('button', { name: 'Desert #Games', exact: true })).toBeVisible();
    await expect(photoCategory.locator('option')).toHaveText(['All categories', '#Film (2)', '#Games (2)']);
    await photoCategory.selectOption('film');
    await expect(ui.getByRole('button', { name: 'Mountains #Film #Games', exact: true })).toBeVisible();
    await expect(ui.getByRole('button', { name: 'Lake #film', exact: true })).toBeVisible();
    await expect(ui.getByRole('button', { name: 'Desert #Games', exact: true })).toHaveCount(0);
    await ui.getByRole('searchbox', { name: 'Search loaded wallpapers' }).fill('mountains');
    await expect(ui.getByRole('button', { name: 'Lake #film', exact: true })).toHaveCount(0);
    await ui.getByRole('searchbox', { name: 'Search loaded wallpapers' }).fill('');
    await photoCategory.selectOption('');
    await ui.getByRole('combobox', { name: 'Order' }).selectOption('title');
    const cards = ui.locator('button[aria-pressed]').filter({ has: ui.locator('img') });
    await expect(cards).toHaveCount(3);
    expect(await cards.evaluateAll(elements => elements.map(el => el.getAttribute('aria-label')))).toEqual(['Desert #Games', 'Lake #film', 'Mountains #Film #Games']);
    await ui.getByRole('button', { name: 'Mountains #Film #Games', exact: true }).click();
    await expect.poll(() => ui.evaluate(async () => (await chrome.storage.local.get('background_type')).background_type)).toBe('image');
    expect(await ui.evaluate(async () => (await chrome.storage.local.get('custom_background')).custom_background)).toBe(originalPhoto);
    await expect(ui.getByRole('button', { name: 'Mountains #Film #Games', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await ui.screenshot({ path: testInfo.outputPath('photo-wallpapers.png'), fullPage: true });
    await ui.setViewportSize({ width: 380, height: 850 });
    await ui.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    expect(await ui.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const search = ui.getByRole('searchbox', { name: 'Search loaded wallpapers' });
    await expect(search).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(photoCategory).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await ui.screenshot({ path: testInfo.outputPath('photo-wallpapers-narrow-dark.png'), fullPage: true });
    const photoStyle = await fieldStyle(search);
    expect(photoStyle).toMatchObject({ radius: '12px', fontSize: '14px', height: '40px', paddingTop: '8px', paddingBottom: '8px' });
    expect(await fieldStyle(photoCategory)).toEqual(photoStyle);
    await search.focus();
    await expect(search).toHaveCSS('border-color', 'rgb(0, 119, 255)');
    const focusedStyle = await fieldStyle(search);
    await ui.getByRole('button', { name: 'Custom', exact: true }).click();
    const customInput = ui.locator('input[type="url"]');
    await expect(customInput).toBeVisible();
    expect(await fieldStyle(customInput)).toEqual(photoStyle);
    await customInput.focus();
    await expect.poll(() => fieldStyle(customInput)).toEqual(focusedStyle);
    expect(await ui.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await ui.setViewportSize({ width: 680, height: 850 });
    await ui.getByRole('button', { name: 'Schedule', exact: true }).click();
    await ui.getByRole('button', { name: 'Choose wallpaper: Day', exact: true }).click();
    const chooser = ui.getByRole('dialog', { name: 'Wallpaper for Day' });
    await chooser.getByRole('button', { name: /Video wallpapers.*Videos from VKify playlists/ }).click();
    await ui.getByRole('button', { name: 'Sea', exact: true }).click();
    await expect.poll(() => ui.evaluate(async () => JSON.parse((await chrome.storage.local.get('wallpaper_schedule')).wallpaper_schedule).day.type)).toBe('embed');
    expect(await ui.evaluate(async () => (await chrome.storage.local.get('background_type')).background_type)).toBe('image');
  } finally { await browser.close(); }
});

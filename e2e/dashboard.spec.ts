import { test, expect, chromium, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

test('video wallpaper previews render playable frames and embedded players', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 680, height: 1050 } });
  try {
    await mountDashboard(page, 'chrome');
    const videoUrl = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160; canvas.height = 80;
      const context = canvas.getContext('2d')!;
      document.body.appendChild(canvas);
      const stream = canvas.captureStream(0);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = event => chunks.push(event.data);
      const finished = new Promise<string>(resolve => {
        recorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop());
          canvas.remove();
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
        };
      });
      recorder.start();
      const draw = () => { context.fillStyle = '#1677ff'; context.fillRect(0, 0, 160, 80); context.fillStyle = '#fff'; context.fillRect(45, 20, 70, 40); (stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack).requestFrame(); };
      draw();
      const timer = setInterval(draw, 50);
      setTimeout(() => { clearInterval(timer); recorder.stop(); }, 1500);
      return finished;
    });
    expect(videoUrl.length).toBeGreaterThan(100);
    const metadata = await page.evaluate(url => new Promise(resolve => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => resolve({ width: video.videoWidth });
      video.onerror = () => resolve({ error: video.error?.message });
      video.src = url;
    }), videoUrl);
    expect(metadata).toEqual({ width: 160 });
    await page.evaluate(url => (window as any).chrome.storage.local.set({ language: 'ru', custom_background: url, background_type: 'video',
      wallpaper_schedule: JSON.stringify({ dayStart: '07:00', nightStart: '22:00', day: { url, type: 'video', presetId: '', webId: '', webSchema: '[]' }, night: null }) }), videoUrl);
    await page.getByRole('button', { name: /Фон Обои, видео, эффекты/ }).click();
    await page.getByRole('button', { name: 'Расписание', exact: true }).click();
    const video = page.locator('[data-vkify-anchor="wallpaper_schedule_enabled"] video');
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).videoWidth)).toBe(160);
    expect(await video.evaluate(element => ({ muted: (element as HTMLVideoElement).muted, paused: (element as HTMLVideoElement).paused }))).toEqual({ muted: true, paused: true });
    await video.evaluate(element => (element as HTMLVideoElement).play());
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(false);
    await page.screenshot({ path: info.outputPath('video-wallpaper-preview.png'), fullPage: true });
    await page.getByRole('button', { name: 'Свой', exact: true }).click();
    await expect(page.locator('video')).toBeVisible();
    await page.route('https://vkvideo.ru/video_ext.php**', route => route.fulfill({ contentType: 'text/html', body: '<div style="background:#1677ff;color:white;height:100%">VK video preview</div>' }));
    await page.evaluate(() => (window as any).chrome.storage.local.set({ wallpaper_schedule: JSON.stringify({ dayStart: '07:00', nightStart: '22:00',
      day: { url: 'https://vkvideo.ru/video-42_7', type: 'embed', presetId: '', webId: '', webSchema: '[]' }, night: null }) }));
    await page.getByRole('button', { name: 'Расписание', exact: true }).click();
    const player = page.locator('[data-vkify-anchor="wallpaper_schedule_enabled"] iframe');
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute('src', /video_ext\.php.*autoplay=0.*controls=1/);
  } finally { await browser.close(); }
});

test('wallpaper day/night schedule captures wallpapers and fits narrow windows', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 680, height: 1050 } });
  try {
    await mountDashboard(page, 'chrome');
    await page.route('https://vkify.ru/wallpapers/images/**', async route => route.fulfill({ body: await readFile('public/icons/icon300.png'), contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }));
    await page.evaluate(() => (window as any).chrome.storage.local.set({ language: 'ru',
      custom_background: 'http://vkify.test/icons/icon300.png', background_type: 'image' }));
    await page.evaluate(() => {
      const runtime = (window as any).chrome.runtime;
      const original = runtime.sendMessage;
      runtime.sendMessage = async (message: Record<string, unknown>) => message.type === 'VK_API_CALL' && message.method === 'photos.get'
        ? { success: true, data: { count: 1, items: [{ owner_id: -235511300, id: 1, text: 'Горы', sizes: [{ width: 300, height: 300, url: 'http://vkify.test/icons/icon300.png' }] }] } }
        : original(message);
    });
    await page.getByRole('button', { name: /Фон Обои, видео, эффекты/ }).click();
    await page.getByRole('button', { name: 'Расписание', exact: true }).click();
    const panel = page.locator('[data-vkify-anchor="wallpaper_schedule_enabled"]');
    const toggle = panel.getByRole('switch', { name: 'День / ночь', exact: true });
    await expect(toggle).toBeDisabled();
    await panel.getByRole('button', { name: 'Выбрать обои: День', exact: true }).click();
    const chooser = page.getByRole('dialog', { name: 'Обои для периода «День»' });
    await expect(chooser).toBeVisible();
    await chooser.evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    await page.screenshot({ path: info.outputPath('wallpaper-source-modal.png') });
    await chooser.getByRole('button', { name: /Фотообои/ }).click();
    await expect(chooser).not.toBeVisible();
    await expect(page.getByText('Обои для периода «День»', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Горы', exact: true }).click();
    await expect(page.getByText('Обои сохранены: День', { exact: true })).toBeVisible();
    await expect(panel).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.custom_background)).toBe('http://vkify.test/icons/icon300.png');
    await page.evaluate(() => (window as any).chrome.storage.local.set({ custom_background: 'http://vkify.test/icons/icon128.png' }));
    await panel.getByRole('button', { name: 'Использовать текущий фон: Ночь', exact: true }).click();
    await expect(toggle).toBeEnabled();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await panel.locator('input[type="time"]').first().fill('08:30');
    await expect.poll(() => page.evaluate(() => JSON.parse((window as any).fixture.data.wallpaper_schedule).dayStart)).toBe('08:30');
    for (const width of [680, 400]) {
      await page.setViewportSize({ width, height: 1050 });
      await panel.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`wallpaper-schedule-${width}.png`), fullPage: true });
    }
    await panel.getByRole('button', { name: 'Выбрать обои: Ночь', exact: true }).click();
    const nightChooser = page.getByRole('dialog', { name: 'Обои для периода «Ночь»' });
    await expect(nightChooser.getByRole('button', { name: /Свой фон/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(nightChooser).not.toBeVisible();
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Выбрать обои: Ночь', exact: true }).click();
    await nightChooser.getByRole('button', { name: /Свой фон/ }).click();
    await page.locator('input[type="file"]').setInputFiles('public/icons/icon48.png');
    await expect(panel).toBeVisible();
    await expect(toggle).toBeChecked();
    await expect(page.getByText('Обои сохранены: Ночь', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Удалить обои: День', exact: true }).click();
    await expect(toggle).not.toBeChecked();
    await expect(toggle).toBeDisabled();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.wallpaper_schedule_enabled)).toBe(false);
    await expect.poll(() => page.evaluate(() => JSON.parse((window as any).fixture.data.wallpaper_schedule).day)).toBe(null);
    await expect(panel.getByRole('button', { name: 'Удалить обои: Ночь', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Использовать текущий фон: День', exact: true }).click();
    await toggle.click();
    await page.getByRole('button', { name: 'Фотообои', exact: true }).click();
    await page.getByRole('button', { name: 'Горы', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.wallpaper_schedule_enabled)).toBe(false);
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.background_preset_id)).toBe('vk-photo--235511300_1');
  } finally { await browser.close(); }
});

test('widget site visibility fits in additional settings at desktop and narrow widths', async ({}, testInfo) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 840, height: 1400 } });
  try {
    await mountDashboard(page, 'chrome');
    await page.evaluate(() => (window as any).chrome.storage.local.set({ language: 'ru' }));
    await page.getByRole('button', { name: 'Виджеты', exact: true }).click();
    const panel = page.locator('.widgets-additional');
    const toggle = panel.getByRole('switch', { name: 'Показывать виджеты на vkvideo.ru', exact: true });
    await expect(toggle).toBeChecked();
    for (const width of [840, 440]) {
      await page.setViewportSize({ width, height: 1400 });
      await panel.scrollIntoViewIfNeeded();
      await expect(panel.getByText('Дополнительные настройки', { exact: true })).toBeVisible();
      const fits = await panel.evaluate(element => {
        const panelRect = element.getBoundingClientRect();
        return [...element.querySelectorAll('.dashboard-setting-card strong, .dashboard-setting-card__content > span, [role="switch"]')].every(child => {
          const rect = child.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.top >= panelRect.top && rect.bottom <= panelRect.bottom && rect.left >= panelRect.left && rect.right <= panelRect.right;
        });
      });
      expect(fits).toBe(true);
      await page.locator('.widgets-page').screenshot({ path: testInfo.outputPath(`widgets-${width}.png`) });
    }
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.widgetStack.showOnVkVideo)).toBe(false);
  } finally { await browser.close(); }
});

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
    ], ...JSON.parse(localStorage.getItem('sidebarPreferences') ?? '{}') };
    const write = async (items: Record<string, unknown>) => {
      const changes = Object.fromEntries(Object.entries(items).map(([key, value]) => [key, { oldValue: data[key], newValue: value }]));
      Object.assign(data, items);
      if ('popup_sidebar_enabled' in items || 'popup_sidebar_compact' in items) {
        localStorage.setItem('sidebarPreferences', JSON.stringify({
          popup_sidebar_enabled: data.popup_sidebar_enabled, popup_sidebar_compact: data.popup_sidebar_compact,
        }));
      }
      for (const callback of events) callback(changes, 'local');
    };
    (window as any).fixture = { data, opened: [], failMutation: false, failUpdate: false, restoreCalls: [], restoreMode: 'ok' };
    (window as any).chrome = {
      storage: {
        local: { get: async () => ({ ...data }), set: write, remove: async () => {}, clear: async () => {} },
        sync: { set: async () => {} },
        onChanged: { addListener: (fn: any) => events.add(fn), removeListener: (fn: any) => events.delete(fn) },
      },
      permissions: { contains: async () => true, onAdded: noopEvent, onRemoved: noopEvent },
      runtime: {
        id: 'fixture', getURL: (path: string) => 'http://vkify.test/' + path.replace(/^\//, ''),
        getManifest: () => ({ version: '2.0.0' }), onMessage: noopEvent,
        sendMessage: async (message: Record<string, any>) => {
          if (message.type === 'PING') return { pong: true, hasVKHostPermission: true };
          if (message.type === 'SAVE_SETTINGS_TELEGRAM') {
            (window as any).fixture.telegramBackupRequests = ((window as any).fixture.telegramBackupRequests ?? 0) + 1;
            return { success: true, status: 'queued', queueId: 'backup' };
          }
          if (message.type === 'GET_VK_TOKEN') return { token: 'fixture', userId: '123', status: 'valid' };
          if (message.type === 'QUERY_VK_TABS') return { count: 1 };
          if (message.type === 'GET_API_METHOD') return { hasVKTab: true, nativeApiAvailable: true };
          if (message.type === 'LIST_SETTINGS_DOCUMENTS') return {
            success: true, userId: '123', documents: (window as any).fixture.restoreMode === 'empty' ? [] : [
              { id: 20, ownerId: '123', title: 'vkify-settings-new.json', savedAt: Date.UTC(2026, 9, 3, 12), size: 100 },
              { id: 10, ownerId: '123', title: 'vkify-settings-old.json', savedAt: Date.UTC(2026, 9, 2, 12), size: 100 },
            ],
          };
          if (message.type === 'READ_SETTINGS_DOCUMENT') {
            (window as any).fixture.restoreCalls.push(message);
            if ((window as any).fixture.restoreMode === 'error') return { success: false, code: 'VK_DOCUMENT_DOWNLOAD', error: 'HTTP 403' };
            if ((window as any).fixture.restoreMode === 'account') return { success: false, code: 'ACCOUNT_CHANGED' };
            return { success: true, json: JSON.stringify({ version: '2.0.0', settings: { hide_stories: message.documentId === 20 } }) };
          }
          if (message.type === 'CHECK_EXTENSION_UPDATE') return (window as any).fixture.failUpdate ? { success: false } : {
            success: true, update: { currentVersion: '2.0.0', latestVersion: '2.0.1', available: true, checkedAt: Date.now() },
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

test('Telegram delivery remains visible with compact settings on wide and narrow screens', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 840, height: 1000 } });
    await mountDashboard(page, 'chrome');
    await page.evaluate(async () => {
      const now = Date.now();
      await chrome.storage.local.set({ telegram_notifications_enabled: true,
        telegram_bot_token: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789', telegram_chat_id: '123',
        telegram_delivery_queue: { version: 1, items: [{ id: 'deleted', context: JSON.stringify(['123456', '123']),
          payload: { type: 'spy.delete', title: 'Deleted message', body: 'Original text', timestamp: now },
          createdAt: now, attempts: 1, nextAttemptAt: now + 60000, status: 'retry', error: 'HTTP 429' }],
          receipts: [], delivered: 12, recent: [], updatedAt: now, batchTotal: 3, batchDelivered: 2 } });
    });
    await page.getByRole('button', { name: 'More', exact: true }).click();
    const section = page.locator('.telegram-section');
    await expect(section.getByRole('progressbar')).toBeVisible();
    await expect(section.locator('.telegram-settings-group[open]')).toHaveCount(0);
    expect(await section.locator('.telegram-settings-group').last().locator('summary').first().evaluate(el => {
      const status = el.querySelector('small')!.getBoundingClientRect();
      const chevron = el.querySelector('.telegram-chevron')!.getBoundingClientRect();
      return chevron.left - status.right;
    })).toBeLessThan(15);
    await expect(section.getByLabel('Bot Token', { exact: true })).toBeHidden();
    await expect(section.locator('.telegram-queue-items')).toBeHidden();
    await section.screenshot({ path: info.outputPath('telegram-compact-wide.png') });
    await section.locator('.telegram-queue-details > summary').click();
    await expect(section.locator('.telegram-queue-items')).toContainText('Deleted message');
    await section.locator('.telegram-settings-group').last().locator('summary').first().click();
    await expect(section.getByLabel('Bot Token', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 380, height: 1000 });
    await section.screenshot({ path: info.outputPath('telegram-expanded-narrow.png') });
    expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  } finally { await browser.close(); }
});

test('Telegram backup button follows activation and sidebar resizes with the visible page', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
    await mountDashboard(page, 'chrome');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    const backup = page.locator('[data-vkify-anchor="save_settings_telegram"]');
    await expect(backup).toHaveCount(0);
    await page.evaluate(async () => chrome.storage.local.set({ telegram_notifications_enabled: true,
      telegram_bot_token: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789', telegram_chat_id: '123', popup_sidebar_enabled: true }));
    await expect(backup).toBeVisible();
    await backup.getByRole('button').click();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.telegramBackupRequests)).toBe(1);
    const sidebar = page.locator('.popup-sidebar');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await sidebar.boundingBox())?.height ?? 0).toBeGreaterThan(660);
    await page.setViewportSize({ width: 1000, height: 700 });
    await expect.poll(async () => (await sidebar.boundingBox())?.height ?? 0).toBeLessThan(700);
    await page.setViewportSize({ width: 480, height: 900 });
    await expect(sidebar.locator('.popup-sidebar__label').first()).toBeHidden();
    await expect(sidebar).toHaveCSS('width', '60px');
    await page.setViewportSize({ width: 1000, height: 1200 });
    await expect(sidebar.locator('.popup-sidebar__label').first()).toBeVisible();
    await expect.poll(async () => (await sidebar.boundingBox())?.height ?? 0).toBeGreaterThan(660);
    // A short page must still fill the external VK viewport, without using
    // scrolled coordinates as the minimum content height.
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {
      source: window.parent, origin: 'https://vk.ru', data: { type: 'VKIFY_EMBED_VIEWPORT', top: 0, height: 1200, minHeight: 1200 },
    })));
    await page.getByRole('button', { name: 'Style', exact: true }).click();
    await expect.poll(async () => { const b = await sidebar.boundingBox(); return Math.round((b?.y ?? 0) + (b?.height ?? 0)); }).toBe(1200);
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.locator('.more-data-clouds').screenshot({ path: info.outputPath('telegram-backup-dark.png') });
    await page.evaluate(async () => chrome.storage.local.set({ telegram_notifications_enabled: false }));
    await expect(backup).toHaveCount(0);
  } finally { await browser.close(); }
});

for (const target of ['chrome', 'firefox'] as const) {
  for (const embedded of [true, false]) {
    test(`layout controls use the page editor only in embed mode (${target}, embedded: ${embedded})`, async ({}, info) => {
      const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
      try {
        const page = await browser.newPage({ viewport: { width: 680, height: 1000 } });
        await mountDashboard(page, target);
        if (!embedded) {
          await page.goto('http://vkify.test/');
          await expect(page.locator('#root.ready')).toBeVisible();
        }
        await page.evaluate(async () => {
          (window as any).layoutRequests = [];
          window.parent.postMessage = (message: unknown) => { (window as any).layoutRequests.push(message); };
          await chrome.storage.local.set({ content_width_enabled: true, content_width: 1100,
            page_offset_enabled: true, page_offset_value: 50 });
        });
        await page.getByRole('button', { name: /Layout Sidebar, width and offset/ }).click();
        if (embedded) {
          await expect(page.locator('#content_width, #page_offset_value')).toHaveCount(0);
          await page.getByRole('button', { name: 'Adjust width on the VK page', exact: true }).click();
          await page.getByRole('button', { name: 'Move on the VK page', exact: true }).click();
          expect(await page.evaluate(() => (window as any).layoutRequests.filter((message: any) => message.type === 'VKIFY_LAYOUT_EDIT'))).toEqual([
            { type: 'VKIFY_LAYOUT_EDIT', target: 'content_width' },
            { type: 'VKIFY_LAYOUT_EDIT', target: 'page_offset_value' },
          ]);
          await page.evaluate(() => {
            (document.activeElement as HTMLElement)?.blur();
            window.dispatchEvent(new MessageEvent('message', {
              source: window.parent, origin: 'https://vk.ru', data: { type: 'VKIFY_LAYOUT_EDIT_STATE', active: false },
            }));
          });
          await expect(page.getByRole('button', { name: 'Move on the VK page', exact: true })).toBeFocused();
          await page.screenshot({ path: info.outputPath('embedded-layout-buttons.png'), fullPage: true });
        } else {
          await expect(page.locator('#content_width')).toBeVisible();
          await expect(page.locator('#page_offset_value')).toBeVisible();
          await expect(page.getByRole('button', { name: 'Move on the VK page', exact: true })).toHaveCount(0);
          await page.locator('#content_width').focus();
          await page.keyboard.press('ArrowRight');
          await expect.poll(() => page.evaluate(() => (window as any).fixture.data.content_width)).toBe(1150);
        }
      } finally { await browser.close(); }
    });
  }
}

test('sidebar navigation adapts, supports keyboard and search, and restores top tabs', async ({}, testInfo) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 680, height: 600 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await mountDashboard(page, 'chrome');
    await page.goto('http://vkify.test/');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('switch', { name: 'Alternative navigation', exact: true }).check();
    const nav = page.getByRole('navigation', { name: 'Extension sections' });
    await expect(nav).toBeVisible();
    await expect(page.locator('.popup-tabs')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.popup_sidebar_enabled)).toBe(true);
    await nav.getByRole('button', { name: 'Style', exact: true }).focus();
    await page.keyboard.press('End');
    await expect(nav.getByRole('button', { name: 'More', exact: true })).toBeFocused();
    await page.locator('.popup-sidebar__search').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').locator('input').focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath('sidebar-light.png') });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.screenshot({ path: testInfo.outputPath('sidebar-dark.png') });
    // Toolbar popup always uses an icon rail. Collapsing is an embedded-page
    // preference, so exercise that flow in the embedded settings surface.
    await expect(page.locator('.popup-sidebar')).toHaveCSS('width', '56px');
    await expect(page.locator('.popup-sidebar__collapse')).toHaveCount(0);
    await page.goto('http://vkify.test/?embed=1');
    await expect(nav).toBeVisible();
    await page.getByRole('button', { name: 'Collapse menu', exact: true }).click();
    await expect(page.locator('.popup-sidebar')).toHaveCSS('width', '64px');
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.popup_sidebar_compact)).toBe(true);
    const selected = nav.locator('[aria-current="page"]');
    await expect(selected.locator('.popup-sidebar__active-dot')).toBeHidden();
    const iconOffset = await selected.evaluate(button => {
      const rect = button.getBoundingClientRect();
      const icon = button.querySelector('.popup-sidebar__icon')!.getBoundingClientRect();
      return Math.abs((rect.left + rect.width / 2) - (icon.left + icon.width / 2));
    });
    expect(iconOffset).toBeLessThan(1);
    await page.reload();
    await expect(page.locator('.popup-sidebar')).toHaveCSS('width', '64px');
    await expect(page.getByRole('button', { name: 'Expand menu', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(nav.locator('[aria-current="page"] .popup-sidebar__active-dot')).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath('sidebar-collapsed-restored.png') });
    await nav.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Expand menu', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.popup_sidebar_compact)).toBe(false);
    await page.evaluate(() => { document.body.style.width = '520px'; });
    await expect(page.locator('.popup-sidebar')).toHaveCSS('width', '60px');
    await expect(nav.getByRole('button', { name: 'More', exact: true }).locator('.popup-sidebar__label')).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath('sidebar-compact.png') });
    await page.getByRole('switch', { name: 'Alternative navigation', exact: true }).uncheck();
    await expect(nav).toHaveCount(0);
    await expect(page.locator('.popup-tabs')).toBeVisible();
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto('http://vkify.test/?embed=1');
    await page.evaluate(() => (window as any).chrome.storage.local.set({ popup_sidebar_enabled: true, language: 'ru' }));
    const embeddedNav = page.getByRole('navigation', { name: 'Разделы расширения' });
    await expect(embeddedNav).toBeVisible();
    await expect(page.locator('.popup-sidebar')).toHaveCSS('width', '208px');
    await embeddedNav.getByRole('button', { name: 'Ещё', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Альтернативная навигация', exact: true })).toBeChecked();
    await expect(embeddedNav.getByRole('button', { name: 'Ещё', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
    await page.screenshot({ path: testInfo.outputPath('sidebar-wide-ru.png') });
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {
      source: window.parent, origin: 'https://vk.ru', data: { type: 'VKIFY_EMBED_VIEWPORT', top: 400, height: 500 },
    })));
    const naturalHeight = await page.evaluate(() => document.body.scrollHeight);
    await expect(page.locator('.popup-sidebar')).toHaveCSS('height', '500px');
    await expect.poll(async () => (await page.locator('.popup-sidebar').boundingBox())?.y).toBe(400);
    for (const top of [800, 1200, 400]) {
      await page.evaluate(top => window.dispatchEvent(new MessageEvent('message', {
        source: window.parent, origin: 'https://vk.ru', data: { type: 'VKIFY_EMBED_VIEWPORT', top, height: 500 },
      })), top);
      await page.waitForTimeout(50);
      expect(await page.evaluate(() => document.body.scrollHeight)).toBe(naturalHeight);
    }
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {
      source: window.parent, origin: 'https://vk.ru', data: { type: 'VKIFY_EMBED_VIEWPORT', top: 0, height: 800 },
    })));
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.locator('.popup-sidebar')).toHaveCSS('width', '60px');
    await expect.poll(async () => {
      const box = await embeddedNav.getByRole('button', { name: 'Ещё', exact: true }).boundingBox();
      return box ? box.y + box.height <= 800 : false;
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('sidebar-mobile-ru.png') });
    const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('*')]
      .filter(element => element.getBoundingClientRect().right > window.innerWidth + 1)
      .map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })).slice(0, 12));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), JSON.stringify(overflow)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});

for (const target of ['chrome', 'firefox'] as const) {
  test(`${target} renders outline controls and SVG icons in all legacy spy histories`, async ({}, testInfo) => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH || undefined });
    const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.route('https://sun9.userapi.com/saved.jpg', async route => route.fulfill({ contentType: 'image/png', body: await readFile(resolve('dist', target, 'icons/icon48.png')) }));
      await mountDashboard(page, target);
      await page.evaluate(async () => {
        const entry = (icon: string, index: number) => ({ icon, userId: '42', userName: 'Alice',
          action: 'Fixture event', timestamp: Date.now() + index });
        await (window as any).chrome.storage.local.set({
          custom_background: 'http://vkify.test/icons/icon48.png', background_type: 'image',
          spy_enabled: true, spy_online: true, profile_spy: true, spy_save_log: true, profile_spy_save_log: true,
          online_tracked_users: [{ id: '42', name: 'Alice' }], profile_tracked_users: [{ id: '42', name: 'Alice' }],
          activity_spy_log: ['⌨️', '🎤', '📷', '🎥', '📎', '📞', '🗑️', '✏️', '👁️', '👻', '💬'].map((icon, index) => ({
            ...entry(icon, index), extra: { text: 'User message with 😂 stays intact https://example.org/message',
              ...(index === 10 ? { photos: ['https://sun9.userapi.com/saved.jpg'], attachments: [
                { kind: 'voice', title: 'Saved voice', url: 'https://psv4.vkuseraudio.net/saved.ogg' },
                { kind: 'document', title: 'Saved document', url: 'https://vk.com/doc/saved.pdf' },
                { kind: 'link', title: 'Saved link', url: 'https://example.org/attachment' },
              ] } : {}) },
          })),
          online_spy_log: ['🟢', '⚫'].map(entry),
          profile_spy_log: ['avatar', 'status', 'friends_added', 'friends_removed'].map((changeType, index) => ({
            ...entry(['🖼️', '💬', '👥', '👤'][index]!, index), changeType, description: 'Profile changed',
          })),
        });
      });
      const moreIcon = page.getByRole('button', { name: 'More', exact: true }).locator('svg');
      await expect(moreIcon).toBeVisible();
      await expect(moreIcon).toHaveAttribute('viewBox', '0 0 28 28');
      await page.getByRole('button', { name: /Background Wallpaper, video, effects/ }).click();
      await expect(page.getByRole('button', { name: 'Adjust', exact: true }).locator('svg')).toHaveAttribute('viewBox', '0 0 28 28');
      await page.getByRole('button', { name: 'Adjust', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Adjust', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.screenshot({ path: testInfo.outputPath('background-outline-icons.png') });
      await page.getByRole('button', { name: 'Spy', exact: true }).click();
      const modes = [
        { title: 'Message activity', ids: ['message', 'hidden', 'read', 'edit', 'delete', 'call', 'attach', 'video', 'photo', 'voice', 'typing'] },
        { title: 'Online monitoring', ids: ['offline', 'online'] },
        { title: 'Profile tracking', ids: ['friends_removed', 'friends_added', 'status', 'avatar'] },
      ];
      for (const mode of modes) {
        await page.getByRole('button', { name: new RegExp(mode.title) }).click();
        await expect(page.locator('.spy-log-actions__history')).toHaveText(`History (${mode.ids.length})`);
        await page.locator('.spy-log-actions__history').click();
        const dialog = page.getByRole('dialog');
        const icons = dialog.locator('[data-spy-event-icon]');
        await expect(icons.locator('svg')).toHaveCount(mode.ids.length);
        expect(await icons.evaluateAll(elements => elements.map(element => element.getAttribute('data-spy-event-icon')))).toEqual(mode.ids);
        expect(await icons.allTextContents()).toEqual(mode.ids.map(() => ''));
        if (mode.title === 'Message activity') {
          await expect(dialog.getByText(/User message with 😂 stays intact/).first()).toBeVisible();
          await expect(dialog.locator('audio')).toHaveAttribute('preload', 'none');
          await expect(dialog.getByRole('link', { name: 'Saved document', exact: true })).toHaveAttribute('href', 'https://vk.com/doc/saved.pdf');
          await expect(dialog.getByRole('link', { name: 'Saved link', exact: true })).toHaveAttribute('href', 'https://example.org/attachment');
          await expect(dialog.locator('img[alt="Photo 1"]')).toHaveCount(1);
          await expect(dialog.getByRole('link', { name: 'https://example.org/message', exact: true })).toHaveCount(11);
        }
        await dialog.evaluate(async element => {
          const animations = element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity);
          await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
        });
        await page.screenshot({ path: testInfo.outputPath(`${mode.title.replaceAll(' ', '-')}-history.png`) });
        await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.getByRole('button', { name: 'Back', exact: true }).click();
      }
      expect(errors).toEqual([]);
    } finally { await browser.close(); }
  });
}

test('appearance profiles save new settings, restore them and report failed writes', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
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
    await expect(page.getByPlaceholder('Profile name')).toBeVisible();
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
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
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
    await expect(page.getByText('Could not save profile. Try again.', { exact: true })).toBeVisible();
    await expect(page.getByText('Failed profile', { exact: true })).toHaveCount(0);
  } finally { await browser.close(); }
});

test('built Notes dashboard renders avatars, recovers old photos, searches and handles storage errors', async ({}, testInfo) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
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
    await expect(page.getByText('Could not save. Try again.', { exact: true })).toBeVisible();
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

test('VK settings restore applies the selected file, preserves credentials and handles failed reads', async ({}, testInfo) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 680, height: 1000 } });
  try {
    await mountDashboard(page, 'chrome');
    await page.evaluate(() => {
      const fixture = (window as any).fixture;
      fixture.data.vk_access_token = 'local-secret';
      fixture.data.hide_stories = true;
      const local = (window as any).chrome.storage.local;
      local.get = async (keys: string[] | string | null) => keys == null ? { ...fixture.data }
        : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in fixture.data).map(key => [key, fixture.data[key]]));
      local.clear = async () => { for (const key of Object.keys(fixture.data)) delete fixture.data[key]; };
    });
    await page.getByRole('button', { name: 'More', exact: true }).click();
    const restore = page.locator('.more-data-restore');
    await restore.getByRole('button', { name: 'Restore from VK', exact: true }).click();
    await expect(restore.getByRole('radio')).toHaveCount(2);
    await expect(restore.getByRole('radio').first()).toBeChecked();
    await restore.getByRole('radio').last().check();
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await restore.screenshot({ path: testInfo.outputPath('settings-restore-wide.png') });
    await page.setViewportSize({ width: 380, height: 1000 });
    await restore.screenshot({ path: testInfo.outputPath('settings-restore-narrow.png') });
    await restore.getByRole('button', { name: 'Apply selected file', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.hide_stories)).toBe(false);
    expect(await page.evaluate(() => (window as any).fixture.data.vk_access_token)).toBe('local-secret');
    expect(await page.evaluate(() => (window as any).fixture.restoreCalls[0])).toMatchObject({ userId: '123', documentId: 10 });
    await page.evaluate(() => { (window as any).fixture.restoreMode = 'error'; });
    await restore.getByRole('button', { name: 'Apply selected file', exact: true }).click();
    await expect(restore.getByRole('alert')).toBeVisible();
    await expect(restore.getByRole('alert')).toContainText('HTTP 403');
    expect(await page.evaluate(() => (window as any).fixture.data.hide_stories)).toBe(false);
    await page.evaluate(() => { (window as any).fixture.restoreMode = 'account'; });
    await restore.getByRole('button', { name: 'Apply selected file', exact: true }).click();
    await expect(restore.getByRole('radio')).toHaveCount(0);
    await expect(restore.getByRole('alert')).toContainText('account changed');
    await page.evaluate(() => { (window as any).fixture.restoreMode = 'empty'; });
    await restore.getByRole('button', { name: 'Restore from VK', exact: true }).click();
    await expect(restore.getByRole('status')).toContainText('no settings files');
  } finally { await browser.close(); }
});

test('built Firefox More dashboard offers an update through the official installation page', async ({}, testInfo) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
  try {
    await mountDashboard(page, 'firefox');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'More', exact: true })).toBeVisible();
    await expect(page.getByText('Version 2.0.1 is available')).toBeVisible();
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

test('background setting cards keep controls inset and support keyboard disclosure', async ({}, info) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 680, height: 1000 } });
  try {
    await mountDashboard(page, 'chrome');
    await page.evaluate(async () => { await chrome.storage.local.set({ custom_background: 'http://vkify.test/icons/icon48.png', background_type: 'image' }); });
    await page.getByRole('button', { name: /Background Wallpaper, video, effects/ }).click();
    await page.getByRole('button', { name: 'Adjust', exact: true }).click();
    const trigger = page.getByRole('button', { name: /^Color filters/ });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const card = page.locator('.settings-disclosure').filter({ has: trigger });
    await expect(card.getByRole('slider')).toHaveCount(6);
    await page.waitForTimeout(200);
    for (const width of [680, 380]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
        const bounds = await card.evaluate(element => {
          const panel = element.getBoundingClientRect();
          return Array.from(element.querySelectorAll('input')).every(input => {
            const rect = input.getBoundingClientRect();
            return rect.left - panel.left >= 14 && panel.right - rect.right >= 14;
          });
        });
        expect(bounds).toBe(true);
        expect(await card.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`filters-${width}-${theme}.png`), fullPage: true });
      }
    }
    await card.getByRole('slider').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.evaluate(async () => (await chrome.storage.local.get('background_brightness')).background_brightness)).toBe(105);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(card.getByRole('slider')).toHaveCount(0);
  } finally { await browser.close(); }
});

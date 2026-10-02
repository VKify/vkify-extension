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
    const profile = (id: number, name: string) => ({ id, name, online: false, noAvatar: true });
    const data: Record<string, any> = { language: 'en', onboarding_done: true, first_run: false,
      friends_audit_v2_123: { version: 2, userId: '123', fetchedAt: Date.now(), friends: [profile(1, 'Old friend')], incoming: [profile(2, 'Incoming friend')], outgoing: [profile(3, 'Outgoing friend')] } };
    const fixture = { writes: [] as any[], downloaded: [] as any[] };
    const stats = { version: 1, ownerId: '123', status: 'completed', mode: 'quick', collectedAt: Date.now(), completed: 1, total: 1,
      rows: [{ peerId: 42, title: 'Test dialog', type: 'user', lastMessageAt: Date.now(), lastDirection: 'in', approxMessageCount: 10, countExact: false, unread: 2 }] };
    (window as any).fixture = fixture;
    (window as any).chrome = {
      storage: { local: { get: async () => ({ ...data }), set: async (values: any) => Object.assign(data, values), remove: async () => {}, clear: async () => {} }, sync: { set: async () => {} }, onChanged: event },
      permissions: { contains: async () => true, onAdded: event, onRemoved: event },
      runtime: { id: 'fixture', onMessage: event, getURL: (path: string) => 'http://vkify.test/' + path.replace(/^\//, ''), getManifest: () => ({ version: '1.8.6' }),
        sendMessage: async (message: any) => {
          if (message.type === 'PING') return { pong: true, hasVKHostPermission: true };
          if (message.type === 'GET_VK_TOKEN') return { token: 'fixture', userId: '123', status: 'valid' };
          if (message.type === 'QUERY_VK_TABS') return { count: 1 };
          if (message.type === 'GET_DIALOG_STATS') return { success: true, state: stats };
          if (message.type === 'GET_API_METHOD') return { hasVKTab: true, nativeApiAvailable: true };
          if (message.type === 'DOWNLOAD_ATTACHMENT') { fixture.downloaded.push(message); return { success: true }; }
          if (message.type !== 'VK_API_CALL') return { success: true };
          switch (message.method) {
            case 'users.get': return { success: true, data: [{ id: 123, first_name: 'Fixture' }] };
            case 'groups.get': return { success: true, data: { count: 3, items: [1, 2, 3].map(id => ({ id, name: 'Community ' + id, members_count: 100 })) } };
            case 'video.get': return { success: true, data: { count: 2, items: [{ id: 1, owner_id: 456, title: 'Saved video', duration: 65 }, { id: 2, owner_id: 123, title: 'Own upload', duration: 120 }] } };
            case 'video.getAlbums': return { success: true, data: { count: 1, items: [{ id: 4, title: 'My album', count: 0 }] } };
            case 'messages.getConversations': return { success: true, data: { count: 1, items: [{ conversation: { peer: { id: 42 } } }], profiles: [{ id: 42, first_name: 'Test', last_name: 'dialog' }] } };
            case 'messages.getHistoryAttachments': return { success: true, data: { items: message.params.media_type === 'doc' ? [{ cmid: 1, attachment: { type: 'doc', doc: { id: 1, owner_id: 42, title: 'Report.pdf', url: 'https://example.com/report.pdf' } } }] : [] } };
            default:
              fixture.writes.push(message);
              if (message.method === 'messages.markAsRead') stats.rows[0].unread = 0;
              return { success: true, data: message.method === 'friends.add' ? 2 : message.method === 'friends.delete' ? { success: 1, out_request_deleted: 1 } : 1 };
          }
        },
      },
    };
  });
  await page.goto('http://vkify.test/?embed=1');
  await expect(page.locator('#root.ready')).toBeVisible();
  await page.getByRole('button', { name: 'Center', exact: true }).click();
}

for (const target of ['chrome', 'firefox'] as const) {
  test(`bulk center controls work in the ${target} build`, async ({}, info) => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
    const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await mount(page, target);
      await page.getByRole('button', { name: /^Communities / }).click();
      await page.getByRole('button', { name: /Subscription overview/ }).click();
      await page.locator('.ct-overview').getByRole('button', { name: 'Load', exact: true }).click();
      await expect(page.locator('.ct-group')).toHaveCount(3);
      await page.getByRole('button', { name: 'Select matches: 3' }).click();
      await page.getByRole('button', { name: 'Unsubscribe · 3' }).click();
      expect(await page.evaluate(() => (window as any).fixture.writes.length)).toBe(0);
      await expect(page.locator('.ct-bulk-confirm li')).toHaveCount(3);
      await page.screenshot({ path: info.outputPath('subscriptions-review.png'), fullPage: true });
      await page.getByRole('button', { name: 'Confirm and start' }).click();
      await expect(page.locator('.ct-group')).toHaveCount(2);
      await page.getByRole('button', { name: 'Stop queue' }).click();
      await expect(page.getByText('Succeeded: 1 · Failed: 0 · Not started: 2')).toBeVisible();
      expect(await page.evaluate(() => (window as any).fixture.writes)).toEqual([{ type: 'VK_API_CALL', method: 'groups.leave', params: { group_id: 1 }, expectedUserId: '123' }]);
      await page.setViewportSize({ width: 400, height: 800 });
      await page.screenshot({ path: info.outputPath('subscriptions-narrow.png'), fullPage: true });
      expect(await page.locator('.center-tool').evaluate(element => element.getBoundingClientRect().right <= innerWidth && element.scrollWidth <= element.clientWidth)).toBe(true);

      await page.goto('http://vkify.test/?embed=1');
      await page.getByRole('button', { name: 'Center', exact: true }).click();
      await page.getByRole('button', { name: /^Friends Tools/ }).click();
      await page.getByRole('button', { name: /Friends audit/ }).click();
      await page.locator('.fa-segments').getByRole('button', { name: /Incoming/ }).click();
      await page.getByRole('checkbox', { name: 'Select: Incoming friend', exact: true }).check();
      await page.getByRole('button', { name: 'Accept requests · 1' }).click();
      await page.getByRole('button', { name: 'Confirm and start' }).click();
      await expect(page.getByRole('link', { name: /Incoming friend/ })).toHaveCount(0);
      await page.locator('.fa-segments').getByRole('button', { name: /^Friends/ }).click();
      await expect(page.getByRole('link', { name: /Incoming friend/ })).toBeVisible();

      await page.goto('http://vkify.test/?embed=1');
      await page.getByRole('button', { name: 'Center', exact: true }).click();
      await page.getByRole('button', { name: /^Video Tools/ }).click();
      await page.getByRole('button', { name: /Saved video catalog/ }).click();
      await page.getByRole('button', { name: 'Load video library', exact: true }).click();
      await page.getByRole('button', { name: 'Select matches: 2' }).click();
      await page.getByRole('button', { name: 'Remove others’ videos from collection · 1' }).click();
      await expect(page.locator('.ct-bulk-confirm li')).toHaveCount(1);
      await expect(page.locator('.ct-bulk-confirm')).toContainText('Saved video');
      await expect(page.locator('.ct-bulk-confirm')).not.toContainText('Own upload');
      await page.getByRole('button', { name: 'Confirm and start' }).click();
      await expect(page.locator('.vc-video')).toHaveCount(1);
      await expect(page.locator('.vc-video')).toContainText('Own upload');

      await page.goto('http://vkify.test/?embed=1');
      await page.getByRole('button', { name: 'Center', exact: true }).click();
      await page.getByRole('button', { name: /^Messenger Messages/ }).click();
      await page.getByRole('button', { name: /Dialog statistics/ }).click();
      await page.getByRole('checkbox', { name: 'Select dialog: Test dialog', exact: true }).check();
      await page.getByRole('button', { name: 'Mark as read · 1' }).click();
      await page.getByRole('button', { name: 'Confirm and start' }).click();
      await expect(page.getByText('Succeeded: 1 · Failed: 0 · Not started: 0')).toBeVisible();
      expect(await page.evaluate(() => (window as any).fixture.writes.at(-1))).toMatchObject({ method: 'messages.markAsRead', params: { peer_id: 42, mark_conversation_as_read: 1 }, expectedUserId: '123' });
      await page.screenshot({ path: info.outputPath('dialogs-read.png'), fullPage: true });

      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.getByRole('button', { name: /Dialog files/ }).click();
      await page.getByRole('button', { name: 'Load overview', exact: true }).click();
      await expect(page.getByRole('checkbox', { name: 'Select: Report.pdf', exact: true })).toBeVisible();
      await page.getByRole('checkbox', { name: 'Select: Report.pdf', exact: true }).check();
      await expect(page.getByRole('button', { name: 'Download files · 1' })).toBeEnabled();
      await page.getByRole('button', { name: 'Download files · 1' }).click();
      await page.getByRole('button', { name: 'Confirm and start' }).click();
      await expect(page.getByText('Succeeded: 1 · Failed: 0 · Not started: 0')).toBeVisible();
      expect(await page.evaluate(() => (window as any).fixture.downloaded)).toEqual([{ type: 'DOWNLOAD_ATTACHMENT', url: 'https://example.com/report.pdf', filename: 'vkify-42-1-1.pdf' }]);
      await page.screenshot({ path: info.outputPath('attachments-actions.png'), fullPage: true });
      expect(errors).toEqual([]);
    } finally { await browser.close(); }
  });
}

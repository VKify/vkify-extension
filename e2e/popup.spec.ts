import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const EXT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'chrome');

let context: BrowserContext;
let extensionId: string;

test('Center friends audit uses cached profiles, filters and request segments', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await page.evaluate(async () => {
    const profile = (id: number, name: string, extra = {}) => ({ id, name, online: false, noAvatar: false, ...extra });
    await chrome.storage.local.set({
      onboarding_done: true, first_run: false, language: 'en',
      friends_audit_v2_123: {
        version: 2, userId: '123', fetchedAt: Date.now(),
        friends: [profile(1, 'Alice Old', { lastSeen: 1000000 }), profile(2, 'Bob Hidden', { noAvatar: true })],
        incoming: [profile(3, 'Carol Incoming')], outgoing: [profile(4, 'Dave Outgoing')],
      },
    });
  });
  await page.addInitScript(() => {
    const original = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = ((message: { type: string }) => {
      if (message.type === 'GET_VK_TOKEN') return Promise.resolve({ token: 'fixture', userId: '123', status: 'valid' });
      if (message.type === 'VK_API_CALL') return Promise.resolve({ success: true, data: [{ id: 123, first_name: 'Fixture' }] });
      return original(message);
    }) as typeof chrome.runtime.sendMessage;
  });
  await page.reload();
  await expect(page.locator('#root.ready')).toBeVisible();
  await page.getByRole('button', { name: 'Center', exact: true }).click();
  await page.getByRole('button', { name: 'Friends', exact: true }).click();
  await expect(page.locator('[data-vkify-anchor="friends_audit"]')).toHaveCount(0);
  await page.getByRole('button', { name: /Friends audit/ }).click();
  await expect(page.getByRole('heading', { name: 'Friends audit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alice Old' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Filter', exact: true }).selectOption('inactive');
  await expect(page.getByRole('link', { name: 'Alice Old' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bob Hidden' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Include profiles without an exact date in the inactive list' }).check();
  await expect(page.getByRole('link', { name: 'Bob Hidden' })).toBeVisible();
  await page.locator('.fa-segments').getByRole('button', { name: /Incoming/ }).click();
  await expect(page.getByRole('link', { name: 'Carol Incoming' })).toBeVisible();
  await page.locator('.fa-segments').getByRole('button', { name: /Outgoing/ }).click();
  await expect(page.getByRole('link', { name: 'Dave Outgoing' })).toBeVisible();
  await page.screenshot({ path: 'test-results/friends-audit.png' });
  await page.close();
});

test.beforeAll(async () => {
  // Расширения в Chromium грузятся только в headed-режиме (MV3 service worker не
  // регистрируется в headless). На CI этот headed-Chromium поднимается под
  // виртуальным дисплеем xvfb (см. ci.yml → job `e2e`).
  context = await chromium.launchPersistentContext('', {
    headless: false,
    executablePath: process.env.PW_CHROME_PATH || undefined,
    args: [
      '--no-sandbox',
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
    ],
  });

  // MV3 background service worker → its origin is the extension id.
  let sw: Worker | undefined = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  extensionId = new URL(sw.url()).host;
});

test.afterAll(async () => {
  await context?.close();
});

test('popup mounts without crashing and renders UI', async () => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`chrome-extension://${extensionId}/index.html`);

  // #root gets the `ready` class only after the React app mounted + theme/storage
  // init resolved — i.e. the whole popup path (chrome alias, storage) worked.
  await expect(page.locator('#root.ready')).toBeVisible();
  await expect(page.locator('#root')).not.toBeEmpty();

  expect(errors, `popup threw: ${errors.join(' | ')}`).toEqual([]);
});

test('chrome.storage round-trips from the popup context', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await page.locator('#root.ready').waitFor();

  const value = await page.evaluate(async () => {
    await chrome.storage.local.set({ __e2e_probe__: 'ok' });
    const got = await chrome.storage.local.get('__e2e_probe__');
    await chrome.storage.local.remove('__e2e_probe__');
    return (got as Record<string, unknown>).__e2e_probe__;
  });

  expect(value).toBe('ok');
});

test('background service worker answers PING', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await page.locator('#root.ready').waitFor();

  const pong = await page.evaluate(async () => {
    const r = await chrome.runtime.sendMessage({ type: 'PING' });
    return (r as { pong?: boolean })?.pong === true;
  });

  expect(pong).toBe(true);
});

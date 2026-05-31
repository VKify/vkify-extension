import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const EXT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'chrome');

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  // Расширения в Chromium грузятся только в headed-режиме (MV3 service worker не
  // регистрируется в headless). На CI этот headed-Chromium поднимается под
  // виртуальным дисплеем xvfb (см. ci.yml → job `e2e`).
  context = await chromium.launchPersistentContext('', {
    headless: false,
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

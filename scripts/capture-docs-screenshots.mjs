import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const extensionDir = resolve('dist/chrome');
const outputRoot = resolve('../frontend/public/docs');
const executablePath = process.env.PW_CHROME_PATH
  || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const captures = [
  ['Вид', 'view'],
  ['Скрытие', 'hiding'],
  ['Центр', 'center'],
  ['Приватность', 'privacy'],
  ['Слежка', 'onlinespy'],
  ['Скрипты', 'scripts'],
  ['Реклама', 'ads'],
  ['CSS', 'css'],
  ['Ещё', 'more'],
];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const file = resolve(extensionDir, pathname === '/' ? 'index.html' : `.${pathname}`);
    if (!file.startsWith(extensionDir)) throw new Error('Invalid path');
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end('Not found');
  }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Preview server did not start');

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 680, height: 600 } });

await page.addInitScript(() => {
  const values = { onboarding_done: true, language: 'ru', extension_theme: 'light' };
  const event = { addListener() {}, removeListener() {}, hasListener() { return false; } };
  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (keys == null) return { ...values };
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.filter(key => key in values).map(key => [key, values[key]]));
        },
        async set(next) { Object.assign(values, next); },
        async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; },
        async clear() { for (const key of Object.keys(values)) delete values[key]; },
      },
      onChanged: event,
    },
    runtime: {
      id: 'docs-preview',
      getManifest: () => ({ version: '1.8.4', name: 'VKify' }),
      getURL: path => new URL(path, location.origin).href,
      sendMessage: async () => ({}),
      onMessage: event,
    },
    tabs: { query: async () => [], create: async () => ({}), reload: async () => {} },
    permissions: { contains: async () => true, request: async () => true },
    commands: { getAll: async () => [] },
  };
});

try {
  await page.goto(`http://127.0.0.1:${address.port}/index.html`);
  await page.locator('#root.ready').waitFor();

  const save = async (slug, file) => {
    const outputDir = resolve(outputRoot, slug);
    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: resolve(outputDir, file) });
  };

  const openFeature = async (query) => {
    await page.keyboard.press('Control+K');
    const search = page.getByRole('searchbox');
    await search.fill(query);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(650);
  };

  for (const [tab, slug] of captures) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(350);
    await save(slug, 'overview.png');
  }

  await openFeature('Фон страницы');
  await save('view', 'background.png');

  await openFeature('Шаблоны сообщений');
  await save('center', 'message-templates.png');

  await openFeature('Сохранение треков в MP3');
  await save('center', 'audio-download.png');

  await page.getByRole('button', { name: 'Плеер', exact: true }).click();
  await page.getByRole('button', { name: /Эквалайзер/ }).click();
  await page.waitForTimeout(350);
  await save('center', 'equalizer.png');

  await openFeature('Шифрование сообщений');
  await save('privacy', 'crypto.png');

  await openFeature('Онлайн-мониторинг');
  await save('onlinespy', 'online.png');

  await page.getByRole('button', { name: 'Реклама', exact: true }).click();
  await page.getByRole('button', { name: /Настроить слова и исключения/ }).click();
  await page.waitForTimeout(350);
  await save('ads', 'keywords.png');

  await page.getByRole('button', { name: 'CSS', exact: true }).click();
  await page.waitForTimeout(350);
  await save('css', 'editor.png');

} finally {
  await browser.close();
  server.close();
}

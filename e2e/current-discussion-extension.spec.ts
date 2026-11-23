import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('built extension restores discussion scrolling and hover settings without test IDs', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ language: 'ru', onboarding_done: true, first_run: false, messages_global_scroll: true, messages_disable_hover: true }));
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<style>
      :root{--vkui--color_transparent:transparent;--vkui--color_transparent--hover:rgba(0,0,0,.04)}
      #scroller{height:200px;width:400px;overflow:auto}.vkui-position-relative{height:100px}
      .vkui-position-relative:hover,button:hover{background-color:var(--vkui--color_transparent--hover)}
      #outside{position:absolute;left:500px;top:0;width:200px;height:200px}
      </style><section role="main"><a href="/board235511300">Обсуждения</a><div id="scroller"><div class="vkui-position-relative" id="comment"><div class="vkui-padding-inline-system">Message<button>React</button></div></div><div style="height:1500px">More comments</div></div></section><div id="outside">Free area</div>` }));
    await page.goto('https://vk.ru/topic-235511300_56844857?offset=0');
    await expect(page.locator('html')).toHaveAttribute('data-vkify-messages_disable_hover', 'true');
    await page.mouse.move(550, 100); await page.mouse.wheel(0, 80);
    await expect.poll(() => page.locator('#scroller').evaluate(el => el.scrollTop)).toBe(80);
    await page.locator('#scroller').evaluate(el => el.scrollTop = 0);
    await page.locator('#comment').hover({ position: { x: 300, y: 30 } });
    await expect(page.locator('#comment')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.getByRole('button', { name: 'React' }).hover();
    await expect(page.getByRole('button', { name: 'React' })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.04)');
    await worker.evaluate(() => chrome.storage.local.set({ messages_global_scroll: false, messages_disable_hover: false }));
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-messages_disable_hover');
    await page.locator('#comment').hover({ position: { x: 300, y: 30 } });
    await expect(page.locator('#comment')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.04)');
    await page.mouse.move(550, 100); await page.mouse.wheel(0, 80);
    expect(await page.locator('#scroller').evaluate(el => el.scrollTop)).toBe(0);
  } finally { await context.close(); }
});

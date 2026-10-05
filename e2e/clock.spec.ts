import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('clock settings, real content script, SPA navigation and opt-in dragging', async ({}, testInfo) => {
  test.setTimeout(60000);
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    executablePath: process.env.PW_CHROME_PATH,
    headless: true,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    // Let the extension finish initialization before writing test preferences.
    const ui = await context.newPage();
    await ui.setViewportSize({ width: 680, height: 700 });
    await ui.goto(`chrome-extension://${id}/index.html`);
    await expect(ui.locator('#root.ready')).toBeVisible();
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ onboarding_done: true, first_run: false, language: 'en', clock_enabled: true, clock_settings: '{}' });
    });
    const vk = await context.newPage();
    await vk.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#18202f;min-height:100vh"><div id="page_header_cont" style="height:48px"></div><div id="page_layout"></div></body></html>' }));
    await vk.goto('https://vk.ru/feed');
    const clock = vk.locator('#vkify-clock');
    await expect(clock).toHaveCount(1);
    await expect(clock).toHaveCSS('pointer-events', 'none');
    await vk.evaluate(() => { (window as unknown as { firstClock: Element | null }).firstClock = document.querySelector('#vkify-clock'); });
    for (const route of ['/im', '/music', '/id123', '/club123', '/video', '/feed']) {
      await vk.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, route);
      await expect(clock).toHaveCount(1);
      expect(await vk.evaluate(() => document.querySelector('#vkify-clock') === (window as unknown as { firstClock: Element }).firstClock)).toBe(true);
    }
    await ui.reload();
    await expect(ui.locator('#root.ready')).toBeVisible();
    await ui.getByRole('button', { name: 'Style', exact: true }).click();
    const backgroundNav = ui.getByRole('button', { name: /Background.*Wallpaper, video/ });
    const clockNav = ui.getByRole('button', { name: /^Clock\b/ });
    await expect(backgroundNav).toBeVisible();
    await expect(clockNav).toBeVisible();
    // Appearance now groups its pages into Style, Layout and Profiles.
    const layout = ui.locator('.dashboard-panel').filter({ has: ui.getByRole('heading', { name: 'Layout', exact: true }) });
    await expect(layout.getByRole('button', { name: /^Clock\b/ })).toBeVisible();
    await expect(layout.getByRole('button', { name: /Background.*Wallpaper, video/ })).toHaveCount(0);
    await clockNav.click();
    await expect(ui.getByText('Preview', { exact: true })).toBeVisible();
    await ui.getByRole('switch', { name: 'Seconds', exact: true }).check();
    await expect(clock).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
    await ui.getByRole('switch', { name: 'Date', exact: true }).check();
    await expect(clock).toHaveText(/^\d{2}\.\d{2}\.\d{4} · \d{2}:\d{2}:\d{2}$/);
    await ui.getByRole('button', { name: /Glass/ }).click();
    await expect(clock).toHaveCSS('backdrop-filter', 'blur(12px)');
    await expect(ui.getByRole('button', { name: /Glass/ })).toHaveAttribute('aria-pressed', 'true');
    await ui.getByText('Preview', { exact: true }).scrollIntoViewIfNeeded();
    await ui.screenshot({ path: testInfo.outputPath('clock-settings.png') });
    await expect(ui.locator('.clock-settings__preset')).toHaveCount(12);
    await ui.locator('.clock-settings__preset').filter({ hasText: 'Neon' }).click();
    await expect(clock).toHaveCSS('color', 'rgb(103, 232, 249)');
    await expect(clock).toHaveCSS('letter-spacing', '2px');
    await expect(clock).toHaveCSS('border-top-color', 'rgb(34, 211, 238)');
    await expect(clock).toHaveText(/^\d{2}\.\d{2}\.\d{4} · \d{2}:\d{2}:\d{2}$/);
    await ui.locator('.clock-settings__preset').filter({ hasText: 'Sunset' }).click();
    await expect(clock).toHaveCSS('text-shadow', 'none');
    await expect(clock.locator('span')).toHaveCount(2);
    await expect(clock.locator('span').first()).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
    await expect.poll(() => clock.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
    await ui.reload();
    await expect(ui.locator('#root.ready')).toBeVisible();
    await ui.getByRole('button', { name: 'Style', exact: true }).click();
    await ui.getByRole('button', { name: /^Clock\b/ }).click();
    await expect(ui.locator('.clock-settings__preset').filter({ hasText: 'Sunset' })).toHaveAttribute('aria-pressed', 'true');
    await ui.getByRole('button', { name: 'Reset appearance', exact: true }).click();
    await expect(clock.locator('span')).toHaveCount(0);
    await expect(clock).toHaveCSS('background-image', 'none');
    await expect(clock).toHaveCSS('text-shadow', 'none');
    await expect(clock).toHaveText(/^\d{2}\.\d{2}\.\d{4} · \d{2}:\d{2}:\d{2}$/);
    await ui.setViewportSize({ width: 380, height: 700 });
    // The toolbar popup is fixed at 680px; emulate the narrower embedded body.
    await ui.evaluate(() => { document.body.style.width = '100%'; });
    await ui.locator('.clock-settings__presets').scrollIntoViewIfNeeded();
    await ui.screenshot({ path: testInfo.outputPath('clock-presets-narrow.png') });
    expect(await ui.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await ui.setViewportSize({ width: 680, height: 700 });
    await ui.evaluate(() => { document.body.style.width = ''; });
    await vk.bringToFront();
    expect(await ui.evaluate(() => chrome.runtime.sendMessage({ type: 'CLOCK_EDIT' }))).toMatchObject({ success: true });
    await expect(clock).toHaveCSS('pointer-events', 'auto');
    const box = (await clock.boundingBox())!;
    await vk.mouse.move(box.x + 20, box.y + 20); await vk.mouse.down();
    await vk.mouse.move(450, 260, { steps: 10 }); await vk.mouse.up();
    await expect.poll(() => worker.evaluate(async () => JSON.parse((await chrome.storage.local.get('clock_settings')).clock_settings).position)).toBe('custom');
    await vk.keyboard.press('Escape');
    await expect(clock).toHaveCSS('pointer-events', 'none');
    await expect(vk.locator('.vkify-clock-toolbar')).toHaveCount(0);
    const moved = (await clock.boundingBox())!;
    await vk.evaluate(({ x, y }) => {
      const button = document.createElement('button'); button.id = 'under-clock'; button.textContent = 'Under clock';
      Object.assign(button.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: '300px', height: '70px' });
      button.onclick = () => { button.textContent = 'Clicked'; }; document.body.append(button);
    }, moved);
    await vk.mouse.click(moved.x + 20, moved.y + 20);
    await expect(vk.locator('#under-clock')).toHaveText('Clicked');
    await vk.reload();
    await expect(clock).toHaveCount(1);
    await expect.poll(async () => Math.abs((await clock.boundingBox())!.x - moved.x)).toBeLessThan(2);
    await vk.setViewportSize({ width: 320, height: 480 });
    const narrow = (await clock.boundingBox())!;
    expect(narrow.x).toBeGreaterThanOrEqual(0); expect(narrow.x + narrow.width).toBeLessThanOrEqual(321);
    await vk.screenshot({ path: testInfo.outputPath('clock-page.png') });
    await worker.evaluate(() => chrome.storage.local.set({ clock_enabled: false }));
    await expect(clock).toHaveCount(0);
    await worker.evaluate(() => chrome.storage.local.set({ language: 'ru' }));
    await expect(ui.getByRole('heading', { name: 'Часы', exact: true, level: 2 })).toBeVisible();
    await ui.getByText('Предпросмотр', { exact: true }).scrollIntoViewIfNeeded();
    await ui.screenshot({ path: testInfo.outputPath('clock-settings-ru.png') });
  } finally { await context.close(); }
});

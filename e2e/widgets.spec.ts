import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('widget glass controls, compact headers and stack buttons work in the built extension', async ({}, info) => {
  test.setTimeout(60000);
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const ui = await context.newPage();
    await ui.setViewportSize({ width: 680, height: 900 });
    await ui.goto(`chrome-extension://${id}/index.html`);
    await expect(ui.locator('#root.ready')).toBeVisible();
    await worker.evaluate(() => chrome.storage.local.set({
      onboarding_done: true, first_run: false, language: 'en', clock_enabled: true,
      clock_settings: JSON.stringify({ output: 'widget', showBackground: false }),
      'widget:clock': { position: { left: 100, top: 150 } },
      widgetStack: { glass: true, glassBlur: 12, glassOpacity: .3, animation: false },
    }));
    const vk = await context.newPage();
    await vk.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:linear-gradient(45deg,#18202f,#789);min-height:100vh"><div id="page_header_cont" style="height:48px"></div><div id="page_layout"></div></body></html>' }));
    await vk.goto('https://vk.ru/feed');
    const widget = vk.locator('[data-vkify-widget="clock"]');
    const head = widget.locator('.vkify-fw__head');
    await expect(widget).toBeVisible();
    await expect(widget).toHaveCSS('backdrop-filter', 'blur(12px) saturate(1.4)');
    await expect(widget).toHaveCSS('opacity', '1');
    const body = widget.locator('.vkify-fw__body');
    const originalBodyHeight = (await body.boundingBox())!.height;

    await ui.reload();
    await ui.getByRole('button', { name: 'Widgets', exact: true }).click();
    const clockRow = ui.locator('[data-vkify-anchor="widget:clock"]');
    await clockRow.locator('.dashboard-list-item__chevron').click();
    // Widget switches update after the async storage round trip, while check()
    // expects their state to change synchronously when the click completes.
    const hideHeader = clockRow.getByRole('switch', { name: 'Clock: Hide header', exact: true });
    await expect(hideHeader).not.toBeChecked();
    await hideHeader.click();
    await expect(hideHeader).toBeChecked();
    await vk.mouse.move(0, 0);
    await expect(head).toHaveCSS('opacity', '0');
    // The clock keeps its user-resizable outer height. A compact header frees
    // space for the body rather than shrinking the entire panel.
    await expect(head).toHaveCSS('position', 'absolute');
    await expect.poll(async () => (await body.boundingBox())!.height).toBeGreaterThan(originalBodyHeight);
    await expect(widget.locator('.vkify-fw__title')).toBeHidden();
    await widget.hover();
    await expect(head).toHaveCSS('opacity', '1');
    const stackButton = head.locator('[data-stack-toggle]');
    for (const stacked of [true, false, true, false]) {
      await widget.hover();
      await stackButton.locator('svg').click();
      await expect(widget).toHaveClass(stacked ? /is-stacked/ : /^(?!.*is-stacked)/);
    }
    await vk.mouse.move(0, 0);
    await vk.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await expect(head).toHaveCSS('opacity', '0');
    await stackButton.focus();
    await expect(head).toHaveCSS('opacity', '1');
    await stackButton.press('Enter');
    await expect(widget).toHaveClass(/is-stacked/);

    const blur = ui.locator('#widget-glass-blur');
    await blur.focus(); await blur.press('End');
    await expect(widget).toHaveCSS('backdrop-filter', 'blur(60px) saturate(1.4)');
    const opacity = ui.locator('#widget-glass-opacity');
    await opacity.focus(); await opacity.press('Home');
    await expect.poll(() => widget.evaluate(element => getComputedStyle(element).backgroundColor)).toMatch(/\/ 0\)/);
    await expect(widget).toHaveCSS('opacity', '1');
    await ui.reload();
    await ui.getByRole('button', { name: 'Widgets', exact: true }).click();
    await expect(ui.locator('#widget-glass-blur')).toHaveValue('60');
    await expect(ui.locator('#widget-glass-opacity')).toHaveValue('0');
    await ui.screenshot({ path: info.outputPath('widget-settings.png'), fullPage: true });
    await widget.hover();
    await vk.screenshot({ path: info.outputPath('compact-widget.png') });
    await clockRow.locator('.dashboard-list-item__chevron').click();
    const autoHide = clockRow.getByRole('switch', { name: 'Clock: Auto-hide at screen edge', exact: true });
    await expect(autoHide).not.toBeChecked();
    await autoHide.click();
    await expect(autoHide).toBeChecked();
    await worker.evaluate(async () => {
      const stored = (await chrome.storage.local.get('widget:clock'))['widget:clock'];
      await chrome.storage.local.set({ 'widget:clock': { ...stored, mode: 'free', position: { left: 16, top: 150 } } });
    });
    await vk.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await vk.mouse.move(500, 500);
    await expect(widget).toHaveAttribute('data-auto-hide-edge', 'left');
    await expect.poll(async () => { const box = (await widget.boundingBox())!; return Math.round(box.x + box.width); }).toBe(18);
    await vk.mouse.move(9, 160);
    await expect.poll(async () => Math.round((await widget.boundingBox())!.x)).toBe(0);
    await vk.mouse.move(500, 500);
    await expect.poll(async () => { const box = (await widget.boundingBox())!; return Math.round(box.x + box.width); }).toBe(18);
    await autoHide.click();
    await expect(autoHide).not.toBeChecked();
    await expect(widget).not.toHaveAttribute('data-auto-hide-edge');
    await expect.poll(async () => Math.round((await widget.boundingBox())!.x)).toBe(16);
  } finally { await context.close(); }
});

import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('conversation wallpaper saves from the popup, follows new histories and resets cleanly', async ({}, info) => {
  test.setTimeout(60000);
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: false, language: 'en',
      messenger_background: false, custom_background: '', wallpaper_schedule_enabled: false }));
    const ui = await context.newPage();
    await ui.setViewportSize({ width: 680, height: 1000 });
    await ui.goto(`chrome-extension://${id}/index.html`);
    await expect(ui.locator('#root.ready')).toBeVisible();
    await ui.getByRole('button', { name: 'Center', exact: true }).click();
    await ui.getByRole('button', { name: /^Messenger/ }).click();
    await ui.getByRole('button', { name: /^Conversation background/ }).click();
    await expect(ui.getByRole('switch', { name: 'Enable conversation background' })).not.toBeChecked();
    expect(await ui.locator('[aria-label="Preview"]').textContent()).toBe('');
    const menu = ui.getByRole('group', { name: 'Background type', exact: true });
    expect(await menu.getByRole('button').count()).toBe(4);
    expect(await menu.locator('svg').count()).toBe(4);
    const vk = await context.newPage();
    await vk.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: `<html><style>
      body { margin:0 } .MEApp__route{display:flex;height:600px}.sidebar{width:220px;background:rgb(30,40,50)}
      .ConvoMain{width:600px;position:relative}.ConvoMain__themeWrapper{position:relative;overflow:hidden}.ConvoMain__history{height:400px;position:relative;overflow:hidden}.ConvoHeader,.composer{height:60px;background:rgb(60,70,80)}
      .ConvoHistory{height:400px;position:relative;background:rgb(90,100,110)}.ConvoHistory__wrapper{height:100%}.ConvoHistory__scrollbar{height:100%;overflow:auto}.ConvoHistory__content{background:rgb(90,100,110);height:1000px}
      .ConvoMessageBubble{background:rgb(120,130,140);padding:20px;width:200px}
      </style><body><div id="page_header_cont"></div><div id="page_layout"></div><div class="MEApp"><div class="MEApp__route">
      <aside class="sidebar MEApp__mainPanel">Conversations</aside><main class="ConvoMain"><header class="ConvoHeader">Chat</header>
      <div class="ConvoMain__themeWrapper"><div class="ConvoMain__popupWrapper"><div class="ConvoMain__history"><div class="ConvoHistory"><div class="ConvoHistory__wrapper"><div class="ConvoHistory__scrollbar"><div class="ConvoHistory__scrollbar-content"><div class="ConvoHistory__content"><div class="ConvoHistory__flow"><div class="ConvoMessageBubble">Message</div></div></div></div></div></div></div></div><footer class="composer ConvoMain__composerWrapper">Write</footer></div></div>
      </main></div></div></body></html>` }));
    await vk.goto('https://vk.ru/im/convo/123');
    const history = vk.locator('.ConvoHistory');
    await expect(history).toHaveCSS('background-color', 'rgb(90, 100, 110)');
    await ui.getByRole('switch', { name: 'Enable conversation background' }).click();
    await expect(vk.locator('html')).toHaveAttribute('data-vkify-messenger_background');
    // Captured live VK hierarchy: the history and the list are in sibling panels.
    expect(await vk.locator('.MEApp__mainPanel .ConvoHistory').count()).toBe(0);
    const layer = () => vk.locator('.ConvoMain__history').evaluate(el => getComputedStyle(el, '::before').backgroundImage);
    const overlay = () => vk.locator('.ConvoMain__history').evaluate(el => getComputedStyle(el, '::after').backgroundImage);
    await expect.poll(layer).toContain('radial-gradient');
    await expect(history).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await ui.getByRole('button', { name: 'Aurora', exact: true }).click();
    await expect(ui.getByRole('button', { name: 'Aurora', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await ui.getByRole('button', { name: 'Color', exact: true }).click();
    await ui.getByRole('button', { name: 'Custom color', exact: true }).click();
    await expect(ui.getByRole('dialog', { name: 'Custom color', exact: true })).toBeVisible();
    expect(await ui.locator('input[type="color"]').count()).toBe(0);
    await ui.getByRole('button', { name: 'Custom color', exact: true }).click();
    await expect(vk.locator('.sidebar')).toHaveCSS('background-color', 'rgb(30, 40, 50)');
    await expect(vk.locator('.ConvoHeader')).toHaveCSS('background-color', 'rgb(60, 70, 80)');
    await expect(vk.locator('.composer')).toHaveCSS('background-color', 'rgb(60, 70, 80)');
    await expect(vk.locator('.ConvoMessageBubble')).toHaveCSS('background-color', 'rgb(120, 130, 140)');
    await ui.getByRole('button', { name: 'Image', exact: true }).click();
    await ui.locator('input[type="url"]').fill('javascript:alert(1)');
    await ui.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(ui.getByRole('alert')).toContainText('HTTP(S)');
    const png = Buffer.from(await ui.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, 640, 360);
      gradient.addColorStop(0, '#367a83'); gradient.addColorStop(.5, '#4e597c'); gradient.addColorStop(1, '#aa86a7');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 640, 360);
      return canvas.toDataURL('image/png').split(',')[1];
    }), 'base64');
    await vk.route('https://images.test/wallpaper.png', route => route.fulfill({ contentType: 'image/png', body: png }));
    await ui.locator('input[type="url"]').fill('https://images.test/wallpaper.png');
    await ui.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect.poll(() => layer()).toContain('https://images.test/wallpaper.png');
    await ui.locator('input[type="file"]').setInputFiles({ name: 'wallpaper.png', mimeType: 'image/png', buffer: png });
    await expect.poll(() => layer()).toContain('data:image/webp');
    await ui.getByRole('button', { name: 'Appearance', exact: true }).click();
    await ui.locator('#background_dim').fill('40');
    await expect.poll(overlay).toContain('0.4');
    await ui.locator('#background_blur').fill('12');
    await expect.poll(() => vk.locator('.ConvoMain__history').evaluate(el => getComputedStyle(el, '::before').filter)).toContain('blur(12px)');
    await expect(vk.locator('.ConvoMessageBubble')).toHaveCSS('filter', 'none');
    await vk.screenshot({path:info.outputPath('conversation-background.png')});
    await ui.evaluate(() => document.documentElement.classList.add('vkify-embedded'));
    await ui.locator('[data-vkify-pane], [data-vkify-scroller]').evaluateAll(elements => elements.forEach(el => el.scrollTop = 0));
    await ui.screenshot({ path: info.outputPath('background-popup.png'), fullPage: true });
    await ui.setViewportSize({ width: 380, height: 850 });
    expect(await ui.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await vk.evaluate(() => {
      const history = document.querySelector('.ConvoHistory')!;
      history.replaceWith(history.cloneNode(true));
    });
    await expect.poll(() => layer()).toContain('data:image/webp');
    await vk.reload();
    await expect.poll(() => layer()).toContain('data:image/webp');
    await ui.getByRole('button', { name: 'Reset background' }).click();
    await expect(vk.locator('html')).not.toHaveAttribute('data-vkify-messenger_background');
    await expect(history).toHaveCSS('background-color', 'rgb(90, 100, 110)');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('messenger_background')).messenger_background)).toBe(false);
  } finally { await context.close(); }
});

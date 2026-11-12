import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('message fills and left/right layout work independently on the observed VK message structure', async ({}, info) => {
  test.setTimeout(60000);
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: false, language: 'en',
      messenger_message_background: false, messenger_modern_messages: false }));
    const ui = await context.newPage();
    await ui.goto(`chrome-extension://${id}/index.html?embed=1`);
    await ui.setViewportSize({ width: 680, height: 1100 });
    await expect(ui.locator('#root.ready')).toBeVisible();
    // A fresh install can initialize first_run after the initial fixture write.
    await worker.evaluate(() => chrome.storage.local.set({ first_run: false, onboarding_done: true }));
    await ui.getByRole('button', { name: 'Center', exact: true }).click();
    await ui.getByRole('button', { name: /^Messenger/ }).click();
    await ui.getByRole('button', { name: /^Message appearance/ }).click();
    const vk = await context.newPage();
    const message = (out: boolean, text: string, extra = '') => `<section class="ConvoStack ConvoStack--withoutBubbles${out ? ' ConvoStack--out' : ''}"><div class="ConvoStack__content"><div class="VirtualScrollItem"><article class="ConvoHistory__messageBlock"><input type="checkbox" aria-label="Select message"><div class="ConvoHistory__messageWrapper"><div class="ConvoMessageWithoutBubble"><a class="ConvoMessageWithoutBubble__avatar" href="#author">A</a><div class="ConvoMessageWithoutBubble__wrapper"><div class="ConvoMessageWithoutBubble__content"><div class="ConvoMessageHeader">${out ? 'You' : 'Contact'}</div><div class="ConvoMessageWithoutBubble__text">${text}</div>${extra}<div class="ConvoMessageInfoWithoutBubbles">12:30</div></div></div><button class="ConvoMessage__actions" onclick="this.dataset.clicked='true'">Reply</button></div></div></article></div></div></section>`;
    await vk.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: `<style>
      :root{--vkui--color_background_secondary:#253247;--vkui--color_background_content:#222;--vkui--color_background_accent:#0077ff;--vkui--color_text_primary:#eee}*{box-sizing:border-box}body{margin:0;background:#141820;color:#eee;font:14px Arial}.ConvoMain{width:840px;background:#222;padding:16px}
      .ConvoHistory__flow{display:flex;flex-direction:column;gap:12px}.ConvoStack{display:flex;width:100%}.ConvoStack__content{display:flex;flex-direction:column;align-items:flex-end;flex:1;min-width:0}.VirtualScrollItem{position:relative;width:100%}
      .ConvoHistory__messageBlock{position:relative;display:flex;padding:1px 22px;width:100%;min-width:0}.ConvoHistory__messageBlock>input{position:absolute;left:0;top:10px}
      .ConvoHistory__messageWrapper{flex:1;min-width:0;max-width:100%;position:relative}.ConvoMessageWithoutBubble{display:flex;flex-direction:column;align-items:flex-start;position:relative;width:100%;max-width:100%;padding:8px 8px 8px 54px}
      .ConvoMessageWithoutBubble__avatar{position:absolute;left:8px;top:8px;width:36px;height:36px;background:#586477;border-radius:50%;text-align:center;padding:10px;color:white}
      .ConvoMessageWithoutBubble__wrapper{display:flex;align-items:flex-start;width:100%}.ConvoMessageWithoutBubble__content{max-width:580px;width:580px}.ConvoMessageWithoutBubble__text{display:inline-block;max-width:100%}
      .ConvoMessage__actions{position:absolute;right:-5px;top:0}.ConvoMessageHeader{font-size:11px;font-weight:bold;margin-bottom:6px}.ConvoMessageInfoWithoutBubbles{font-size:10px;opacity:.7;margin-top:8px}
      .attachment{width:420px;height:120px;max-width:100%;background:linear-gradient(120deg,#075e80,#75468b);border-radius:8px;margin:8px 0}blockquote{margin:8px 0;border-left:2px solid;padding-left:8px}
      </style><div id="page_layout"></div><main class="ConvoMain"><div class="ConvoMain__history"><div class="ConvoHistory"><div class="ConvoHistory__flow">
      ${message(false, 'Hello! How does the new layout look?')}${message(true, 'My messages are on the right now.')}${message(false, 'Photo and quote', '<blockquote>Reply preview</blockquote><div class="attachment"></div>')}${message(true, 'https://example.com/' + 'long-url-'.repeat(35))}
      </div></div></div></main>` }));
    await vk.goto('https://vk.ru/im/convo/123');
    const incoming = vk.locator('.ConvoStack:not(.ConvoStack--out) .ConvoMessageWithoutBubble').first();
    const outgoing = vk.locator('.ConvoStack--out .ConvoMessageWithoutBubble').first();
    await ui.getByRole('switch', { name: 'Enable message backgrounds' }).click();
    await expect(vk.locator('html')).toHaveAttribute('data-vkify-messenger_message_background');
    await expect(ui.getByRole('button', { name: 'Theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const themeSurface = await incoming.evaluate(el => getComputedStyle(el).backgroundColor);
    await vk.locator('.ConvoMain').evaluate(el => {
      el.style.setProperty('--vkui--color_background_secondary', '#ffeedd');
      el.style.setProperty('--vkui--color_text_primary', '#111111');
    });
    await expect.poll(() => incoming.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(themeSurface);
    await expect(incoming).toHaveCSS('color', 'rgb(17, 17, 17)');
    await ui.getByRole('button', { name: 'Custom colors', exact: true }).click();
    await expect(incoming).toHaveCSS('background-color', 'rgba(37, 50, 71, 0.95)');
    await expect(outgoing).toHaveCSS('background-color', 'rgba(0, 119, 255, 0.95)');
    await expect(vk.locator('html')).not.toHaveAttribute('data-vkify-messenger_modern_messages');
    await ui.locator('[data-vkify-anchor="messenger_modern_messages"]').getByRole('switch').click();
    await expect(vk.locator('html')).toHaveAttribute('data-vkify-messenger_modern_messages');
    for (const width of [840, 360]) {
      await vk.locator('.ConvoMain').evaluate((el, width) => el.style.width = `${width}px`, width);
      const inside = await incoming.boundingBox(); const outside = await outgoing.boundingBox();
      expect(outside!.x + outside!.width).toBeGreaterThan(inside!.x + inside!.width + 5);
      const bounds = await vk.locator('.ConvoMain').boundingBox();
      for (const bubble of await vk.locator('.ConvoMessageWithoutBubble').all()) {
        const box = (await bubble.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(bounds!.x);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
      }
      await expect(vk.locator('.attachment')).toBeVisible();
    }
    await outgoing.getByRole('button', { name: 'Reply', exact: true }).click();
    await expect(outgoing.getByRole('button', { name: 'Reply', exact: true })).toHaveAttribute('data-clicked', 'true');
    await vk.getByRole('checkbox').first().check();
    await expect(vk.getByRole('checkbox').first()).toBeChecked();
    await vk.locator('.ConvoMain').evaluate(el => el.style.width = '840px');
    await vk.screenshot({ path: info.outputPath('message-layout.png') });
    await ui.screenshot({ path: info.outputPath('message-settings.png'), fullPage: true });
    await ui.getByRole('switch', { name: 'Enable message backgrounds' }).click();
    await expect(vk.locator('html')).not.toHaveAttribute('data-vkify-messenger_message_background');
    await expect(vk.locator('html')).toHaveAttribute('data-vkify-messenger_modern_messages');
    await ui.getByRole('button', { name: 'Reset message appearance' }).click();
    await expect(vk.locator('html')).not.toHaveAttribute('data-vkify-messenger_modern_messages');
    await expect(outgoing).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  } finally { await context.close(); }
});

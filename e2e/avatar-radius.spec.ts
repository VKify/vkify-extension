import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('avatar shapes use native geometry, survive new markup and restore all layers', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', '--disable-extensions-except='+extension, '--load-extension='+extension] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done:true, first_run:false, border_radius:12, avatar_radius_shape:'' }));
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType:'text/html', body:
      '<style>figure{margin:16px;position:relative;width:64px;height:64px;border-radius:50%}figure img{width:100%;height:100%;border-radius:inherit}figure div{position:absolute;inset:0;border-radius:inherit;pointer-events:none}#album{width:100px;height:100px;border-radius:8px}#photo{width:160px;height:100px}#audio{width:64px;height:64px;border-radius:50%}</style>'+
      '<figure id="avatar"><img><div aria-hidden="true"></div></figure><figure id="other"><img></figure><img id="album"><img id="photo"><img id="audio" src="https://example.com/cover?type=audio">' }));
    await page.goto('https://vk.ru/feed');
    await expect(page.locator('#avatar img')).toHaveCSS('border-radius','12%');
    await expect(page.locator('#avatar')).toHaveCSS('border-radius','12%');
    await expect(page.locator('#avatar div')).toHaveCSS('border-radius','12%');
    await expect(page.locator('#album')).toHaveCSS('border-radius','8px');
    await expect(page.locator('#photo')).not.toHaveAttribute('data-vkify-avatar-surface');
    await expect(page.locator('#audio')).not.toHaveAttribute('data-vkify-avatar-surface');
    for (const [shape, radius] of Object.entries({drop:'0 50% 50% 50%',leaf:'0 50% 0 50%',petal:'50% 0 50% 0',blob:'30% 70% 70% 30% / 30% 30% 70% 70%',arch:'50% 50% 12% 12%',shield:'12% 12% 50% 50% / 12% 12% 85% 85%',egg:'50% 50% 45% 45% / 65% 65% 35% 35%',pebble:'65% 35% 45% 55% / 55% 45% 35% 65%',pillow:'35% / 25%'})) {
      await worker.evaluate(shape => chrome.storage.local.set({ avatar_radius_shape:shape }), shape);
      await expect.poll(() => page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--vkify-avatar-radius').trim())).toBe(radius);
      await expect(page.locator('#avatar img')).toHaveCSS('border-radius', await page.locator('#avatar').evaluate(el => getComputedStyle(el).borderRadius));
    }
    await page.locator('#other').evaluate(el => { el.className='completely-new-hash'; el.innerHTML='<span style="display:block;width:64px;height:64px;border-radius:50%"><img style="width:64px;height:64px;border-radius:50%"></span>'; });
    await expect(page.locator('#other img')).toHaveAttribute('data-vkify-avatar-surface','');
    await page.locator('#other img').evaluate(el => { el.setAttribute('src','https://example.com/album?type=audio'); el.setAttribute('style','width:64px;height:64px;border-radius:8px'); });
    await expect(page.locator('#other img')).not.toHaveAttribute('data-vkify-avatar-surface');
    await worker.evaluate(() => chrome.storage.local.set({ avatar_radius_shape:'', border_radius:0 }));
    await expect(page.locator('#avatar img')).toHaveCSS('border-radius','0%');
    await worker.evaluate(() => chrome.storage.local.set({ avatar_radius_shape:'', border_radius:50 }));
    await expect(page.locator('[data-vkify-avatar-surface]')).toHaveCount(0);
    await expect(page.locator('#avatar img')).toHaveCSS('border-radius','50%');
    await expect(page.locator('#avatar div')).toHaveCSS('border-radius','50%');
  } finally { await context.close(); }
});

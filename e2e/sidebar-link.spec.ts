import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

test('VKify sidebar link responds to hover and keyboard focus using the current theme', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { tryInjectSidebarItem } from './src/content/embed/menu-item.ts';
      window.injectSidebar = () => tryInjectSidebarItem(document.querySelector('ol'));
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
    await page.setContent(`<!DOCTYPE html><html><head><style>
      :root { --vkui--vkontakte_background_hover_alpha: rgba(80, 120, 160, 0.12) }
      ol { list-style: none; padding: 0; width: 180px }
      li > a { display: flex; height: 32px; align-items: center; border-radius: 8px }
    </style></head><body><ol>
      <li id="l_faq" data-testid="leftmenuitem" class="vkit-IrzagA">
        <a class="vkit-IgMYrO vkuiInternalTappable GQPZ8m" href="/support">
          <div><svg width="20" height="20"></svg></div>
          <span data-testid="leftmenuitem-label"><span data-testid="leftmenuitem-text">Help</span></span>
          <span aria-hidden="true" class="_3Ikd78 cWBI3B"></span>
        </a>
      </li></ol><script>${bundle.outputFiles[0].text};window.injectSidebar();</script></body></html>`);
    const link = page.locator('#l_vkify_settings > a');
    await expect(link).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await link.hover();
    await expect(link).toHaveCSS('background-color', 'rgba(80, 120, 160, 0.12)');
    await page.evaluate(() => document.documentElement.style.setProperty('--vkui--vkontakte_background_hover_alpha', 'rgba(120, 80, 160, 0.2)'));
    await expect(link).toHaveCSS('background-color', 'rgba(120, 80, 160, 0.2)');
    await page.mouse.move(500, 500);
    await expect(link).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('background-color', 'rgba(120, 80, 160, 0.2)');
    await page.evaluate(() => {
      document.querySelector('#l_vkify_settings')!.remove();
      (window as unknown as { injectSidebar(): void }).injectSidebar();
    });
    await link.hover();
    await expect(link).toHaveCSS('background-color', 'rgba(120, 80, 160, 0.2)');
    await expect(page.locator('#vkify-menu-link-styles')).toHaveCount(1);
  } finally { await browser.close(); }
});

test('VKify mini-profile link supports updated typography and theme hover', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { tryInjectMenuItem } from './src/content/embed/menu-item.ts';
      window.injectProfile = () => tryInjectMenuItem(document.querySelector('[data-testid="header-profile-menu"]'));
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
    // Settings cell structure from the supplied EcoPlate HTML, without account data.
    await page.setContent(`<!DOCTYPE html><html><head><style>
      :root { --vkui--vkontakte_background_hover_alpha: rgba(80, 120, 160, 0.12) }
      a { display: flex; height: 40px; width: 280px; align-items: center }
    </style></head><body><div data-testid="header-profile-menu">
      <div class="EcoPlate-module_menu__Yq3E9">
        <a id="top_settings_link" href="/settings" class="EcoPlate-module_item__3LLqC vkuiInternalTappable zTqLtG BHuTU5 GQPZ8m">
          <div class="_26Qo2p"><span class="EcoPlate-module_itemIcon__4aHp9"><svg class="vkuiIcon" width="20" height="20"></svg></span></div>
          <div class="_4xuN9M"><div class="KXbj1S"><span class="bXUdSb vkuiTypography__host">
            <span class="zBcQvw vkuiTypography__host">Настройки</span><span class="ku8sgr">&nbsp;</span>
          </span></div></div><span aria-hidden="true" class="_3Ikd78 cWBI3B"></span>
        </a>
      </div></div><script>${bundle.outputFiles[0].text};window.injectProfile();</script></body></html>`);
    const link = page.locator('#top_vkify_settings_link');
    await expect(link).toHaveText('Настройки VKify');
    await expect(link).toHaveAttribute('href', '/vkify_settings');
    await expect(page.locator('#top_settings_link')).toHaveText('Настройки');
    await expect(link).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await link.hover();
    await expect(link).toHaveCSS('background-color', 'rgba(80, 120, 160, 0.12)');
    await page.evaluate(() => document.documentElement.style.setProperty('--vkui--vkontakte_background_hover_alpha', 'rgba(120, 80, 160, 0.2)'));
    await expect(link).toHaveCSS('background-color', 'rgba(120, 80, 160, 0.2)');
    await page.mouse.move(500, 500);
    await expect(link).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('background-color', 'rgba(120, 80, 160, 0.2)');
    await page.evaluate(() => {
      document.querySelector('#top_vkify_settings_link')!.remove();
      (window as unknown as { injectProfile(): void }).injectProfile();
      (window as unknown as { injectProfile(): void }).injectProfile();
    });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText('Настройки VKify');
    await link.hover();
    await expect(link).toHaveCSS('background-color', 'rgba(120, 80, 160, 0.2)');
    await expect(page.locator('#vkify-menu-link-styles')).toHaveCount(1);
  } finally { await browser.close(); }
});

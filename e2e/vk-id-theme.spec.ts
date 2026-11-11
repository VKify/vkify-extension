import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('VK ID palettes respect theme and accent across nested roots and reset', async ({ page }) => {
  const css = await readFile('src/content/features/appearance/theme/theme.css', 'utf8');
  for (const palette of ['vkAccessibility', 'vkAccessibilityIOS']) {
    for (const scheme of ['light', 'dark']) {
      const className = `vkui--${palette}--${scheme}`;
      // VK ID loads its palette after the extension stylesheet and repeats it
      // on body/app roots. Test that cascade, rather than only inherited tokens.
      await page.setContent(`<html class="${className}" data-vkify-theme data-vkify-accent
        style="--vkify-n15:#172a3d;--vkify-n15-solid:#172a3d;--vkify-eee:#edf1f5;--vkify-accent:#ef1234">
        <head><style>${css}</style><style>
          :root,.${className} { --vkui--color_background_content:white; --vkui--color_text_primary:black; --vkui--color_text_accent:blue; }
          #card { background:var(--vkui--color_background_content);color:var(--vkui--color_text_primary); }
          #link { color:var(--vkui--color_text_accent); }
        </style></head><body class="${className}"><main class="${className}">
        <div id="card">Card <a id="link">Action</a></div></main></body></html>`);
      await expect(page.locator('#card')).toHaveCSS('background-color', 'rgb(23, 42, 61)');
      await expect(page.locator('#card')).toHaveCSS('color', 'rgb(237, 241, 245)');
      await expect(page.locator('#link')).toHaveCSS('color', 'rgb(239, 18, 52)');
      await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-theme'));
      await expect(page.locator('#card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await expect(page.locator('#link')).toHaveCSS('color', 'rgb(239, 18, 52)');
      await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-accent'));
      await expect(page.locator('#link')).toHaveCSS('color', 'rgb(0, 0, 255)');
    }
  }
});

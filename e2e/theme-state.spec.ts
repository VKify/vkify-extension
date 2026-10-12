import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('theme CSS styles parser-created and SPA blocks, with stable updates and reset', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile('src/content/features/appearance/theme/theme.css', 'utf8');
    const script = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { createThemeFeatures } from './src/content/features/appearance/theme/feature.ts';
      import { applyThemeFromMirror } from './src/content/features/appearance/theme/mirror.ts';
      const data = { custom_theme:'#172a3d', custom_accent:'#ef1234', block_opacity:0.5, glass_blur:20 };
      localStorage.setItem('vkify:theme', JSON.stringify(data));
      applyThemeFromMirror();
      const features = createThemeFeatures({ getSetting: async key => data[key] });
      window.fixture = { data, features };
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
      <style>:root { --vkui--color_background_content:white; } .vkuiInternalGroup { height:40px; background:var(--vkui--color_background_content); }</style>
      <style>${css}</style><script>${script.outputFiles[0].text}</script></head><body>
      <div class="vkuiInternalGroup" id="block">Block</div>
      <a data-testid="top-logo-link"><svg width="136" height="24"><path fill="#07f" d="M0 0h24v24H0z"/></svg></a>
      <script>window.firstThemeFrame = { background:getComputedStyle(document.getElementById('block')).backgroundColor, glass:getComputedStyle(document.getElementById('block')).backdropFilter };</script>
      </body></html>` }));
    await page.goto('https://vk.ru/vkify');
    const first = await page.evaluate(() => (window as unknown as { firstThemeFrame: { background: string; glass: string } }).firstThemeFrame);
    expect(first.background).toMatch(/^rgba\(.*0\.5\)$/);
    expect(first.glass).toBe('blur(20px) saturate(1.6)');
    const call = async (key: string, value: unknown, disable = false): Promise<void> => {
      await page.evaluate(async ({ key, value, disable }) => {
        const f = (window as unknown as { fixture: { data: Record<string, unknown>; features: Record<string, { enable(value: unknown): Promise<void>; disable(): Promise<void> }> } }).fixture;
        f.data[key] = value;
        if (disable) await f.features[key].disable(); else await f.features[key].enable(value);
      }, { key, value, disable });
    };
    await call('custom_theme', '#172a3d');
    const mutations = await page.evaluate(async () => {
      const f = (window as unknown as { fixture: { features: { custom_accent: { enable(value: string): Promise<void> } } } }).fixture;
      const records: MutationRecord[] = [];
      const observer = new MutationObserver(batch => records.push(...batch));
      observer.observe(document.documentElement, { attributes: true });
      await f.features.custom_accent.enable('#ef1234');
      records.push(...observer.takeRecords()); observer.disconnect(); return records.length;
    });
    expect(mutations).toBe(0);
    await page.evaluate(() => { history.pushState({}, '', '/feed'); document.querySelector('#block')!.outerHTML = '<div id="block" class="vkuiInternalGroup">New block</div>'; });
    await expect(page.locator('#block')).toHaveCSS('backdrop-filter', 'blur(20px) saturate(1.6)');
    await call('glass_blur', 100);
    await expect(page.locator('#block')).toHaveCSS('backdrop-filter', 'blur(100px) saturate(2.2)');
    await call('block_opacity', 0, true);
    await expect(page.locator('#block')).toHaveCSS('background-color', /^rgba\(.*?, 0\)$/);
    await call('custom_theme', '', true);
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-theme');
    await expect(page.locator('#block')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('#block')).toHaveCSS('backdrop-filter', 'none');
    await expect(page.locator('[data-testid="top-logo-link"] path')).toHaveCSS('fill', 'rgb(238, 17, 50)');
    await call('custom_accent', '', true);
    await expect(page.locator('[data-testid="top-logo-link"] path')).toHaveCSS('fill', 'rgb(0, 119, 255)');
  } finally { await browser.close(); }
});

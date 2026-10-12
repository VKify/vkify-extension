import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('custom logo rendering, CSP, SPA recovery, compact sidebar and reset', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const markup = '<div id="page_header_cont"><ul id="page_header"><li class="TopNavigation__logo--x8I1c"><a data-testid="top-logo-link" class="Logo__root--gvE34" aria-label="На главную" accesskey="1" href="/feed"><svg class="Logo__icon--eLIzO" width="136" height="24"><rect width="24" height="24" fill="#07f" /></svg></a></li></ul></div>';
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: `<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="img-src 'self' data:"></head><body>${markup}</body></html>` }));
    await page.goto('https://vk.ru/vkify');
    const source = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="136" height="24"><rect width="136" height="24" rx="6" fill="#e91e63"/><text x="68" y="17" text-anchor="middle" font-family="Arial" font-size="16" fill="white">My VK</text></svg>').toString('base64');
    const script = await build({
      stdin: { resolveDir: process.cwd(), contents: `
        import { createCustomLogoHandler } from './src/content/features/appearance/layout/custom-logo.ts';
        const data = { custom_logo: ${JSON.stringify(source)} };
        const handler = createCustomLogoHandler({
          getSetting: async key => data[key],
          injectCSS(id, css) {
            let style = document.getElementById(id);
            if (!style) { style = document.createElement('style'); style.id = id; document.head.append(style); }
            if (style.textContent !== css) style.textContent = css;
          },
          removeCSS(id) { document.getElementById(id)?.remove(); },
          observeChanges(id, callback) {
            const observer = new MutationObserver(callback);
            observer.observe(document.body, { childList:true, subtree:true });
            return () => observer.disconnect();
          }
        });
        window.fixture = { data, handler };
        handler.enable();
      ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') },
      plugins: [{ name: 'inline-css', setup(builder) {
        builder.onResolve({ filter: /\.css\?inline$/ }, args => ({ path: resolve(args.resolveDir, args.path.replace('?inline', '')), namespace: 'inline-css' }));
        builder.onLoad({ filter: /.*/, namespace: 'inline-css' }, async args => ({ contents: `export default ${JSON.stringify(await readFile(args.path, 'utf8'))}`, loader: 'js' }));
      } }],
    });
    await page.addScriptTag({ content: script.outputFiles[0].text });
    const link = page.getByTestId('top-logo-link');
    await expect(link.locator('img')).toBeVisible(); await expect(link.locator('svg')).toBeHidden();
    await expect(link.locator('img')).toHaveCSS('width', '136px');
    await expect(link).toHaveAttribute('href', '/feed'); await expect(link).toHaveAttribute('aria-label', 'На главную');
    const logo = link.locator('.vkify-custom-logo');
    const setMode = async (mode: string, color = '#123456'): Promise<void> => {
      await page.evaluate(async ({ mode, color }) => {
        const f = (window as unknown as { fixture: { data: Record<string, unknown>; handler: { enable(): Promise<void> } } }).fixture;
        f.data.custom_logo_color_mode = mode; f.data.custom_logo_color = color; await f.handler.enable();
      }, { mode, color });
    };
    const tintColor = () => logo.evaluate(el => getComputedStyle(el, '::after').backgroundColor);
    await setMode('custom');
    await expect(link.locator('img')).toBeHidden();
    await expect.poll(tintColor).toBe('rgb(18, 52, 86)');
    expect(await logo.evaluate(el => getComputedStyle(el, '::after').maskImage)).toContain('data:image/svg+xml');
    await setMode('theme');
    await page.evaluate(() => document.documentElement.style.setProperty('--vkify-accent', '#ef1234'));
    await expect.poll(tintColor).toBe('rgb(239, 18, 52)');
    await page.evaluate(() => document.documentElement.style.setProperty('--vkify-accent', '#16a058'));
    await expect.poll(tintColor).toBe('rgb(22, 160, 88)');
    await setMode('text');
    await expect(logo).toHaveAttribute('data-color-mode', 'original');
    await expect(link.locator('img')).toBeVisible();
    await setMode('original');
    await expect(link.locator('img')).toBeVisible();
    expect(await logo.evaluate(el => getComputedStyle(el, '::after').content)).toBe('none');
    await page.screenshot({ path: info.outputPath('custom-logo.png') });
    await page.evaluate(html => {
      history.pushState({}, '', '/feed'); document.querySelector('#page_header_cont')!.outerHTML = html;
    }, markup);
    await expect(link.locator('img')).toBeVisible(); await expect(link.locator('img')).toHaveCount(1);
    await page.addStyleTag({ content: await readFile('src/content/features/appearance/sidebar/minimalistic-sidebar.css', 'utf8') });
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-minimalistic_sidebar', ''));
    await expect(link.locator('img')).toHaveCSS('width', '24px');
    await page.evaluate(async () => {
      const f = (window as unknown as { fixture: { data: { custom_logo: string }; handler: { enable(): Promise<void> } } }).fixture;
      f.data.custom_logo = 'https://blocked.example/logo.png'; await f.handler.enable();
    });
    await expect(link.locator('svg')).toBeVisible();
    await page.evaluate(() => (window as unknown as { fixture: { handler: { disable(): void } } }).fixture.handler.disable());
    await expect(link.locator('img')).toHaveCount(0); await expect(link.locator('svg')).toBeVisible();
  } finally { await browser.close(); }
});

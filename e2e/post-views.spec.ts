import { test, expect, chromium } from '@playwright/test';
import { build } from './esbuild-fixture.js';
import { readFile } from 'node:fs/promises';

test('view counts fit the native footer, load near the viewport, and clean up on disable', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 620 } });
    const css = await readFile('src/content/features/center/feed/post-views.css', 'utf8');
    const post = (key: string) => `<article data-testid="post" data-post-id="${key}"><header>VKify</header><p>Текст записи в ленте</p><footer><button>♡ 24</button><button>Комментарий</button><div><a data-testid="post_date_block_preview">8 мин назад</a></div></footer></article>`;
    await page.setContent(`<style>body{margin:16px;font:13px Arial;background:#19191a;color:#ddd}article{border-radius:12px;padding:16px;background:#232324;margin-bottom:16px}header{font-weight:bold}p{margin:24px 0}footer{display:flex;align-items:center;gap:12px}footer>div{margin-left:auto}a{color:#818c99}button{color:#999;background:none;border:0;padding:0} ${css}</style>${post('-1_2')}<div style="height:1600px"></div>${post('3_4')}`);
    const script = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      import { postViewsFeature } from './src/content/features/center/feed/post-views.ts';
      window.chrome = { runtime: { id: 'fixture' } } as any;
      window.calls = [];
      const observers: MutationObserver[] = [];
      const cleanup = postViewsFeature.plugins.find(p => p.name === 'post-views').setup({
        vkApi: { call: async (_method, params) => { window.calls.push(params.posts); return params.posts.split(',').map(key => { const [owner_id,id] = key.split('_').map(Number); return {owner_id,id,views:{count:id===2?35:12400}}; }); } },
        registerMutationObserver: (selector, callback) => document.querySelectorAll(selector).forEach(callback),
        observeChanges: (callback, {container}) => { const observer = new MutationObserver(callback); observer.observe(container,{childList:true,subtree:true}); observers.push(observer); return () => observer.disconnect(); },
      } as any);
      document.documentElement.setAttribute('data-vkify-post_views','');
      window.disable = () => { cleanup(); observers.forEach(o=>o.disconnect()); document.documentElement.removeAttribute('data-vkify-post_views'); };
    ` }, bundle: true, write: false, format: 'iife', define: { 'import.meta.env.DEV': 'false', __VKIFY_SITE_URL__: '"https://vkify.ru"' }, tsconfig: 'tsconfig.app.json' });
    await page.addScriptTag({ content: script.outputFiles[0].text });
    const first = page.getByTestId('post').first(), second = page.getByTestId('post').last();
    await expect(first.locator('[data-vkify-post-views]')).toHaveAttribute('aria-label', /35/);
    expect(await page.evaluate(() => (window as any).calls)).toEqual(['-1_2']);
    const badge = await first.locator('[data-vkify-post-views]').boundingBox();
    const date = await first.getByTestId('post_date_block_preview').boundingBox();
    expect(badge!.x + badge!.width).toBeLessThanOrEqual(date!.x);
    expect(Math.abs(badge!.y - date!.y)).toBeLessThan(4);
    const textAlignment = await first.evaluate(post => {
      const bounds = (element: Element) => {
        const range = document.createRange(); range.selectNodeContents(element); return range.getBoundingClientRect();
      };
      const count = bounds(post.querySelector('[data-vkify-post-views] > span')!);
      const date = bounds(post.querySelector('[data-testid="post_date_block_preview"]')!);
      return { top: Math.abs(count.top - date.top), bottom: Math.abs(count.bottom - date.bottom) };
    });
    expect(textAlignment.top).toBeLessThanOrEqual(1);
    expect(textAlignment.bottom).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('post-views.png') });
    await second.scrollIntoViewIfNeeded();
    await expect(second.locator('[data-vkify-post-views]')).toHaveAttribute('aria-label', /12.*400/);
    expect(await page.evaluate(() => (window as any).calls)).toEqual(['-1_2', '3_4']);
    await page.evaluate(() => (window as any).disable());
    await expect(page.locator('[data-vkify-post-views], [data-vkify-post-meta]')).toHaveCount(0);
  } finally { await browser.close(); }
});

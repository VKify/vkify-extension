import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';

test('embed waits for authenticated popup height before posting viewport data', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    let release!: () => void;
    const loading = new Promise<void>(resolve => { release = resolve; });
    const errors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('http://vkify.test/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="layout_sidebar">Menu</div><div id="page_body" style="width:600px;height:2000px"><div id="spa_layout_content"><button id="native-placeholder" style="visibility:visible">Nothing found on VK</button></div></div>' }));
    await page.route('http://extension.test/**', async route => {
      await loading;
      await route.fulfill({ contentType: 'text/html', body: `<script>
        window.viewports = [];
        addEventListener('message', e => { if(e.origin === 'http://vkify.test') viewports.push(e.data); });
        parent.postMessage({ type:'VKIFY_EMBED_HEIGHT', height:600 }, 'http://vkify.test');
        </script>` });
    });
    await page.goto('http://vkify.test/vkify_settings');
    const bundle = await build({
      stdin: { resolveDir: process.cwd(), contents: `
        import { syncWithRoute } from './src/content/embed/host.ts';
        window.chrome = {
          runtime:{getURL:()=> 'http://extension.test/index.html'},
          storage:{local:{get:async()=>({})},onChanged:{addListener(){},removeListener(){}}}
        };
        window.syncEmbed = syncWithRoute;
        syncWithRoute();
      ` }, bundle: true, write: false, format: 'iife', tsconfig: 'tsconfig.app.json',
    });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.locator('#vkify-embed-iframe')).toBeAttached();
    await expect(page.locator('#native-placeholder')).toBeHidden();
    await expect(page.locator('#layout_sidebar')).toBeVisible();
    expect((await page.locator('#page_body').boundingBox())!.height).toBe(2000);
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#vkify-embed-iframe')!;
      // Same source but wrong origin must not mark the iframe ready.
      dispatchEvent(new MessageEvent('message', {
        source: frame.contentWindow, origin: location.origin,
        data: { type: 'VKIFY_EMBED_HEIGHT', height: 600 },
      }));
      dispatchEvent(new Event('resize'));
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(errors).toEqual([]);
    release();
    await expect.poll(() => page.frames().find(frame => frame.url().startsWith('http://extension.test'))?.evaluate(() =>
      (window as unknown as { viewports: { type: string }[] }).viewports.some(data => data.type === 'VKIFY_EMBED_VIEWPORT'))).toBe(true);
    // The visible-area floor may make computed height larger than popup content.
    await expect.poll(() => page.locator('#vkify-embed-iframe').evaluate(el => (el as HTMLElement).style.height)).toBe('600px');
    expect(errors).toEqual([]);
    // Browser zoom reduces available CSS viewport size; native content remains
    // hidden even when it extends below the iframe at each viewport size.
    for (const width of [1280, 800, 640]) {
      await page.setViewportSize({ width, height: 500 });
      await expect(page.locator('#native-placeholder')).toBeHidden();
      await expect(page.locator('#vkify-embed-iframe')).toBeVisible();
    }
    await page.evaluate(() => {
      history.pushState({}, '', '/00x69');
      (window as unknown as { syncEmbed(): void }).syncEmbed();
    });
    await expect(page.locator('#native-placeholder')).toBeVisible();
    await expect(page.locator('#vkify-embed-iframe')).toHaveCount(0);
  } finally { await browser.close(); }
});

import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

test('widget reconciliation stays idle and repairs SPA removals in Chromium', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body><main>VK fixture</main></body>' }));
    await page.goto('https://vk.ru/feed');
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { createFloatingWidget } from './src/content/ui/floating-widget.ts';
      import { widgetStack } from './src/content/ui/widget-stack.ts';
      import { storage } from './src/content/core/storage.ts';
      const values = {};
      window.chrome = { runtime: { id: 'fixture' }, storage: {
        local: { get: async () => ({ ...values }), set: async patch => Object.assign(values, patch), remove: async key => delete values[key] },
        onChanged: { addListener() {}, removeListener() {} }
      }};
      window.widgets = ['a', 'b'].map(id => {
        const w = createFloatingWidget({ id, title: id }); w.body.textContent = 'Content'; w.mount(); return w;
      });
      window.refreshWidgets = () => { window.widgets.forEach(w => w.reattach()); widgetStack.refresh(); };
      window.setWidgetSettings = patch => storage.setMultiple(patch);
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') },
    define: { 'import.meta.env.DEV': 'false' } });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.locator('.vkify-fw')).toHaveCount(2);
    await page.evaluate(async () => {
      await (window as any).setWidgetSettings({ widgetStack: { animation: true }, 'widget:a': { mode: 'stacked', order: 0 }, 'widget:b': { mode: 'stacked', order: 1 } });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const idle = await page.evaluate(() => {
      const observer = new MutationObserver(() => {}); observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true });
      let measurements = 0;
      const roots = (window as any).widgets.map((w: any) => w.root as HTMLElement);
      const originals = roots.map((root: HTMLElement) => root.getBoundingClientRect);
      roots.forEach((root: HTMLElement, i: number) => { root.getBoundingClientRect = () => { measurements++; return originals[i].call(root); }; });
      for (let i = 0; i < 50; i++) (window as any).refreshWidgets();
      const records = observer.takeRecords().length; observer.disconnect();
      roots.forEach((root: HTMLElement, i: number) => { root.getBoundingClientRect = originals[i]; });
      return { records, measurements };
    });
    expect(idle).toEqual({ records: 0, measurements: 0 });
    await page.evaluate(() => { document.querySelector('.vkify-stack')!.remove(); (window as any).refreshWidgets(); });
    await expect(page.locator('.vkify-stack')).toHaveCount(1);
    await expect(page.locator('.vkify-stack__items > .vkify-fw')).toHaveCount(2);
    await page.evaluate(() => (window as any).setWidgetSettings({ 'widget:a': { mode: 'free', position: { left: 40, top: 100 }, autoHide: true } }));
    await expect(page.locator('[data-vkify-widget="a"]')).not.toHaveClass(/is-stacked/);
    await page.setViewportSize({ width: 600, height: 500 });
    await expect.poll(async () => {
      const box = await page.locator('.vkify-stack').boundingBox();
      return box ? box.x + box.width <= 600 && box.y + box.height <= 500 : false;
    }).toBe(true);
  } finally { await browser.close(); }
});

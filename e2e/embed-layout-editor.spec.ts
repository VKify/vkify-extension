import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

test('page layout editor stays fixed while the real settings iframe moves and resizes', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.route('http://vkify.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body></body></html>' }));
    await page.route('http://extension.test/**', route => route.fulfill({ contentType: 'text/html', body: `
      <button id="edit" onclick="parent.postMessage({type:'VKIFY_LAYOUT_EDIT',target:'page_offset_value'},'http://vkify.test')">Move on VK</button>
    ` }));
    await page.goto('http://vkify.test/vkify_settings');
    await page.setContent(`<style>
      body { margin:0; background:#edeef0; }
      #page_header,#page_layout,#footer_wrap { width:min(1000px,100vw);margin:auto; }
      #page_header { height:48px;background:#0077ff; }
      #page_body { width:calc(100% - 170px);margin-left:170px;height:600px; }
    </style><div id="page_header"></div><div id="page_layout"><div id="page_body"></div></div><div id="footer_wrap"></div>`);
    for (const file of ['widescreen', 'page-offset']) {
      await page.addStyleTag({ content: await readFile(`src/content/features/appearance/layout/${file}.css`, 'utf8') });
    }
    const script = await build({
      stdin: { resolveDir: process.cwd(), contents: `
        import { syncWithRoute } from './src/content/embed/host.ts';
        import { widescreenFeature } from './src/content/features/appearance/layout/widescreen.ts';
        import { pageOffsetFeature } from './src/content/features/appearance/layout/page-offset.ts';
        async function init() {
        const data = { content_width_enabled:true,content_width:1100,page_offset_enabled:true,page_offset_value:50 };
        const listeners = new Set();
        const features = [widescreenFeature,pageOffsetFeature].map(def => ({
          def,plugin:def.plugins.find(p => p.name === 'derived-css'),
          ctx:{ id:def.id,getSetting:async key=>data[key],raw:{
            enableCss:id=>document.documentElement.setAttribute('data-vkify-'+id,''),
            disableCss:id=>document.documentElement.removeAttribute('data-vkify-'+id),
            injectCSS(){},removeCSS(){}
          } }
        }));
        const apply = async () => { for (const {def,plugin,ctx} of features) {
          ctx.value=undefined;
          if(data[def.id]) await plugin.onEnable(ctx); else await plugin.onDisable(ctx);
        } };
        window.fixture={ data,writes:[],messages:[],fail:false };
        window.chrome={
          runtime:{getURL:()=> 'http://extension.test/popup',sendMessage:async message=>{
            window.fixture.messages.push(message);
            if(window.fixture.holdPreview) await new Promise(resolve=>window.fixture.releasePreview=resolve);
            const feature=features.find(f=>f.def.id===message.featureId);
            if(feature){feature.ctx.value=message.value;await feature.plugin.onEnable(feature.ctx);}
            return {success:true};
          }},
          storage:{local:{get:async()=>({...data}),set:async patch=>{
            if(window.fixture.fail) throw Error('fixture write failed');
            window.fixture.writes.push(patch);
            if(window.fixture.holdWrite) await new Promise(resolve=>window.fixture.releaseWrite=resolve);
            const changes=Object.fromEntries(Object.entries(patch).map(([key,newValue])=>[key,{newValue}]));
            Object.assign(data,patch);await apply();listeners.forEach(listener=>listener(changes,'local'));
          }},onChanged:{addListener:l=>listeners.add(l),removeListener:l=>listeners.delete(l)}}
        };
        window.syncEmbed=syncWithRoute;
        await apply(); syncWithRoute();
        }
        void init();
      ` },
      bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.app.json',
    });
    await page.addScriptTag({ content: script.outputFiles[0].text });
    const frame = page.frameLocator('#vkify-embed-iframe');
    await frame.locator('#edit').click();
    const editor = page.locator('#vkify-layout-editor');
    await expect(editor).toBeVisible();
    const original = await editor.boundingBox();
    const host = page.locator('#vkify-embed-host');
    const initialHost = await host.boundingBox();
    const initialFloor = await host.evaluate(el => el.style.minHeight);
    await page.evaluate(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 500); });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await host.evaluate(el => el.style.minHeight)).toBe(initialFloor);
    await page.evaluate(() => { window.scrollTo(0, 0); document.body.style.minHeight = ''; });
    const offset = editor.locator('#vkify-layout-page_offset_value');
    await offset.focus();
    await page.keyboard.press('End');
    await expect.poll(() => host.evaluate(el => el.getBoundingClientRect().x)).toBe(670);
    expect((await editor.boundingBox())?.x).toBe(original?.x);
    const width = editor.locator('#vkify-layout-content_width');
    await width.focus();
    await page.keyboard.press('Home');
    await expect(host).toHaveCSS('width', '730px');
    expect((await host.boundingBox())?.width).not.toBe(initialHost?.width);
    expect((await editor.boundingBox())?.x).toBe(original?.x);
    await editor.locator('#vkify-layout-content_width_enabled').uncheck();
    await expect(width).toBeDisabled();
    await expect(host).toHaveCSS('width', '830px');
    await editor.locator('#vkify-layout-content_width_enabled').check();
    await expect(width).toBeEnabled();
    await expect(host).toHaveCSS('width', '730px');

    // During pointer drag the page follows live CSS, before releasing to commit.
    const rect = (await offset.boundingBox())!;
    await page.mouse.move(rect.x + rect.width - 8, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + 8, rect.y + rect.height / 2, { steps: 12 });
    await expect.poll(() => host.evaluate(el => el.getBoundingClientRect().x)).toBeLessThan(250);
    const anchor = await page.locator('#page_body').boundingBox();
    expect((await host.boundingBox())?.x).toBe(anchor?.x);
    expect((await editor.boundingBox())?.x).toBe(original?.x);
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.page_offset_value)).toBeLessThan(10);
    await page.screenshot({ path: info.outputPath('page-layout-editor.png') });

    await editor.getByRole('button', { name: /По центру|Center page/ }).click();
    await expect(offset).toHaveValue('50');
    await expect(editor.getByRole('button', { name: /По центру|Center page/ })).toBeDisabled();

    // A late storage echo cannot snap the control back during a newer edit.
    await page.evaluate(() => { (window as any).fixture.holdWrite = true; });
    await offset.focus();
    await page.keyboard.press('End');
    await expect.poll(() => page.evaluate(() => typeof (window as any).fixture.releaseWrite)).toBe('function');
    await page.keyboard.press('Home');
    await page.evaluate(() => { const f = (window as any).fixture; f.holdWrite = false; f.releaseWrite(); });
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.page_offset_value)).toBe(0);
    await expect(offset).toHaveValue('0');

    // Disabling a feature waits for its slow preview to finish, so it cannot
    // accidentally be enabled again by an older IPC response.
    await page.evaluate(() => { (window as any).fixture.holdPreview = true; });
    await offset.focus();
    await page.keyboard.press('End');
    await expect.poll(() => page.evaluate(() => typeof (window as any).fixture.releasePreview)).toBe('function');
    await editor.locator('#vkify-layout-page_offset_enabled').uncheck();
    await page.evaluate(() => { const f = (window as any).fixture; f.holdPreview = false; f.releasePreview(); });
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.page_offset_enabled)).toBe(false);
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-page_offset');
    await editor.locator('#vkify-layout-page_offset_enabled').check();

    await editor.getByRole('button', { name: /Готово|Done/ }).click();
    await expect(editor).toHaveCount(0);
    await frame.locator('#edit').click();
    await offset.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.page_offset_value)).toBe(100);

    // A manual adjustment must also release Music's automatic page offset,
    // just like the original popup setting does.
    await page.evaluate(() => Object.assign((window as any).fixture.data, {
      music_lyrics: true,
      music_page_offset_restore: JSON.stringify({ enabled: false, value: 50, applied: 100 }),
    }));
    await frame.locator('#edit').click();
    await offset.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.music_page_offset_restore)).toBe('');
    expect(await page.evaluate(() => JSON.parse((window as any).fixture.data.music_lyrics_settings).lyricsAvoidContent)).toBe(false);

    // Failed writes keep the controls and selected value available for retry.
    await page.evaluate(() => { (window as any).fixture.fail = true; });
    await offset.focus();
    await page.keyboard.press('End');
    await editor.getByRole('button', { name: /Готово|Done/ }).click();
    await expect(editor.getByRole('alert')).not.toBeEmpty();
    await expect(editor).toBeVisible();
    await page.evaluate(() => { (window as any).fixture.fail = false; });
    await editor.getByRole('button', { name: /Готово|Done/ }).click();
    await expect(editor).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as any).fixture.data.page_offset_value)).toBe(100);

    // Untrusted messages cannot open the editor.
    await page.evaluate(() => window.postMessage({ type: 'VKIFY_LAYOUT_EDIT', target: 'content_width' }, '*'));
    await expect(editor).toHaveCount(0);
    await frame.locator('#edit').click();
    await page.setViewportSize({ width: 400, height: 800 });
    await expect(editor).toBeVisible();
    expect(await editor.evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await expect(editor.getByText(/Чтобы сместить страницу|Reduce its width/)).toBeVisible();
    await page.screenshot({ path: info.outputPath('page-layout-editor-narrow.png') });
    await page.setViewportSize({ width: 400, height: 220 });
    expect(await editor.evaluate(el => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
    await page.evaluate(() => { history.pushState({}, '', '/feed'); (window as any).syncEmbed(); });
    await expect(editor).toHaveCount(0);
    await expect(host).toHaveCount(0);
  } finally { await browser.close(); }
});

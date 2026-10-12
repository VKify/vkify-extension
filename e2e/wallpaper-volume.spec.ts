import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';

test('YouTube wallpaper volume crosses iframe origins, mutes zero and keeps the player loaded', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
    await page.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: `<body>
      <output id="state" data-volume="100" data-muted="true"></output>
      <script>
        window.addEventListener('message', event => {
          if (event.origin !== 'https://vk.ru') return;
          const data = JSON.parse(event.data);
          if (data.event !== 'command') return;
          const state = document.querySelector('#state');
          if (data.func === 'setVolume') state.dataset.volume = String(data.args[0]);
          if (data.func === 'mute') state.dataset.muted = 'true';
          if (data.func === 'unMute') state.dataset.muted = 'false';
        });
        parent.postMessage(JSON.stringify({event:'onReady'}), 'https://vk.ru');
      </script></body>` }));
    const script = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { createBackgroundFeatures } from './src/content/features/appearance/background/index.ts';
      const settings = { background_type: 'embed', custom_background: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', background_video_volume: 30 };
      const manager = { getSetting: async key => settings[key], injectCSS: () => {}, removeCSS: () => {} };
      const handlers = createBackgroundFeatures(manager);
      window.changeVolume = async volume => {
        settings.background_video_volume = volume;
        await handlers.background_video_volume[volume === 0 ? 'disable' : 'enable']();
      };
      handlers.custom_background.enable();
    ` }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.app.json' });
    await page.goto('https://vk.ru/');
    await page.addScriptTag({ content: script.outputFiles[0].text });
    const state = page.frameLocator('#vkify-embed-bg').locator('#state');
    await expect(state).toHaveAttribute('data-volume', '30');
    await expect(state).toHaveAttribute('data-muted', 'false');
    const source = await page.locator('#vkify-embed-bg').getAttribute('src');
    await page.evaluate(() => (window as any).changeVolume(70));
    await expect(state).toHaveAttribute('data-volume', '70');
    await page.evaluate(() => (window as any).changeVolume(0));
    await expect(state).toHaveAttribute('data-volume', '0');
    await expect(state).toHaveAttribute('data-muted', 'true');
    // Let the startup retries run: none may restore an earlier positive volume.
    await expect.poll(async () => {
      await page.waitForTimeout(4000);
      return state.getAttribute('data-muted');
    }).toBe('true');
    expect(await page.locator('#vkify-embed-bg').getAttribute('src')).toBe(source);
  } finally { await browser.close(); }
});

for (const initialVolume of [0, 60]) {
  test('Coub wallpaper switches sound and restores saved volume ' + initialVolume, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      let loads = 0;
      await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
      await page.route('https://coub.com/**', route => {
        loads++;
        return route.fulfill({ contentType: 'text/html', body: `<body><audio id="audio"></audio><script>
          document.querySelector('audio').muted = new URLSearchParams(location.search).get('muted') === 'true';
        </script></body>` });
      });
      const script = await build({ stdin: { resolveDir: process.cwd(), contents: `
        import { createBackgroundFeatures } from './src/content/features/appearance/background/index.ts';
        const settings = { background_type: 'embed', custom_background: 'https://coub.com/view/abc123', background_video_volume: ${initialVolume} };
        const manager = { getSetting: async key => settings[key], injectCSS: () => {}, removeCSS: () => {} };
        const handlers = createBackgroundFeatures(manager);
        window.changeVolume = async volume => {
          settings.background_video_volume = volume;
          await handlers.background_video_volume[volume === 0 ? 'disable' : 'enable']();
        };
        handlers.custom_background.enable();
      ` }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.app.json' });
      await page.goto('https://vk.ru/');
      await page.addScriptTag({ content: script.outputFiles[0].text });
      const audio = page.frameLocator('#vkify-embed-bg').locator('#audio');
      await expect(audio).toHaveJSProperty('muted', initialVolume === 0);
      await page.evaluate(() => (window as any).changeVolume(35));
      await expect(audio).toHaveJSProperty('muted', false);
      const unmutedSource = await page.locator('#vkify-embed-bg').getAttribute('src');
      const unmutedLoads = loads;
      await page.evaluate(() => (window as any).changeVolume(90));
      expect(await page.locator('#vkify-embed-bg').getAttribute('src')).toBe(unmutedSource);
      expect(loads).toBe(unmutedLoads);
      await page.evaluate(() => (window as any).changeVolume(0));
      await expect(audio).toHaveJSProperty('muted', true);
      await page.evaluate(() => (window as any).changeVolume(40));
      await expect(audio).toHaveJSProperty('muted', false);
    } finally { await browser.close(); }
  });
}

test('Vimeo wallpaper restores volume, changes it across origins, and mutes zero without reloading', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({contentType:'text/html',body:'<body></body>'}));
    await page.route('https://player.vimeo.com/**', route => route.fulfill({contentType:'text/html',body:`<body><audio id="audio"></audio><script>
      const audio = document.querySelector('audio');
      audio.muted = true;
      window.addEventListener('message', event => {
        if(event.origin !== 'https://vk.ru') return;
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if(data.method === 'setVolume') audio.volume = data.value;
        if(data.method === 'setMuted') audio.muted = data.value;
        if(data.method === 'ping') parent.postMessage({method:'ping',value:true},'https://vk.ru');
      });
      parent.postMessage({event:'ready'},'https://vk.ru');
    </script></body>` }));
    const script = await build({stdin:{resolveDir:process.cwd(),contents:`
      import {createBackgroundFeatures} from './src/content/features/appearance/background/index.ts';
      const settings={background_type:'embed',custom_background:'https://vimeo.com/76979871',background_video_volume:35};
      const handlers=createBackgroundFeatures({getSetting:async key=>settings[key],injectCSS:()=>{},removeCSS:()=>{}});
      window.changeVolume=async volume=>{settings.background_video_volume=volume;await handlers.background_video_volume[volume===0?'disable':'enable']();};
      handlers.custom_background.enable();
    `},bundle:true,write:false,format:'iife',platform:'browser',tsconfig:'tsconfig.app.json'});
    await page.goto('https://vk.ru/');
    await page.addScriptTag({content:script.outputFiles[0].text});
    const audio=page.frameLocator('#vkify-embed-bg').locator('#audio');
    await expect(audio).toHaveJSProperty('volume',0.35);
    await expect(audio).toHaveJSProperty('muted',false);
    const src=await page.locator('#vkify-embed-bg').getAttribute('src');
    await page.evaluate(()=>(window as any).changeVolume(80));
    await expect(audio).toHaveJSProperty('volume',0.8);
    await expect(audio).toHaveJSProperty('muted',false);
    await page.evaluate(()=>(window as any).changeVolume(0));
    await expect(audio).toHaveJSProperty('volume',0);
    await expect(audio).toHaveJSProperty('muted',true);
    await page.waitForTimeout(4000);
    await expect(audio).toHaveJSProperty('muted',true);
    expect(await page.locator('#vkify-embed-bg').getAttribute('src')).toBe(src);
  } finally {await browser.close();}
});

import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

function media(): Buffer {
  const wav = Buffer.alloc(44 + 8000 * 30 * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  return wav;
}

test('built extension applies wallpaper speed after storage changes', async () => {
  test.setTimeout(60000);
  const extension = resolve('dist/chrome');
  const pageOrigin = 'https://vk.ru';
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const ui = await context.newPage();
    await ui.goto(`chrome-extension://${new URL(worker.url()).host}/index.html`);
    await expect(ui.locator('#root.ready')).toBeVisible();
    await worker.evaluate(url => chrome.storage.local.set({
      onboarding_done: true, first_run: false, language: 'en',
      background_type: 'embed', custom_background: url, background_video_speed: 50,
      wallpaper_schedule_enabled: false,
    }), 'https://vkvideo.ru/video-1_2');
    const page = await context.newPage();
    await page.route(`${pageOrigin}/**`, async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/media.wav') {
        await route.fulfill({ contentType: 'audio/wav', body: media() }); return;
      }
      if (path === '/video_ext.php') {
        await route.fulfill({ contentType: 'text/html', body: `<body><div id="host"></div><script>
          setTimeout(() => {
            const root = document.querySelector('#host').attachShadow({mode:'open'});
            const video = document.createElement('video'); video.muted = true; video.autoplay = true;
            video.src = '/media.wav'; root.append(video); window.media = video;
          }, 100);
        </script></body>` }); return;
      }
      await route.fulfill({ contentType: 'text/html', body: `<body><div id="page_header_cont"></div><div id="page_layout"></div><script>
        window.vkApi = { api: async (method, params) => ({ count: 1, items: [{ files: { mp4_720: '${pageOrigin}/media.wav' } }] }) };
      </script></body>` });
    });
    await page.goto(`${pageOrigin}/feed`);
    const video = page.locator('#vkify-video-bg');
    await expect(video).toHaveCount(1);
    await expect(page.locator('#vkify-embed-bg')).toHaveCount(0);
    const rate = () => video.evaluate(video => (video as HTMLVideoElement).playbackRate);
    await expect.poll(rate).toBe(0.5);
    await expect.poll(() => video.evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1);
    const progress = () => video.evaluate(async element => {
      const video = element as HTMLVideoElement;
      const before = video.currentTime, started = performance.now();
      await new Promise(resolve => setTimeout(resolve, 800));
      const elapsed = video.currentTime - before;
      return (elapsed < 0 ? elapsed + video.duration : elapsed) / ((performance.now() - started) / 1000);
    });
    const slow = await progress();
    expect(slow).toBeGreaterThan(0.25); expect(slow).toBeLessThan(0.85);
    await ui.reload();
    await expect(ui.locator('#root.ready')).toBeVisible();
    await ui.getByRole('button', { name: 'Style', exact: true }).click();
    await ui.getByRole('button', { name: /Background.*Wallpaper, video/ }).click();
    await ui.getByRole('button', { name: 'Adjust', exact: true }).click();
    await ui.getByRole('button', { name: /Video · vk/ }).click();
    const slider = ui.locator('#background_video_speed');
    await slider.press('End');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('background_video_speed')).background_video_speed)).toBe(200);
    await expect.poll(rate).toBe(2);
    const fast = await progress();
    expect(fast).toBeGreaterThan(1.4); expect(fast).toBeGreaterThan(slow * 2.5);
    await slider.press('Home');
    await expect.poll(rate).toBe(0.25);
    const volume = ui.locator('#background_video_volume');
    const mediaVolume = () => video.evaluate(element => ({ volume: (element as HTMLVideoElement).volume, muted: (element as HTMLVideoElement).muted }));
    await volume.press('End');
    await expect.poll(mediaVolume).toEqual({ volume: 1, muted: false });
    await volume.press('ArrowLeft');
    await expect.poll(mediaVolume).toEqual({ volume: 0.95, muted: false });
    await volume.press('Home');
    await expect.poll(mediaVolume).toEqual({ volume: 0, muted: true });
  } finally { await context.close(); }
});

for (const origin of ['https://vk.ru', 'https://vkvideo.ru']) {
  test(`VK wallpaper speed controls direct media without accessing an iframe on ${origin}`, async () => {
    const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
      const page = await browser.newPage();
      const script = await build({ stdin: { resolveDir: process.cwd(), contents: `
        import { createBackgroundFeatures } from './src/content/features/appearance/background/index.ts';
        import { serviceContainer, SERVICES } from './src/content/core/services/index.ts';
        serviceContainer.registerValue(SERVICES.vkApi, { call: async () => ({ count: 1, items: [{ files: { mp4_720: '${origin}/media.wav' } }] }) });
        const settings = { background_type: 'embed', custom_background: 'https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=private', background_video_speed: 50 };
        let handlers;
        const manager = { getSetting: async key => settings[key], getFeatureHandler: key => handlers[key], injectCSS: () => {}, removeCSS: () => {} };
        handlers = createBackgroundFeatures(manager);
        window.changeSpeed = async speed => { settings.background_video_speed = speed; await handlers.background_video_speed.enable(); };
        window.clearWallpaper = () => handlers.custom_background.disable();
        handlers.custom_background.enable();
      ` }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.app.json' });
      await page.route(`${origin}/**`, async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/media.wav') {
          await route.fulfill({ contentType: 'audio/wav', body: media() }); return;
        }
        if (url.pathname !== '/video_ext.php') {
          await route.fulfill({ contentType: 'text/html', body: '<body></body>' }); return;
        }
        await route.fulfill({ contentType: 'text/html', body: `<body><div id="player"></div><script>
          // VK attaches an open shadow root after its host is already in the DOM.
          setTimeout(() => {
            const root = document.querySelector('#player').attachShadow({mode:'open'});
            const nested = document.createElement('div'); root.append(nested);
            const inner = nested.attachShadow({mode:'open'});
            const video = document.createElement('video');
            video.muted = true; video.autoplay = true; video.src = '/media.wav';
            inner.append(video); window.media = video;
          }, 100);
        </script></body>` });
      });
      await page.goto(`${origin}/`);
      const session = await page.context().newCDPSession(page);
      const { frameTree } = await session.send('Page.getFrameTree');
      const { executionContextId } = await session.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'vkify-test-content-script' });
      const execute = (expression: string) => session.send('Runtime.evaluate', { expression, contextId: executionContextId, awaitPromise: true });
      await execute(script.outputFiles[0].text);
      const video = page.locator('#vkify-video-bg');
      await expect(video).toHaveCount(1);
      await expect(page.locator('#vkify-embed-bg')).toHaveCount(0);
      const rate = () => video.evaluate(video => (video as HTMLVideoElement).playbackRate);
      await expect.poll(rate).toBe(0.5);
      await expect.poll(() => video.evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1);
      const progress = () => video.evaluate(async element => {
        const video = element as HTMLVideoElement;
        const start = video.currentTime;
        await new Promise(resolve => setTimeout(resolve, 1000));
        return video.currentTime - start;
      });
      const slow = await progress();
      expect(slow).toBeGreaterThan(0.2); expect(slow).toBeLessThan(0.9);
      await execute('window.changeSpeed(200)');
      await expect.poll(rate).toBe(2);
      const fast = await progress();
      expect(fast).toBeGreaterThan(1.4); expect(fast).toBeGreaterThan(slow * 2.5);
      expect(page.frames()).toHaveLength(1);
      await execute('window.clearWallpaper()');
      await expect(page.locator('#vkify-video-bg')).toHaveCount(0);
    } finally { await browser.close(); }
  });
}

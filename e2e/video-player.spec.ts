import { test, expect, chromium } from '@playwright/test';
import { resolve, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

function tone(): Buffer {
  const wav = Buffer.alloc(44 + 8000 * 30 * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  return wav;
}

// Real Chromium media and Shadow DOM; all requests are intercepted by fixtures.
// No live VK account, ad delivery, or installed browser profile is involved.
for (const target of ['chrome', 'firefox'] as const) {
  test(`video controls and compiled ${target} blocker preserve main playback`, async () => {
    const hotkeys = await build({ bundle: true, write: false, format: 'iife', tsconfig: 'tsconfig.app.json',
      stdin: { resolveDir: process.cwd(), contents: `
        import { createVideoHotkeysFeature } from './src/content/features/center/video/hotkeys';
        createVideoHotkeysFeature({ getSetting: async () => undefined, onStorageChange: () => () => {} })
          .enable().then(() => document.querySelector('#status').dataset.ready = 'true');
      ` },
    });
    const blocker = await readFile(resolve('dist', target, 'injected/tracker-blocker.js'), 'utf8');
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH || undefined,
      args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
      const page = await browser.newPage();
      let campaignRequests = 0;
      await page.route('https://ad.mail.ru/**', async route => {
        campaignRequests++;
        await route.fulfill({ contentType: 'application/json', body: '{}' });
      });
      await page.route(/^https:\/\/(?:media\.fixture|r\.mradx\.net)\//, route => {
        const wav = tone();
        const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
        const start = range ? Number(range[1]) : 0;
        const end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
        return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wav.subarray(start, end + 1),
          headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}) } });
      });
      await page.route('https://vkvideo.ru/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/hotkeys.js' || path === '/blocker.js') {
          await route.fulfill({ contentType: 'text/javascript', body: path === '/hotkeys.js' ? hotkeys.outputFiles[0].text : blocker });
          return;
        }
        await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
          <meta charset="utf-8">
          <style>#host{display:block;width:600px;height:350px}</style>
          <div id="host" class="shadow-root-container"></div><input id="search"><button id="campaign">Campaign</button>
          <button id="disable">Disable ads</button><button id="media-ad">Media ad</button>
          <button id="loaded-ad">Loaded ad</button><button id="enable">Enable ads</button><output id="status"></output>
          <script>
            const root = document.querySelector('#host').attachShadow({mode:'open'});
            root.innerHTML = '<div role="region" aria-label="Видеоплеер" style="width:600px;height:350px">' +
              '<div data-testid="video-container"><video class="player-media" muted></video></div>' +
              '<button data-testid="play-btn">Play</button><button data-testid="btn-next">Next</button>' +
              '<button data-testid="btn-prev">Prev</button><button data-testid="fullscreen-btn">Fullscreen</button></div>';
            const media = root.querySelector('video');
            media.src = 'https://media.fixture/main.wav';
            root.querySelector('[data-testid="play-btn"]').onclick = () => media.paused ? media.play() : media.pause();
            root.querySelector('[data-testid="btn-next"]').onclick = () => document.querySelector('#status').dataset.next = 'true';
            window.addEventListener('vkify-script-ready', () => {
              window.dispatchEvent(new CustomEvent('vkify-update-settings', {detail:{block_recommendations_video:true,block_music_ads:true}}));
            });
            document.querySelector('#disable').onclick = () => window.dispatchEvent(new CustomEvent('vkify-update-settings', {detail:{block_recommendations_video:false}}));
            document.querySelector('#enable').onclick = () => window.dispatchEvent(new CustomEvent('vkify-update-settings', {detail:{block_recommendations_video:true}}));
            document.querySelector('#loaded-ad').onclick = () => {
              const container = document.createElement('div');
              container.dataset.testid = 'ad-container';
              const ad = document.createElement('video'); ad.muted = true;
              ad.addEventListener('playing', () => document.querySelector('#status').dataset.loadedAd = 'true');
              ad.addEventListener('ended', () => document.querySelector('#status').dataset.adEnded = 'true');
              container.append(ad); root.append(container);
              ad.src = 'https://r.mradx.net/vrs/ad.wav'; ad.play();
            };
            document.querySelector('#media-ad').onclick = () => {
              const ad = document.createElement('video');
              ad.addEventListener('error', () => document.querySelector('#status').dataset.mediaError = 'true');
              ad.src = 'https://r.mradx.net/vrs/ad.mp4';
              root.append(ad); ad.load();
            };
            document.querySelector('#campaign').onclick = async () => {
              const response = await fetch('https://ad.mail.ru/vp/123/');
              document.querySelector('#status').dataset.campaign = String(response.status);
              if (response.status === 204) media.play();
            };
            setInterval(() => {
              const s = document.querySelector('#status');
              s.dataset.time = String(Math.floor(media.currentTime));
              s.dataset.rate = String(media.playbackRate); s.dataset.paused = String(media.paused);
            }, 50);
          </script><script src="/blocker.js"></script><script src="/hotkeys.js"></script>` });
      });
      await page.goto('https://vkvideo.ru/video-1_1');
      const status = page.locator('#status');
      await expect(status).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('video.player-media')).toHaveJSProperty('readyState', 4);
      await page.keyboard.press('Control+Alt+ArrowRight');
      await expect(status).toHaveAttribute('data-time', '10');
      await page.keyboard.press('Control+Alt+Equal');
      await expect(status).toHaveAttribute('data-rate', '1.25');
      await page.keyboard.press('Control+Alt+Shift+ArrowRight');
      await expect(status).toHaveAttribute('data-next', 'true');
      await page.locator('#search').focus();
      await page.keyboard.press('Control+Alt+ArrowRight');
      await expect(status).toHaveAttribute('data-time', '10');
      await page.locator('#media-ad').click();
      await expect(status).toHaveAttribute('data-media-error', 'true');
      await page.locator('#campaign').click();
      await expect(status).toHaveAttribute('data-campaign', '204');
      await expect(status).toHaveAttribute('data-paused', 'false');
      expect(campaignRequests).toBe(0);
      await page.locator('#disable').click();
      await page.locator('#campaign').click();
      await expect(status).toHaveAttribute('data-campaign', '200');
      expect(campaignRequests).toBe(1);
      await page.locator('#loaded-ad').click();
      await expect(status).toHaveAttribute('data-loaded-ad', 'true');
      await page.locator('#enable').click();
      await expect(status).toHaveAttribute('data-ad-ended', 'true');
      await expect(status).toHaveAttribute('data-paused', 'false');
    } finally { await browser.close(); }
  });

  test(`video shortcuts are editable in Center → Video in the ${target} UI`, async ({}, info) => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH || undefined });
    try {
      const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
      await page.route('http://vkify.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        try {
          const body = await readFile(resolve('dist', target, path === '/' ? 'index.html' : path.slice(1)));
          const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
          await route.fulfill({ body, contentType: types[extname(path)] ?? (path === '/' ? 'text/html' : 'application/octet-stream') });
        } catch { await route.fulfill({ status: 404, body: '' }); }
      });
      await page.addInitScript(() => {
        const event = { addListener() {}, removeListener() {} };
        const data: Record<string, unknown> = { language: 'en', onboarding_done: true, first_run: false, video_player_hotkeys: true };
        (window as any).chrome = {
          storage: { local: { get: async () => ({ ...data }), set: async (values: object) => Object.assign(data, values), remove: async () => {} }, sync: { set: async () => {} }, onChanged: event },
          permissions: { contains: async () => true, onAdded: event, onRemoved: event },
          runtime: { id: 'fixture', onMessage: event, getURL: (path: string) => 'http://vkify.test/' + path.replace(/^\//, ''), getManifest: () => ({ version: '2.0.0' }),
            sendMessage: async (m: any) => m.type === 'PING' ? { pong: true, hasVKHostPermission: true } : m.type === 'GET_VK_TOKEN' ? { status: 'missing' } : { success: true, count: 1 } },
        };
      });
      await page.goto('http://vkify.test/?embed=1');
      await expect(page.locator('#root.ready')).toBeVisible();
      await page.getByRole('button', { name: 'Center', exact: true }).click();
      await page.getByRole('button', { name: /^Video Tools/ }).click();
      await page.getByRole('button', { name: /Video keyboard shortcuts/ }).click();
      await expect(page.getByRole('heading', { name: 'Video keyboard shortcuts', exact: true })).toBeVisible();
      const changes = page.getByRole('button', { name: 'Change', exact: true });
      await expect(changes).toHaveCount(12);
      await changes.first().click();
      await page.keyboard.press('Control+Alt+KeyP');
      await expect(page.getByRole('button', { name: 'Change', exact: true })).toHaveCount(12);
      await page.screenshot({ path: info.outputPath('video-hotkeys.png'), fullPage: true });
    } finally { await browser.close(); }
  });
}

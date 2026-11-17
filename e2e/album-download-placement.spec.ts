import { test, expect, chromium } from '@playwright/test';
import { build } from './esbuild-fixture.js';
import { resolve } from 'node:path';

test('album download finds the new modal, header and canonical playlist', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { injectAlbumButton, parseAlbumLink } from './src/content/features/center/music/download/bulk.ts';
      window.scan = injectAlbumButton;
      window.album = () => parseAlbumLink(document.querySelector('#album'));
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') },
    define: { __VKIFY_SITE_URL__: JSON.stringify('https://vkify.ru'), __VKIFY_BROWSER__: JSON.stringify('chrome') } });
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: `
      <div role="dialog"><h2>Unrelated dialog</h2></div>
      <div id="album" role="dialog" aria-modal="true">
        <a href="/music/album/-2000235437_22235437_610709cd49e1b9e5e1">Popular Monster</a>
        <div role="heading" aria-level="2" id="tracks">Треки 11</div>
        <div data-testentitytag="audio" data-audio-id="-2001648908_131648908"></div>
      </div><script>${bundle.outputFiles[0].text}</script>` }));
    await page.goto('https://vk.ru/audios574368528?z=audio_playlist574368528_136_2eaf6bfbc79439eef9');
    const scan = () => page.evaluate(() => (window as unknown as { scan(): void }).scan());
    const album = () => page.evaluate(() => (window as unknown as { album(): unknown }).album());
    await scan();
    await scan();
    await expect(page.locator('#tracks > [data-vkify-adl-album]')).toHaveCount(1);
    await expect(page.locator('[data-vkify-adl-album]')).toHaveCount(1);
    expect(await album()).toEqual({ ownerId: '-2000235437', playlistId: '22235437', accessHash: '610709cd49e1b9e5e1' });
    await page.locator('#album > a').evaluate(el => el.remove());
    expect(await album()).toEqual({ ownerId: '574368528', playlistId: '136', accessHash: '2eaf6bfbc79439eef9' });
    await page.locator('#tracks').evaluate(el => el.innerHTML = 'Треки 11');
    await scan();
    await expect(page.locator('#tracks > [data-vkify-adl-album]')).toHaveCount(1);
  } finally { await browser.close(); }
});

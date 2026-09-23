import { test, expect, chromium, type Page } from '@playwright/test';
import { build } from 'esbuild';

test('lyrics render Focus and Flow with bounded wrapping at desktop and narrow sizes', async ({}, testInfo) => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 1 });
    await page.setContent('<style>body{margin:0;background:radial-gradient(ellipse at bottom,#243757,#0b0e19);height:100vh}canvas{display:block}</style><canvas></canvas>');
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      import { VisualizerRenderer } from './src/shared/visualizer-renderer.ts';
      import { parseVisualizerSettings } from './src/shared/music-visualizer.ts';
      const renderer = new VisualizerRenderer();
      renderer.lyrics.reset([
        { text: 'Город засыпает' },
        { text: 'Мы оставим свет' },
        { text: 'Музыка звучит во мне' },
        { text: 'И наполняет этот вечер' },
        { text: 'Пусть звучит ещё' },
        { text: 'Пока мы рядом' },
        { text: 'До первых лучей' }
      ]);
      renderer.lyrics.playback = { currentTime: 30, duration: 90 };
      window.drawLyrics = (style, width, height) => {
        const canvas = document.querySelector('canvas'); canvas.width = width; canvas.height = height;
        const g = canvas.getContext('2d');
        renderer.draw(g, width, height, parseVisualizerSettings({ mode: 'lyrics', lyricsLayoutVersion: 2, lyricsStyle: style, position: 'full', opacity: 100 }), ['#dbeafe','#c4b5fd'], true);
        const data = g.getImageData(0, 0, width, height).data;
        let count = 0;
        for(let i = 3; i < data.length; i += 4) if(data[i]) count++;
        return count;
      };
    ` }, tsconfig: 'tsconfig.app.json', bundle: true, write: false, format: 'iife' });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    for (const style of ['focus', 'flow']) {
      for (const [width, height] of [[1000, 640], [320, 180]]) {
        expect(await page.evaluate(`window.drawLyrics('${style}', ${width}, ${height})`)).toBeGreaterThan(100);
      }
    }
    await page.evaluate("window.drawLyrics('flow', 1000, 640)");
    await page.screenshot({ path: testInfo.outputPath('lyrics-flow.png') });
  } finally { await browser.close(); }
});

async function pixels(page: Page) {
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(async (data) => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const g = canvas.getContext('2d')!; g.drawImage(image, 0, 0);
    return [[20, 200], [20, 350], [150, 150], [350, 150]].map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3));
  }, png);
}

test('wallpaper < transparent visualizer < ordinary content and modal, with independent teardown', async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 1 });
    await page.setContent(`<style>
      html{background:#101820}body{margin:0;min-height:100vh;background:#101820}
      #layout_wrapper_root{background:#ddd;min-height:100vh;padding-top:100px;box-sizing:border-box}
      #card{margin-left:100px;width:100px;height:150px;background:#ff0000}
      #modal{position:fixed;left:300px;top:100px;width:100px;height:150px;background:#ff00ff;z-index:100}
    </style><div id="layout_wrapper_root"><div id="card"><button onclick="this.textContent='clicked'">Click</button></div></div><div id="modal"></div>`);
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      import { createBackgroundFeatures } from './src/content/features/appearance/background/index.ts';
      import { createMusicVisualizerFeature } from './src/content/features/center/music/visualizer/index.ts';
      window.requestAnimationFrame = () => 0;
      const image = document.createElement('canvas'); image.width = image.height = 1;
      const g = image.getContext('2d'); g.fillStyle = '#0000ff'; g.fillRect(0,0,1,1);
      const url = image.toDataURL();
      const values = { custom_background:url, background_type:'image', background_dim:0, music_visualizer_settings:'{"blur":0}' };
      const ctx = {
        getSetting:async key => values[key],
        injectCSS:(id,css)=>{document.getElementById('style-'+id)?.remove();const s=document.createElement('style');s.id='style-'+id;s.textContent=css;document.head.append(s);},
        removeCSS:id=>document.getElementById('style-'+id)?.remove(),
        injectScript:()=>queueMicrotask(()=>window.dispatchEvent(new CustomEvent('vkify-script-ready',{detail:{name:'equalizer'}}))),
        sendEvent:()=>{}, onStorageChange:()=>()=>{}, selectors:{music:{playerCover:'img'}}
      };
      const bg = createBackgroundFeatures(ctx).custom_background;
      const viz = createMusicVisualizerFeature(ctx).music_visualizer;
      window.fixture = { bg, viz, url };
      window.ready = (async()=>{
        await bg.enable(url); await viz.enable();
        const canvas=document.querySelector('#vkify-music-visualizer');canvas.width=600;canvas.height=400;
        const g=canvas.getContext('2d');g.fillStyle='#00ff00';g.fillRect(0,0,600,300);
      })();
    ` }, tsconfig: 'tsconfig.app.json', bundle: true, write: false, format: 'iife' });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate('window.ready');
    expect(await pixels(page)).toEqual([[0,255,0], [0,0,255], [255,0,0], [255,0,255]]);
    await page.getByRole('button', { name: 'Click', exact: true }).click();
    await expect(page.getByRole('button', { name: 'clicked' })).toBeVisible();
    await page.evaluate('window.fixture.bg.disable()');
    expect((await pixels(page)).slice(0,2)).toEqual([[0,255,0], [16,24,32]]);
    await page.evaluate('window.fixture.bg.enable(window.fixture.url)');
    await page.evaluate('window.fixture.viz.disable()');
    expect((await pixels(page)).slice(0,2)).toEqual([[0,0,255], [0,0,255]]);
  } finally { await browser.close(); }
});

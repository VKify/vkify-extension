import { test, expect, chromium, type Page } from '@playwright/test';
import { build } from 'esbuild';

test('lyrics presets render with bounded wrapping at desktop and narrow sizes', async ({}, testInfo) => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 1 });
    await page.setContent('<style>body{margin:0;background:radial-gradient(ellipse at bottom,#243757,#0b0e19);height:100vh}canvas{display:block}</style><canvas></canvas>');
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      import { VisualizerRenderer } from './src/shared/visualizer-renderer.ts';
      import { parseVisualizerSettings } from './src/shared/music-visualizer.ts';
      import { LYRICS_PRESETS, lyricsPreset } from './src/shared/music-lyrics.ts';
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
        renderer.draw(g, width, height, LYRICS_PRESETS.some(p => p.id === style) ? lyricsPreset(style) : parseVisualizerSettings({ mode: 'lyrics', lyricsLayoutVersion: 2, lyricsStyle: style, position: 'full', opacity: 100 }), ['#dbeafe','#c4b5fd'], true);
        const data = g.getImageData(0, 0, width, height).data;
        let count = 0;
        for(let i = 3; i < data.length; i += 4) if(data[i]) count++;
        return count;
      };
    ` }, tsconfig: 'tsconfig.app.json', bundle: true, write: false, format: 'iife' });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    for (const style of ['focus', 'flow', 'stage', 'velvet', 'spotlight', 'minimal', 'editorial', 'soft', 'cinema', 'gallery', 'mono']) {
      for (const [width, height] of [[1000, 640], [320, 180]]) {
        expect(await page.evaluate(`window.drawLyrics('${style}', ${width}, ${height})`)).toBeGreaterThan(100);
      }
    }
    await page.evaluate("window.drawLyrics('stage', 1000, 640)");
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


for (const featureName of ['music_visualizer', 'music_lyrics']) test(featureName + ' widget resizes, localizes and restores geometry', async ({}, testInfo) => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.route('https://vk.com/**', route => route.fulfill({ contentType: 'text/html', body: '<body style="background:#18202f"></body>' }));
    await page.goto('https://vk.com/');
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      import { createMusicVisualizerFeature, createMusicLyricsFeature } from './src/content/features/center/music/visualizer/index.ts';
      import { dispatchPageEvent } from './src/content/utils/page-event.ts';
      const ctx = {
        getSetting: async () => JSON.stringify({ output: 'widget', mode: 'wave', colorMode: 'custom', color: '#c4b5fd' }),
        setSetting: async () => {}, injectCSS: () => {}, removeCSS: () => {},
        injectScript: () => queueMicrotask(() => dispatchPageEvent('vkify-script-ready', { name: 'equalizer' })),
        sendEvent: () => {}, onStorageChange: () => () => {}, selectors: { music: { playerCover: 'img' } }
      };
      window.feature = ${featureName === 'music_lyrics' ? 'createMusicLyricsFeature(ctx).music_lyrics' : 'createMusicVisualizerFeature(ctx).music_visualizer'};
      window.feature.enable();
    ` }, tsconfig: 'tsconfig.app.json', bundle: true, write: false, format: 'iife' });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const widget = page.locator('[data-vkify-widget="' + featureName + '"]');
    await expect(widget).toBeVisible();
    const before = await widget.boundingBox();
    await page.mouse.move(before!.x + before!.width - 3, before!.y + before!.height - 3);
    await page.mouse.down(); await page.mouse.move(before!.x + before!.width - 83, before!.y + before!.height - 63, { steps: 8 }); await page.mouse.up();
    await expect.poll(async () => (await widget.boundingBox())!.width).toBeLessThan(before!.width - 40);
    await expect.poll(() => page.evaluate(name => JSON.parse(localStorage.getItem('vkify-' + name + '-widget') || '{}').width, featureName)).toBeLessThan(before!.width - 40);
    const resized = await widget.boundingBox();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('vkify:lang', { detail: { lang: 'en' } })));
    await expect(widget.locator('.vkify-fw__title')).toHaveText(featureName === 'music_lyrics' ? 'Lyrics' : 'Visualizer');
    await expect(widget.getByRole('button', { name: 'Collapse', exact: true })).toHaveCount(1);
    await expect(widget.getByRole('button', { name: 'Close', exact: true })).toHaveCount(1);
    await expect(widget.locator('.vkify-fw__body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect.poll(() => page.locator('canvas').evaluate(c => (c as HTMLCanvasElement).width)).toBe(Math.round(resized!.width));
    await widget.locator('button').first().dispatchEvent('pointerdown');
    await expect(widget).toHaveClass(/is-collapsed/);
    await widget.locator('button').first().dispatchEvent('pointerdown');
    await expect(widget).not.toHaveClass(/is-collapsed/);
    await page.screenshot({ path: testInfo.outputPath('music-widget.png') });
    await page.evaluate('window.feature.disable(); window.feature.enable();');
    await expect.poll(async () => (await widget.boundingBox())!.width).toBe(resized!.width);
    await page.evaluate('window.feature.disable()');
    await expect(widget).toHaveCount(0);
  } finally { await browser.close(); }
});


test('lyrics uses Appearance page offset in both directions without vertical or widget overrides', async ({}, testInfo) => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.setContent('<style>html,body{margin:0;background:#101820;color:white;font-family:serif}#page_layout{width:min(1000px,100vw);height:600px;margin:64px auto 0;background:#334155}html{--vkify-page-shift:-40px}</style><div id="page_layout">VK content</div>');
    await page.addStyleTag({ path: 'src/content/features/appearance/layout/page-offset.css' });
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      import { createMusicLyricsFeature } from './src/content/features/center/music/visualizer/index.ts';
      import { lyricsPreset } from './src/shared/music-lyrics.ts';
      import { lyricsPageOffsetPatch } from './src/shared/lyrics-layout.ts';
      import { pageOffsetShift } from './src/content/features/appearance/layout/page-offset.ts';
      let saved = lyricsPreset('stage');
      const appearance = { page_offset_enabled: false, page_offset_value: 50 };
      window.applyPreset = (patch = {}) => {
        saved = { ...saved, ...patch };
        Object.assign(appearance, lyricsPageOffsetPatch(saved));
        document.documentElement.toggleAttribute('data-vkify-page_offset', appearance.page_offset_enabled);
        document.documentElement.style.setProperty('--vkify-page-shift', pageOffsetShift(appearance.page_offset_value));
        changed('music_lyrics_settings');
      };
      window.appearance = appearance;
      let changed = () => {};
      window.lastFont = '';
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(...args) { window.lastFont = this.font; return original.apply(this, args); };
      const ctx = {
        getSetting: async () => JSON.stringify(saved), setSetting: async () => {}, injectCSS: (id, css) => { const style = document.createElement('style'); style.id = id; style.textContent = css; document.head.append(style); }, removeCSS: id => document.getElementById(id)?.remove(),
        injectScript: () => queueMicrotask(() => window.dispatchEvent(new CustomEvent('vkify-script-ready', { detail: { name: 'equalizer' } }))),
        sendEvent: () => {}, onStorageChange: cb => { changed = cb; return () => {}; }, selectors: { music: { playerCover: 'img' } }
      };
      const feature = createMusicLyricsFeature(ctx).music_lyrics;
      window.ready = feature.enable().then(() => window.dispatchEvent(new CustomEvent('vkify:visualizer:data', { detail: {
        spectrum: [], waveform: [], playing: true, sampleRate: 48000, fftSize: 1024,
        playback: { currentTime: 1, duration: 0, track: { id: 'test', title: 'Music brings us together', artist: 'VKify' } }
      } })));
      window.useWidget = () => { saved = { ...saved, output: 'widget' }; changed('music_lyrics_settings'); };
      window.stop = () => feature.disable();
    ` }, tsconfig: 'tsconfig.app.json', bundle: true, write: false, format: 'iife' });
    await page.addScriptTag({ content: bundle.outputFiles[0].text }); await page.evaluate('window.ready');
    await page.evaluate('window.applyPreset()');
    await expect.poll(() => page.evaluate('window.lastFont')).toContain('serif');
    await expect.poll(async () => (await page.locator('#page_layout').boundingBox())!.x).toBe(0);
    await page.addStyleTag({ content: 'html,body,canvas{font-family:monospace!important}' });
    await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
    await expect.poll(() => page.evaluate('window.lastFont')).toContain('monospace');
    await page.evaluate('window.applyPreset({ lyricsAlignment: "center" })');
    await expect.poll(async () => (await page.locator('#page_layout').boundingBox())!.x).toBe(0);
    await page.evaluate('window.applyPreset({ lyricsAlignment: "right" })');
    await expect.poll(async () => (await page.locator('#page_layout').boundingBox())!.x).toBe(0);
    await page.evaluate('window.applyPreset({ lyricsAlignment: "left", offsetX: 60 })');
    await expect.poll(() => page.evaluate('window.appearance.page_offset_value')).toBe(0);
    await page.evaluate('window.applyPreset({ lyricsAlignment: "center", offsetX: 0 })');
    await page.setViewportSize({ width: 800, height: 600 });
    await expect.poll(async () => (await page.locator('#page_layout').boundingBox())!.y).toBe(64);
    await page.screenshot({ path: testInfo.outputPath('lyrics-narrow.png') });
    await expect.poll(async () => (await page.locator('#page_layout').boundingBox())!.x).toBe(0);
    await page.evaluate('window.useWidget()');
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-lyrics-layout');
    await page.evaluate('window.applyPreset({ output: "widget", lyricsAlignment: "right" })');
    await expect.poll(() => page.evaluate('window.appearance.page_offset_value')).toBe(0);
    await expect.poll(async () => (await page.locator('#page_layout').boundingBox())!.x).toBe(0);
    await expect.poll(async () => (await page.locator('#page_layout').boundingBox())!.y).toBe(64);
    await page.evaluate('window.stop()');
  } finally { await browser.close(); }
});


for (const preset of ['orbit', 'echo', 'portal', 'prism', 'nebula']) test(preset + ' and lyrics fit beside the real layout at multiple window sizes', async ({}, testInfo) => {
 const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH, headless:true });
 try {
  const page = await browser.newPage({viewport:{width:1920,height:1080}, reducedMotion:'reduce'});
  const errors: string[] = []; page.on('pageerror', e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;background:#111827;color:#eee;font:16px system-ui}#page_layout{box-sizing:border-box;width:min(1000px,100vw);height:100vh;margin:auto;background:#202938;padding:80px 48px}article{padding:28px;border-radius:16px;background:#303b4e;margin:20px 0}</style><main id="page_layout"><h1>Music &amp; lyrics</h1><article>Page content stays readable and clickable.<button onclick="this.textContent=&quot;OK&quot;">Check</button></article><article>Your content</article></main>');
  await page.addStyleTag({path:'src/content/features/appearance/layout/page-offset.css'});
  const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
    import {createMusicLyricsFeature,createMusicVisualizerFeature} from './src/content/features/center/music/visualizer/index.ts';
    import {visualizerPreset} from './src/shared/music-visualizer.ts';
    import {lyricsPreset} from './src/shared/music-lyrics.ts';
    import {musicPageOffsetPatch} from './src/shared/lyrics-layout.ts';
    import {pageOffsetShift} from './src/content/features/appearance/layout/page-offset.ts';
    const values={music_visualizer_settings:JSON.stringify(visualizerPreset('${preset}')),music_lyrics_settings:JSON.stringify(lyricsPreset('stage'))};
    Object.assign(values,musicPageOffsetPatch(visualizerPreset('${preset}')));
    const listeners=new Set();
    const ctx={getSetting:async key=>values[key],setSetting:async(key,value)=>{values[key]=value;listeners.forEach(f=>f(key));},
      injectCSS:(id,css)=>{const s=document.createElement('style');s.id=id;s.textContent=css;document.head.append(s);},removeCSS:id=>document.getElementById(id)?.remove(),
      injectScript:()=>queueMicrotask(()=>window.dispatchEvent(new CustomEvent('vkify-script-ready',{detail:{name:'equalizer'}}))),
      sendEvent:()=>{},onStorageChange:f=>{listeners.add(f);return()=>listeners.delete(f);},selectors:{music:{playerCover:'img'}}};
    document.documentElement.setAttribute('data-vkify-page_offset','');
    document.documentElement.style.setProperty('--vkify-page-shift',pageOffsetShift(values.page_offset_value));
    const viz=createMusicVisualizerFeature(ctx).music_visualizer,lyrics=createMusicLyricsFeature(ctx).music_lyrics;
    const emit=()=>window.dispatchEvent(new CustomEvent('vkify:visualizer:data',{detail:{spectrum:Array(512).fill(180),waveform:Array(1024).fill(145),playing:true,sampleRate:48000,fftSize:1024,playback:{currentTime:1,duration:0,track:{id:'demo',title:'Feel the music',artist:'VKify'}}}}));
    let timer;
    window.ready=(async()=>{await viz.enable();await lyrics.enable();emit();timer=setInterval(emit,250);})();
    window.cleanup=()=>{clearInterval(timer);viz.disable();lyrics.disable();};
    window.ink=id=>{const c=document.getElementById(id),g=c.getContext('2d'),data=g.getImageData(0,0,c.width,c.height).data;
      let minX=c.width,minY=c.height,maxX=-1,maxY=-1;
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>12){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      const ratio=c.width/innerWidth;return {minX:minX/ratio,minY:minY/ratio,maxX:maxX/ratio,maxY:maxY/ratio};};
  `},bundle:true,write:false,format:'iife',tsconfig:'tsconfig.app.json'});
  await page.addScriptTag({content:bundle.outputFiles[0].text});await page.evaluate('window.ready');
  for (const width of [1920,1366,2560]) {
    await page.setViewportSize({width,height:900});
    await expect.poll(()=>page.evaluate('window.ink("vkify-music-lyrics").maxX')).toBeGreaterThan(1000);
    await expect.poll(()=>page.evaluate('window.ink("vkify-music-visualizer").maxX')).toBeGreaterThan(1000);
    const lyrics=await page.evaluate('window.ink("vkify-music-lyrics")') as {minX:number;minY:number;maxX:number};
    const viz=await page.evaluate('window.ink("vkify-music-visualizer")') as {minX:number;maxY:number;maxX:number};
    expect(lyrics.minX).toBeGreaterThanOrEqual(1000);expect(viz.minX).toBeGreaterThanOrEqual(1000);
    expect(lyrics.maxX).toBeLessThan(width);expect(viz.maxX).toBeLessThan(width);
    expect(viz.maxY).toBeLessThan(lyrics.minY);
    await page.screenshot({path:testInfo.outputPath(preset+'-'+width+'.png')});
  }
  await page.getByRole('button',{name:'Check',exact:true}).click();await expect(page.getByRole('button',{name:'OK',exact:true})).toBeVisible();
  await page.evaluate('window.cleanup()');await expect(page.locator('canvas')).toHaveCount(0);expect(errors).toEqual([]);
 } finally {await browser.close();}
});

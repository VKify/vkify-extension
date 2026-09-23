import { readFile } from 'node:fs/promises';
import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';

test('independent lyrics: snapshot, free text and artwork dragging, cleanup', async ({}, testInfo) => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    await page.route('https://cover.example/art.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#7346ce"/><circle cx="150" cy="150" r="90" fill="#df6496"/></svg>' }));
    await page.setContent('<style>html,body{margin:0;background:#101626;height:100%;color:white}#player-cover{position:absolute;right:5px;width:20px}</style><img id="player-cover" src="https://cover.example/art.svg"><button id="underlying" style="position:absolute;bottom:10px;right:10px" onclick="this.textContent=\'clicked\'">VK control</button>');
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      import { createMusicVisualizerFeature, createMusicLyricsFeature } from './src/content/features/center/music/visualizer/index.ts';
      import { parseLyricsSettings } from './src/shared/music-lyrics.ts';
      const listeners = new Set(); const storageListeners = new Set();
      const lines = ['Город засыпает', 'Мы оставим свет', 'Музыка внутри', 'Звучит ещё', 'Пока мы рядом', 'До первых лучей'].map((text,i)=>({text,startTime:i*10,endTime:(i+1)*10}));
      window.chrome = { runtime: { id: 'fixture', onMessage: { addListener:f=>listeners.add(f), removeListener:f=>listeners.delete(f) }, sendMessage:async()=>({success:true,source:'lrclib',synced:true,lyrics:lines.map(l=>l.text).join('\\n'),lines}) } };
      const values = { music_visualizer_settings: '{}', music_lyrics_settings: JSON.stringify(parseLyricsSettings({lyricsLayer:'foreground'})) };
      const ctx = {
        getSetting:async key=>values[key], setSetting:async(key,value)=>{values[key]=value;for(const f of storageListeners)f(key);},
        injectCSS:(id,css)=>{const s=document.createElement('style');s.id='style-'+id;s.textContent=css;document.head.append(s);},
        removeCSS:id=>document.getElementById('style-'+id)?.remove(),
        injectScript:()=>queueMicrotask(()=>window.dispatchEvent(new CustomEvent('vkify-script-ready',{detail:{name:'equalizer'}}))),
        sendEvent:()=>{}, onStorageChange:f=>{storageListeners.add(f);return()=>storageListeners.delete(f);}, selectors:{music:{playerCover:'#player-cover'}}
      };
      const visualizer=createMusicVisualizerFeature(ctx).music_visualizer;
      const lyrics=createMusicLyricsFeature(ctx).music_lyrics;
      window.fixture={visualizer,lyrics,values,ctx,listeners};
      window.message=(type)=>{let result;for(const f of listeners)f({type},{id:'fixture'},v=>result=v);return result;};
      window.ready=(async()=>{await visualizer.enable();await lyrics.enable();
        window.dispatchEvent(new CustomEvent('vkify:visualizer:data',{detail:{spectrum:[],waveform:[],playing:true,sampleRate:48000,fftSize:1024,playback:{track:{id:'1',artist:'Artist',title:'Song'},duration:60,currentTime:22}}}));
      })();
    ` }, tsconfig: 'tsconfig.app.json', bundle: true, write: false, format: 'iife' });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate('window.ready');
    await expect.poll(() => page.evaluate("window.message('VKIFY_LYRICS_SNAPSHOT')?.result?.synced")).toBe(true);
    await expect(page.locator('#vkify-music-visualizer')).toHaveCount(1);
    await expect(page.locator('#vkify-music-lyrics')).toHaveCount(1);
    await page.evaluate("window.message('VKIFY_LYRICS_EDIT')");
    await page.mouse.move(100, 300); await page.mouse.down(); await page.mouse.move(350, 360); await page.mouse.up();
    expect(await page.evaluate('JSON.parse(window.fixture.values.music_lyrics_settings).offsetX')).toBe(25);
    await page.keyboard.press('Escape');
    await expect(page.locator('#vkify-music-lyrics')).toHaveCSS('pointer-events', 'none');
    await page.locator('#underlying').click(); await expect(page.locator('#underlying')).toHaveText('clicked');
    await page.evaluate("window.message('VKIFY_VISUALIZER_EDIT')");
    await page.mouse.move(100, 300); await page.mouse.down(); await page.mouse.move(200, 330); await page.mouse.up();
    expect(await page.evaluate('JSON.parse(window.fixture.values.music_visualizer_settings).offsetX')).toBe(10);
    expect(await page.evaluate('JSON.parse(window.fixture.values.music_lyrics_settings).offsetX')).toBe(25);
    await page.keyboard.press('Escape');
    await page.evaluate('window.fixture.visualizer.disable()');
    await expect(page.locator('#vkify-music-visualizer')).toHaveCount(0);
    await expect(page.locator('#vkify-music-lyrics')).toHaveCount(1);
    await page.evaluate("window.fixture.ctx.setSetting('music_lyrics_settings',JSON.stringify({...JSON.parse(window.fixture.values.music_lyrics_settings),lyricsShowCover:true,width:65,offsetX:30,offsetY:0}))");
    await page.evaluate("window.message('VKIFY_LYRICS_EDIT')");
    await page.mouse.move(90, 80); await page.mouse.down(); await page.mouse.move(240, 150); await page.mouse.up();
    expect(await page.evaluate('JSON.parse(window.fixture.values.music_lyrics_settings).lyricsCoverX')).toBeGreaterThan(20);
    expect(await page.evaluate('JSON.parse(window.fixture.values.music_lyrics_settings).offsetX')).toBe(30);
    await page.keyboard.press('Escape');
    // Let the normal lyric fade finish before visual QA.
    await page.waitForTimeout(550);
    await page.screenshot({ path: testInfo.outputPath('lyrics-independent.png') });
    await page.evaluate('window.fixture.lyrics.disable()');
    expect(await page.evaluate('window.fixture.listeners.size')).toBe(0);
    await expect(page.locator('#vkify-music-lyrics')).toHaveCount(0);
  } finally { await browser.close(); }
});


test('lyrics settings preview, independent saves and TXT/LRC downloads', async ({}, testInfo) => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 560, height: 900 } });
    await page.setContent('<style>:root{--bg-primary:#171c29;--bg-secondary:#21283a;--bg-tertiary:#30394e;--text-primary:#f5f7ff;--text-secondary:#9da9c1;--border-color:#30394e}body{margin:0;background:#0c101b;color:#f5f7ff;font-family:system-ui}#root{padding:16px;max-width:520px;margin:auto}</style><div id="root" class="ready"></div>');
    await page.addStyleTag({ path: 'dist/chrome/assets/popup.css' });
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import i18next from 'i18next'; import { initReactI18next } from 'react-i18next';
      import ru from './src/locales/ru/center.json';
      import MusicLyricsPage from './src/popup/components/tabs/center/music/MusicLyricsPage.tsx';
      import { useVKifyStore } from '@/popup/store/index.js';
      window.state=useVKifyStore;
      window.chrome={runtime:{sendMessage:async message=>({success:true,data:message.action==='edit'?{success:true}:{track:{id:'1',artist:'Artist',title:'Song'},result:{source:'lrclib',synced:true,lyrics:'First line\\nSecond line',lines:[{text:'First line',startTime:5,endTime:10},{text:'Second line',startTime:10,endTime:20}]}}})}};
      i18next.use(initReactI18next).init({lng:'ru',resources:{ru:{center:ru,common:{}}},interpolation:{escapeValue:false}}).then(()=>createRoot(document.getElementById('root')).render(<MusicLyricsPage/>));
    ` }, tsconfig: 'tsconfig.app.json', bundle: true, write: false, format: 'iife', define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'fixture-store', setup(plugin) {
      plugin.onResolve({ filter: /^@\/popup\/store\/index\.js$/ }, () => ({ path: 'store', namespace: 'fixture' }));
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ resolveDir: process.cwd(), contents: `import {create} from 'zustand'; export const useVKifyStore=create((set,get)=>({settings:{music_lyrics:true,music_lyrics_settings:'{}',music_visualizer:true,music_visualizer_settings:'{"mode":"wave"}'},saveSetting:async(key,value)=>{set({settings:{...get().settings,[key]:value}});return true;}}));` }));
    } }] });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.getByText('Artist — Song', { exact: true })).toBeVisible();
    await page.locator('#lyrics-lyricsSecondaryOpacity').fill('10');
    expect(await page.evaluate('JSON.parse(window.state.getState().settings.music_lyrics_settings).lyricsSecondaryOpacity')).toBe(10);
    expect(await page.evaluate('window.state.getState().settings.music_visualizer_settings')).toBe('{"mode":"wave"}');
    for (const format of ['TXT', 'LRC']) {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: format, exact: true }).click();
      const file = await pending;
      expect(file.suggestedFilename()).toBe('Artist — Song.' + format.toLowerCase());
      const body = await readFile((await file.path())!, 'utf8');
      expect(body).toContain(format === 'LRC' ? '[00:05.00]First line' : 'First line');
    }
    await page.addStyleTag({ content: '#root{opacity:1!important;transform:none!important;height:auto!important;overflow:visible!important;width:100%!important;max-width:520px!important;box-sizing:border-box!important}body{height:auto!important;overflow:auto!important;width:100%!important;min-width:0!important}' });
    await page.getByRole('button', { name: 'Остановить', exact: true }).click();
    await page.evaluate('window.scrollTo(0,0)');
    await page.screenshot({ path: testInfo.outputPath('lyrics-settings.png') });
  } finally { await browser.close(); }
});

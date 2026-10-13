import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

test('inline audio download feedback fits compact two-column track lists', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { DOWNLOAD_CONTROL_CSS } from './src/content/features/center/music/download/styles.ts';
      import { renderCompactTrackProgress } from './src/content/features/center/music/download/compact-progress.ts';
      const style=document.createElement('style');style.textContent=DOWNLOAD_CONTROL_CSS;document.head.append(style);
      window.showProgress=(text,kind='load') => { const status=document.querySelector('.vkify-dl-status'); status.className='vkify-dl-status is-visible s-'+kind; status.title=text;renderCompactTrackProgress(status.querySelector('.vkify-dl-status-text'),text,kind); };
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
    await page.setContent(`<style>
      #tracks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .track{display:flex;gap:8px;align-items:center;min-width:0;height:44px}
      .cover{width:40px;height:40px;flex:none;background:#ddd}.title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .after{display:flex;align-items:center;flex:none;font:12px Arial}
    </style><div id="tracks"><div class="track"><div class="cover"></div><div class="title">A long track title and artist</div><div class="after">3:16
      <div class="vkify-dl-status"><span class="vkify-dl-status-dot"></span><span class="vkify-dl-status-text"></span></div>
      </div></div><div class="track" id="neighbor"><div class="cover"></div><div class="title">Another track</div><div class="after">3:48</div></div></div><script>${bundle.outputFiles[0].text}</script>`);
    for (const width of [300,440,700]) {
      await page.locator('#tracks').evaluate((el,width) => (el as HTMLElement).style.width=width+'px',width);
      const before=await page.locator('#neighbor').boundingBox();
      for (const [text,kind,label] of [['Сегменты 11 / 12','load','92%'],['Конвертация 100%','load','100%'],['Download failed with a very long server response','err','!']]) {
        await page.evaluate(({text,kind}) => (window as unknown as {showProgress(text:string,kind:string):void}).showProgress(text,kind),{text,kind});
        await expect(page.locator('.vkify-dl-status-text')).toHaveText(label);
        await expect(page.locator('.vkify-dl-status')).toHaveAttribute('title',text);
        const status=await page.locator('.vkify-dl-status').boundingBox();
        const track=await page.locator('.track').first().boundingBox();
        expect(status!.width).toBeLessThanOrEqual(40);
        expect(status!.x+status!.width).toBeLessThanOrEqual(track!.x+track!.width);
        expect(track!.height).toBe(44);
        expect(await page.locator('#neighbor').boundingBox()).toEqual(before);
      }
      await page.evaluate(() => (window as unknown as {showProgress(text:string,kind:string):void}).showProgress('Сохранено','done'));
      await expect(page.locator('.vkify-dl-status-text svg')).toHaveAttribute('width','12');
      await expect(page.locator('.vkify-dl-status-text svg path')).toHaveCount(1);
      await expect(page.locator('.vkify-dl-status-text')).toHaveText('');
      await expect(page.locator('.vkify-dl-status-dot')).toBeHidden();
      await expect(page.locator('.vkify-dl-status')).toHaveAttribute('title','Сохранено');
    }
  } finally { await browser.close(); }
});

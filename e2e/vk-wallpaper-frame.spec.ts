import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';

test('wallpaper iframe hides recommendations inside shadow DOM before readiness and resumes on return', async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
  try {
    const page=await browser.newPage();
    const bundle=await build({entryPoints:['src/content/vk-wallpaper-frame.ts'],bundle:true,write:false,format:'iife'});
    await page.route('https://vkvideo.ru/video_ext.php**',route=>route.fulfill({contentType:'text/html',body:`<html><head><script>${bundle.outputFiles[0].text}</script></head><body>
      <div id="host"></div><div id="external">Recommendations</div><script>
      const root=document.getElementById('host').attachShadow({mode:'open'});
      root.innerHTML='<div class="player"><div><video></video></div><div id="recommendations">See also</div></div>';
      const video=root.querySelector('video');let paused=true;
      Object.defineProperty(video,'paused',{get:()=>paused});video.play=async()=>{paused=false};
      window.pauseFixture=()=>{paused=true;};
      </script></body></html>`}));
    await page.setContent('<iframe src="https://vkvideo.ru/video_ext.php?vkify_wallpaper=1"></iframe>');
    const frame=page.frameLocator('iframe');
    await expect(frame.locator('#recommendations')).toBeHidden();
    await expect(frame.locator('#external')).toBeHidden();
    await expect(frame.locator('video')).toBeVisible();
    const child=page.frames()[1];
    expect(await child.evaluate(()=>document.querySelector('#host')!.shadowRoot!.querySelector('video')!.loop)).toBe(true);
    await child.evaluate(()=>{
      (window as unknown as {pauseFixture():void}).pauseFixture();
      Object.defineProperty(document,'hidden',{configurable:true,value:false});
      document.dispatchEvent(new Event('visibilitychange'));
      const overlay=document.createElement('div');overlay.id='new-recommendations';overlay.textContent='See also';
      document.querySelector('#host')!.shadowRoot!.querySelector('.player')!.append(overlay);
    });
    await expect(frame.locator('#new-recommendations')).toBeHidden();
    expect(await child.evaluate(()=>document.querySelector('#host')!.shadowRoot!.querySelector('video')!.paused)).toBe(false);
    await page.goto('https://vkvideo.ru/video_ext.php');
    await expect(page.locator('#external')).toBeVisible();
  } finally {await browser.close();}
});

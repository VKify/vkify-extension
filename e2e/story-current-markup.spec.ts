import { test, expect, chromium } from '@playwright/test';
import { build } from './esbuild-fixture.js';

test('story download sits before menu in the playing card only', async () => {
  const browser = await chromium.launch({ headless:true, executablePath:process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const script = await build({stdin:{resolveDir:process.cwd(),contents:`
      import { injectFromData, removeUI } from './src/content/features/center/story/ui.ts';
      window.inject=()=>injectFromData({id:2,owner_id:-1,type:'photo',photo:{sizes:[{url:'https://example.com/photo.jpg',width:100,type:'x'}]}},{ownerId:-1,storyId:2});
      window.cleanup=removeUI;
    `},bundle:true,write:false,format:'iife',tsconfig:'tsconfig.app.json',define:{__VKIFY_SITE_URL__:JSON.stringify('https://vkify.ru')}});
    const card=(active:boolean)=>`<div data-story-playing="${active}"><header><div class="actions"><button><svg class="vkuiIcon--more_horizontal_24"></svg></button></div></header></div>`;
    await page.setContent(card(false)+card(true));
    await page.addScriptTag({content:script.outputFiles[0].text});
    await page.evaluate(()=>(window as any).inject());
    await expect(page.locator('[data-story-playing="true"] .actions > button')).toHaveCount(2);
    await expect(page.locator('[data-story-playing="false"] .actions > button')).toHaveCount(1);
    await expect(page.locator('[data-story-playing="true"] .actions > button').first()).toHaveAttribute('id', /vkify/);
    await page.evaluate(()=>(window as any).inject());
    await expect(page.locator('[data-story-playing="true"] .actions > button')).toHaveCount(2);
    await page.evaluate(()=>(window as any).cleanup());
    await expect(page.locator('.actions > button')).toHaveCount(2);
  } finally { await browser.close(); }
});

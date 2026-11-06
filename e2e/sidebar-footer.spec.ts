import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { installStyleRelations } from './style-relations-fixture.js';
for (const browserBuild of ['chrome', 'firefox']) for (const mode of ['standard', 'minimalistic_sidebar', 'tile_sidebar', 'edge_sidebar']) {
  test(`${browserBuild}: full ${mode} menu keeps its footer in flow after protection toggles`, async ({}, info) => {
    const browser = await chromium.launch({headless:true, executablePath:process.env.PW_CHROME_PATH});
    try {
      const page = await browser.newPage({viewport:{width:900,height:900}});
      const css = await readFile(`dist/${browserBuild}/styles/features.css`, 'utf8');
      const names=['Профиль','Лента','Мессенджер','Звонки','Друзья','Сообщества','Фото','Музыка','Видео','Сервисы','Голоса','Закладки','Файлы','Реклама','Помощь','VKify'];
      const menu=names.map((name,i)=>`<li data-testid="leftmenuitem" id="menu-${i}"><a href="/menu-${i}"><div><svg width="20" height="20"><rect x="2" y="2" width="16" height="16" rx="4" fill="none" stroke="currentColor"/></svg></div><span data-testid="leftmenuitem-label"><span data-testid="leftmenuitem-text">${name}</span></span></a></li>`).join('');
      const footer=`<div class="vkui-inset-block-start-2xl"><div id="ads_leftmenu"></div><div style="--vkui_internal--spacing_size:28px"><hr></div><ol class="vkit-PmdwbR">${[['l_blog','Блог'],['l_developers','Разработчикам'],['l_ad','Для бизнеса'],['l_vk_authors','Авторам']].map(([id,text])=>`<li id="${id}"><a href="/${id}"><span>${text}</span></a></li>`).join('')}<li><span tabindex="0"><span>Ещё</span></span></li></ol><div style="--vkui_internal--spacing_size:28px"><hr></div><ol><li id="l_content_disclaimer"><span role="button" tabindex="0"><span>Информация о контенте</span></span></li></ol></div>`;
      await page.setContent(`<html ${mode==='standard'?'':`data-vkify-${mode}`} data-vkify-block_left_ads><head><style>
      :root{--spa-layout-sidebar-width:164px;--spa-layout-header-height:48px;--vkui--color_background_content:#20232e;--vkui--color_background_secondary:#292d3a;--vkui--color_text_primary:#ddd;--vkui--color_text_secondary:#9ba4b8;--vkui--color_accent_blue:#82a4ff;--vkui--color_separator_primary:#383e50;--vkui--size_border_radius_paper--regular:12px}
      *{box-sizing:border-box}body{margin:0;font:13px Arial;color:#ddd;background:#181b23}header{height:48px;background:#20232e;padding:15px}#page_layout{display:flex;gap:16px;width:850px;margin:16px auto}#layout_sidebar{width:164px;flex:none}#page_body{flex:1;background:#20232e;padding:20px;border-radius:12px;height:550px}nav{display:block;position:relative;width:100%}ol{padding:0;margin:0;list-style:none}nav>ol>li>a{height:32px;display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;padding:4px}nav>ol>li>a>div{width:20px;flex:none}#ads_with_extra ol{display:flex;flex-wrap:wrap;gap:4px 8px}#ads_with_extra a{font:11px/18px Arial;color:#9ba4b8;text-decoration:none}#ads_with_extra li{font:11px/18px Arial}hr{border:0;border-top:1px solid #383e50}
      ${css}</style></head><body><div id="layout_wrapper_root"><header>ВКонтакте</header><div id="page_layout"><aside id="layout_sidebar"><div class="LeftMenu__root--fixture"><nav data-testid="leftmenu"><ol id="main-menu">${menu}</ol><div id="ads_wrapper"><div id="ads_with_extra">${footer}</div></div></nav></div></aside><main id="page_body">Обычная страница ВКонтакте</main></div></div></body></html>`);
      await installStyleRelations(page);
      if(mode==='minimalistic_sidebar') {
        const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`import {miniFooterPlugin} from './src/content/features/appearance/sidebar/mini-footer.ts'; import {domObserver} from './src/content/core/dom/dom-observer.ts'; miniFooterPlugin.setup({registerMutationObserver:(s,cb)=>domObserver.observeMatches(s,cb),observeChanges:(cb,opt)=>domObserver.observeChanges(cb,opt)});`},bundle:true,write:false,format:'iife',alias:{'@':resolve('src')},define:{'import.meta.env.DEV':'false'}});
        await page.addScriptTag({content:bundle.outputFiles[0].text});
      }
      for(const background of [false,true]) {
        await page.evaluate(value=>document.documentElement.toggleAttribute('data-vkify-sidebar_with_background',value),background);
        for(const enabled of [false,true,false]) {
          await page.evaluate(value=>document.documentElement.toggleAttribute('data-vkify-block_left_ads',value),enabled);
          if(enabled) {await expect(page.locator('#ads_wrapper')).toBeHidden();continue;}
          // Replay a stale measured width/position after the ad container was hidden.
          await page.locator('#ads_wrapper').evaluate(el=>{el.setAttribute('style','position:absolute;left:-999px;width:1px;height:0;transform:translateX(-50px)');});
          await page.locator('#ads_with_extra').evaluate((el,html)=>{el.innerHTML=html;},footer);
          if(mode==='minimalistic_sidebar') {
            const trigger=page.getByRole('button',{name:'VK links'});
            await page.mouse.move(800,10);
            await expect(page.locator('#ads_with_extra > div')).toBeHidden();
            await trigger.hover();
            await expect(page.locator('#l_blog a')).toBeVisible();
            const buttonBox=(await trigger.boundingBox())!;
            await page.mouse.move(buttonBox.x+buttonBox.width+3,buttonBox.y+buttonBox.height/2,{steps:12});
            // Stay in the gap beyond the close delay: this must be a hover
            // bridge, not a race against scheduler/CI latency.
            await page.waitForTimeout(450);
            await page.locator('#l_blog a').hover();
            // Survive every pending close timer while the pointer is on a link.
            await page.waitForTimeout(450);
            await expect(page.locator('#l_blog a')).toBeVisible();
            await page.locator('#l_blog a').evaluate(el=>el.addEventListener('click',event=>{event.preventDefault();el.setAttribute('data-clicked','true');},{once:true}));
            await page.locator('#l_blog a').click();
            await expect(page.locator('#l_blog a')).toHaveAttribute('data-clicked','true');
            await expect(trigger).toHaveAttribute('aria-expanded','true');
            await expect(trigger).toHaveCount(1);
            expect((await trigger.boundingBox())!.width).toBeLessThanOrEqual(40);
            const popup=(await page.locator('#ads_with_extra > div').boundingBox())!;
            expect(popup.x).toBeGreaterThanOrEqual(0);expect(popup.x+popup.width).toBeLessThanOrEqual(900);
            expect(popup.y).toBeGreaterThanOrEqual(0);expect(popup.y+popup.height).toBeLessThanOrEqual(900);
            await page.locator('#l_blog a').evaluate(el=>(el as HTMLElement).blur());

            continue;
          }
          await expect(page.locator('#l_blog a')).toBeVisible();
          const geometry=await page.evaluate(()=>{
            const box=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect().toJSON();
            return {list:box('#main-menu'),footer:box('#ads_wrapper'),sidebar:box('#layout_sidebar'),links:[...document.querySelectorAll('#ads_with_extra li > a')].map(el=>el.getBoundingClientRect().toJSON())};
          });
          expect(geometry.footer.y).toBeGreaterThanOrEqual(geometry.list.y+geometry.list.height);
          expect(geometry.footer.x).toBeGreaterThanOrEqual(geometry.sidebar.x-1);
          expect(geometry.footer.x+geometry.footer.width).toBeLessThanOrEqual(geometry.sidebar.x+geometry.sidebar.width+1);
          expect(geometry.footer.width).toBeGreaterThan(130);
          if(mode==='minimalistic_sidebar'){expect(geometry.list.width).toBe(40);expect(geometry.list.x+geometry.list.width).toBeCloseTo(geometry.footer.x+geometry.footer.width,0);}
          expect(geometry.footer.x).toBeGreaterThanOrEqual(0);
          expect(geometry.footer.x+geometry.footer.width).toBeLessThanOrEqual(900);
          for(const link of geometry.links){expect(link.x).toBeGreaterThanOrEqual(geometry.footer.x);expect(link.x+link.width).toBeLessThanOrEqual(geometry.footer.x+geometry.footer.width+1);}
        }
      }
      await page.screenshot({path:info.outputPath(`${mode}.png`),fullPage:true});
      for(const height of [500,900]) {
        await page.setViewportSize({width:900,height});
        if(mode==='minimalistic_sidebar') {
          const trigger=page.getByRole('button',{name:'VK links'});
          await trigger.scrollIntoViewIfNeeded();await trigger.focus();
          await expect(page.locator('#l_blog a')).toBeVisible();
          await trigger.press('Escape');
          // Reproduce late browser events after focus has returned to the trigger.
          await page.evaluate(() => { window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize')); });
          await expect(page.locator('#ads_with_extra > div')).toBeHidden();
          await expect(trigger).toBeFocused();
          await expect(trigger).toHaveAttribute('aria-expanded','false');
          await trigger.press('Enter');await trigger.press('Tab');
        } else await page.locator('#l_blog a').focus();
        await expect(page.locator('#l_blog a')).toBeInViewport();
      }
    } finally {await browser.close();}
  });
}

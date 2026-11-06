import {test,expect,chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {installStyleRelations} from './style-relations-fixture.js';
for(const build of ['chrome','firefox']) test(`${build}: leaving the edge rail restores content-sized menu cards`,async({},info)=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
  try{
    const page=await browser.newPage({viewport:{width:1200,height:900}});
    const css=await readFile(`dist/${build}/styles/features.css`,'utf8');
    const footer=await readFile('e2e/fixtures/vk-sidebar-footer.html','utf8');
    await page.setContent(`<html data-vkify-sidebar_with_background data-vkify-fixed_sidebar data-vkify-block_left_ads><head><style>
      :root{--spa-layout-header-height:48px;--spa-layout-sidebar-width:164px;--vkui--color_background_content:#222735;--vkui--color_text_secondary:#a0abc0;--vkui--color_accent_blue:#83a5ff;--vkui--color_separator_primary:#3b4356;--vkui--size_border_radius_paper--regular:12px}*{box-sizing:border-box}body{margin:0;background:#191d27;color:#eee;font:13px Arial}header{height:48px;padding:15px}#page_layout{display:flex;width:1000px;margin:16px auto;gap:16px}#layout_sidebar{flex:none;width:164px}.LeftMenu__root--native{min-height:0}nav{width:100%;border:1px solid #3b4356}ol{list-style:none;margin:0;padding:0}nav>ol>li>a{display:flex;align-items:center;gap:10px;height:32px;padding:4px;color:inherit;text-decoration:none}nav>ol>li>a>div{width:20px;flex:none}main{flex:1;height:2000px;background:#222735;padding:20px}#ads_with_extra ol{display:flex;flex-wrap:wrap;gap:4px 8px}#ads_with_extra a{color:inherit} ${css}
      </style></head><body><div id="layout_wrapper_root"><header>ВКонтакте</header><div id="page_layout"><aside id="layout_sidebar"><div class="LeftMenu__root--native"><nav data-testid="leftmenu"><ol id="main-menu">${['Профиль','Лента','Сообщества','Музыка','Помощь','Настройки'].map((name,i)=>`<li data-testid="leftmenuitem"><a href="/test"><div><svg width="20" height="20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor"/></svg></div><span data-testid="leftmenuitem-label"><span data-testid="leftmenuitem-text">${name}</span></span></a></li>`).join('')}</ol>${footer}</nav></div></aside><main>Длинная страница</main></div></div></body></html>`);
    await installStyleRelations(page);
    await page.locator('#ads_with_extra').evaluate(el=>{const button=document.createElement('button');button.dataset.vkifyFooterTrigger='';button.textContent='•••';el.prepend(button);});
    for(const height of [700,1000]) {
      await page.setViewportSize({width:1200,height});
      for(const mode of ['tile_sidebar','minimalistic_sidebar','standard','minimalistic_sidebar','tile_sidebar','standard']) for(const ads of [true,false]) {
        await page.evaluate(({height,ads})=>{
          const root=document.documentElement;
          for(const mode of ['tile_sidebar','minimalistic_sidebar'])root.removeAttribute('data-vkify-'+mode);
          root.setAttribute('data-vkify-edge_sidebar','');root.toggleAttribute('data-vkify-block_left_ads',ads);
          // Replay the exact stale dimension found in the supplied outerHTML.
          document.querySelector<HTMLElement>('#ads_wrapper')!.style.minHeight='262px';
        },{height,ads});
        await expect(page.locator('#layout_sidebar')).toHaveCSS('height',`${height-48}px`);
        await page.evaluate(mode=>{const root=document.documentElement;root.removeAttribute('data-vkify-edge_sidebar');if(mode!=='standard')root.setAttribute('data-vkify-'+mode,'');},mode);
        if(!ads) {
          await expect(page.locator('#ads_wrapper')).toHaveCSS('min-height','0px');
          await expect(page.locator('#ads_wrapper')).toHaveAttribute('style',/min-height: 262px/);
          await page.locator('#ads_leftmenu').evaluate(el=>el.innerHTML='<div>Native ad</div>');
          await expect(page.locator('#ads_wrapper')).toHaveCSS('min-height','262px');
          await page.locator('#ads_leftmenu').evaluate(el=>el.replaceChildren());
          await expect(page.locator('#ads_wrapper')).toHaveCSS('min-height','0px');
        }
        const boxes=await page.evaluate(()=>{const b=(s:string)=>document.querySelector(s)!.getBoundingClientRect().toJSON();return {root:b('[class*="LeftMenu__root"]'),nav:b('nav'),list:b('#main-menu'),footer:b('#ads_wrapper'),footerContent:b('#ads_with_extra')};});
        if(!ads) expect(boxes.footer.height).toBeCloseTo(boxes.footerContent.height,0);
        expect(boxes.nav.height).toBeLessThan(500);
        expect(boxes.root.height).toBeCloseTo(boxes.nav.height,0);
        expect(boxes.nav.height).toBeGreaterThanOrEqual(boxes.list.height);
        expect(boxes.nav.height-boxes.list.height).toBeLessThan(230);
        if(height===1000&&!ads)await page.screenshot({path:info.outputPath(`${mode}.png`)});
      }
    }
  }finally{await browser.close();}
});

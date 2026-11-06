import {test,expect,chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {installStyleRelations} from './style-relations-fixture.js';
for(const browserBuild of ['chrome','firefox']) test(`${browserBuild}: menu side changes preserve header and columns and mirror native edge panels`,async({},info)=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1000}});
    const css=await readFile(`dist/${browserBuild}/styles/features.css`,'utf8');
    await page.setContent(`<html lang="en"><head><style>
      :root{--spa-layout-sidebar-width:164px;--spa-layout-header-height:48px;--vkify-cw:1000px;--vkui--color_background_content:#222735;--vkui--color_background_secondary:#30384a;--vkui--color_text_primary:#edf0f7;--vkui--color_text_secondary:#a0abc0;--vkui--color_accent_blue:#86a6ff;--vkui--color_separator_primary:#3b455c;--vkui--size_border_radius_paper--regular:12px}*{box-sizing:border-box}body{margin:0;background:#191d27;color:#eef;font:13px Arial}#layout_wrapper_root{padding-top:48px}.TopNavigationWrapper__outer{position:fixed;inset:0 0 auto;width:100%;height:48px;background:#222735}#page_header{width:1000px;max-width:100%;margin:auto;display:flex;gap:24px;height:48px;align-items:center}#header-profile{margin-left:auto}#page_layout{width:1000px;max-width:100%;margin:16px auto}.LayoutWrapper__body{display:flex}#layout_sidebar{width:164px;flex:none}#page_body{flex:1;min-width:0;background:#222735;padding:16px;min-height:750px;border-radius:12px}nav{width:100%}ol{list-style:none;padding:0;margin:0}nav>ol>li>a{display:flex;align-items:center;gap:10px;height:32px;color:inherit;text-decoration:none;padding:4px}nav>ol>li>a>div{width:20px;flex:none}.profile-row{display:flex;gap:16px}#wall{flex:1}#profile-aside{width:220px}#ads_with_extra ol{display:flex;flex-wrap:wrap;gap:4px 8px}.FCApp .FCPanel{position:fixed;right:26px;bottom:0;width:52px;height:180px;background:#33425a}.FCApp .FCPanel--wide{width:148px}.FCPanel__widthToggle{position:absolute;right:0;top:-32px}.FCWindow{position:fixed;bottom:0;width:280px;height:180px;background:#2c3a50;padding:12px;border:1px solid #4c5e7a}#stl_side{position:fixed;left:0;top:90px;width:24px;height:70px;background:#40506d} ${css}
      </style></head><body><div id="layout_wrapper_root"><div class="TopNavigationWrapper__outer"><div id="page_header"><div id="header-logo">ВКонтакте</div><div id="header-search">Поиск</div><div id="header-profile">Профиль</div></div></div><div id="page_layout"><div class="LayoutWrapper__body"><aside id="layout_sidebar"><div class="LeftMenu__root--fixture"><nav data-testid="leftmenu"><ol>${['Профиль','Лента','Мессенджер','Друзья','Сообщества','Музыка','Видео','Настройки'].map((n,i)=>`<li data-testid="leftmenuitem"><a href="/test"><div><svg width="20" height="20"><rect x="2" y="2" width="16" height="16" rx="5" fill="none" stroke="currentColor"/></svg></div><span data-testid="leftmenuitem-label"><span data-testid="leftmenuitem-text">${n}</span></span></a></li>`).join('')}</ol><div id="ads_wrapper" style="min-height:262px"><div id="ads_with_extra"><div><ol><li id="l_blog"><a href="/blog"><span>Блог</span></a></li><li><a href="/developers"><span>Разработчикам</span></a></li></ol></div></div></div></nav></div></aside><main id="page_body"><div class="profile-row"><section id="wall"><h2>Стена профиля</h2><p>Порядок текста и колонок сохранён</p></section><aside id="profile-aside">Блоки профиля</aside></div></main></div></div></div><div class="FCApp"><aside class="FCPanel"><button class="FCPanel__widthToggle">↔</button>Мини-чаты</aside><div class="FCWindow" id="chat-one" style="right:90px">Первый чат</div><div class="FCWindow" id="chat-two" style="right:380px">Второй чат</div></div><div id="stl_side">↑</div></body></html>`);
    await installStyleRelations(page);
    const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
      import {rightChatPlugin} from './src/content/features/appearance/sidebar/sidebar-right.ts';
      import {miniFooterPlugin} from './src/content/features/appearance/sidebar/mini-footer.ts';
      import {domObserver} from './src/content/core/dom/dom-observer.ts';
      let stop;let off=[];
      const context={registerMutationObserver:(s,cb)=>{const unsub=domObserver.observeMatches(s,cb);off.push(unsub);return unsub;},observeChanges:(cb,opt)=>domObserver.observeChanges(cb,opt)};
      miniFooterPlugin.setup(context);
      window.setMenuSide=value=>{if(stop){stop();stop=undefined;}off.forEach(f=>f());off=[];if(value)stop=rightChatPlugin.setup(context);document.documentElement.toggleAttribute('data-vkify-sidebar_right',value);};
    `},bundle:true,write:false,format:'iife',alias:{'@':resolve('src')},define:{'import.meta.env.DEV':'false'}});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    for(const viewport of [900,1600]) {
    await page.setViewportSize({width:viewport,height:1000});
    for(const mode of ['standard','tile_sidebar','minimalistic_sidebar','edge_sidebar']) {
      await page.evaluate(mode=>{const el=document.documentElement;for(const flag of ['tile_sidebar','minimalistic_sidebar','edge_sidebar'])el.removeAttribute('data-vkify-'+flag);if(mode!=='standard')el.setAttribute('data-vkify-'+mode,'');},mode);
      for(const right of [false,true,false,true]) {
        await page.evaluate(value=>(window as any).setMenuSide(value),right);
        await expect(page.locator('.FCPanel')).toHaveCSS(right?'left':'right','26px');
        if(right)await expect(page.locator('[data-vkify-layout-body]')).toHaveCount(1);
        const geometry=await page.evaluate(()=>{const b=(s:string)=>document.querySelector(s)!.getBoundingClientRect().toJSON();return {menu:b('#layout_sidebar'),content:b('#page_body'),logo:b('#header-logo'),search:b('#header-search'),profile:b('#header-profile'),wall:b('#wall'),aside:b('#profile-aside'),chat:b('#chat-one'),second:b('#chat-two'),up:b('#stl_side'),direction:getComputedStyle(document.body).direction};});
        if(mode==='edge_sidebar') {
          expect(right?geometry.menu.x+geometry.menu.width:geometry.menu.x).toBe(right?viewport:0);
          if(right)expect(geometry.content.x+geometry.content.width).toBeLessThanOrEqual(geometry.menu.x-16+1);
          else expect(geometry.content.x).toBeGreaterThanOrEqual(geometry.menu.x+geometry.menu.width+16-1);
        } else if(right)expect(geometry.menu.x).toBeGreaterThanOrEqual(geometry.content.x+geometry.content.width-1);
        else expect(geometry.menu.x+geometry.menu.width).toBeLessThanOrEqual(geometry.content.x+1);
        expect(geometry.logo.x).toBeLessThan(geometry.search.x);expect(geometry.search.x).toBeLessThan(geometry.profile.x);
        expect(geometry.wall.x).toBeLessThan(geometry.aside.x);expect(geometry.direction).toBe('ltr');
        expect(right?geometry.chat.x:viewport-geometry.chat.x-geometry.chat.width).toBe(90);
        expect(right?geometry.second.x:viewport-geometry.second.x-geometry.second.width).toBe(380);
        expect(right?geometry.up.x+geometry.up.width:geometry.up.x).toBe(right?viewport:0);
      }
      if(mode==='minimalistic_sidebar') {
        const trigger=page.getByRole('button',{name:'VK links'});await trigger.hover();
        await expect(page.locator('#ads_with_extra > div')).toBeVisible();
        const panel=(await page.locator('#ads_with_extra > div').boundingBox())!,button=(await trigger.boundingBox())!;
        expect(panel.x+panel.width).toBeLessThanOrEqual(button.x-5);
        await page.mouse.move(button.x-3,button.y+button.height/2,{steps:12});
        await page.waitForTimeout(450);
        await expect(page.locator('#l_blog a')).toBeVisible();
        await page.locator('#l_blog a').hover();
        await page.mouse.move(800,10);
      }
      await page.screenshot({path:info.outputPath(`${mode}-right.png`),fullPage:true});
    }
    }
    await page.locator('#chat-one').evaluate(el=>(el as HTMLElement).style.right='480px');
    await expect(page.locator('#chat-one')).toHaveCSS('left','480px');
    await page.locator('.FCPanel').evaluate(el=>el.classList.add('FCPanel--wide'));
    await expect(page.locator('.FCPanel')).toHaveCSS('left','26px');await expect(page.locator('.FCPanel')).toHaveCSS('width','148px');
    await page.evaluate(()=>(window as any).setMenuSide(false));
    await expect(page.locator('#chat-one')).toHaveCSS('right','480px');
    expect(await page.locator('#chat-one').evaluate(el=>(el as HTMLElement).style.getPropertyValue('--vkify-chat-left'))).toBe('');
  }finally{await browser.close();}
});

for (const browserBuild of ['chrome', 'firefox']) test(`${browserBuild}: right mini menu fits native profile widths and moves item settings outside the rail`, async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1448, height: 1000 } });
    const css = await readFile(`dist/${browserBuild}/styles/features.css`, 'utf8');
    await page.setContent(`<style>
      :root { --spa-layout-sidebar-width:164px; --spa-layout-header-height:48px; --vkui--color_background_content:#222735; --vkui--color_text_primary:#edf0f7; --vkui--color_separator_primary:#3b455c }
      body { margin:0; color:#edf0f7; background:#191d27; font:14px Arial }
      #page_layout { width:1076px; padding:0 16px; margin:16px auto; position:relative }
      .LayoutWrapper__body { display:flex }
      #layout_sidebar { flex:0 0 auto; width:164px }
      .LeftMenu__root { width:164px; margin-left:-6px }
      nav { background:#222735; border-radius:12px }
      ol { padding:4px 0; margin:0; list-style:none }
      li { position:relative; height:30px }
      li > a { display:flex; align-items:center; padding:0 6px; height:30px; box-sizing:border-box; color:inherit }
      li > a > div { width:20px; flex:none }
      [data-testid="leftmenuitem-settings"] { position:absolute; left:-20px; top:0; width:16px; height:30px }
      #page_body { flex:1 1 auto; width:912px }
      .profile-cover { width:100%; height:260px; background:#222735; border-radius:12px }
      .profile-row { display:flex; gap:16px; margin-top:16px }
      .wall { width:550px; background:#222735; height:350px }
      .aside { width:346px; background:#222735 }
      #page_header { display:flex; width:1076px; padding:0 16px; height:48px; align-items:center; margin:auto; position:relative }
      [data-vkify-navigation-logo] { width:164px; flex:none }
      .Logo__root { display:block; width:136px }
      #profile { margin-left:auto }
      ${css}
    </style><header id="page_header"><div data-vkify-navigation-logo><a class="Logo__root"><span class="Logo__icon">VK</span></a></div><div id="search">Поиск</div><div id="profile">Профиль</div></header>
    <div id="page_layout"><div class="LayoutWrapper__body"><aside id="layout_sidebar"><div class="LeftMenu__root"><nav data-testid="leftmenu"><ol>${['Профиль','Лента','Музыка'].map(n=>`<li data-testid="leftmenuitem"><a href="#"><div>◉</div><span data-testid="leftmenuitem-label">${n}</span></a><button data-testid="leftmenuitem-settings" aria-label="Настройки">⚙</button></li>`).join('')}</ol></nav></div></aside><main id="page_body"><div class="profile-cover">Профиль</div><div class="profile-row"><section class="wall">Музыка</section><aside class="aside">Друзья</aside></div></main></div></div>`);
    await installStyleRelations(page);
    await page.locator('html').evaluate(el => el.setAttribute('data-vkify-minimalistic_sidebar', ''));
    for (const viewport of [1448, 1920]) {
      await page.setViewportSize({ width:viewport, height:1000 });
      let compactLogoSlot = 0;
      for (const right of [false, true, false, true]) {
        await page.locator('html').evaluate((el,right) => el.toggleAttribute('data-vkify-sidebar_right',right),right);
        const box = await page.evaluate(() => {
          const rect=(s:string)=>document.querySelector(s)!.getBoundingClientRect().toJSON();
          return { page:rect('#page_layout'),content:rect('#page_body'),rail:rect('nav'),logo:rect('.Logo__root'),search:rect('#search'),settings:rect('[data-testid="leftmenuitem-settings"]'),item:rect('li'),wall:rect('.wall'),aside:rect('.aside') };
        });
        expect(box.content.width).toBe(912);
        expect(box.wall.x + box.wall.width + 16).toBe(box.aside.x);
        if(right) {
          expect(box.search.x-box.logo.x).toBe(compactLogoSlot);
          expect(box.logo.width).toBe(24);
          expect(box.rail.x-box.content.right).toBe(16);
          expect(box.settings.x).toBeGreaterThanOrEqual(box.rail.right);
          expect(box.settings.x-box.item.right).toBe(4);
          expect(box.logo.x).toBe(box.content.x);
          expect((box.page.left+box.page.right)/2).toBe(viewport/2);
          expect(box.page.right).toBeLessThanOrEqual(viewport);
        } else {
          compactLogoSlot=box.search.x-box.logo.x;
          expect(box.settings.right).toBeLessThanOrEqual(box.item.left);
        }
      }
    }
    await page.locator('html').evaluate(el => el.removeAttribute('data-vkify-minimalistic_sidebar'));
    await expect(page.locator('[data-vkify-navigation-logo]')).toHaveCSS('width','164px');
    await expect(page.locator('.Logo__root')).toHaveCSS('width','136px');
    await page.locator('html').evaluate(el => el.setAttribute('data-vkify-minimalistic_sidebar',''));
    await expect(page.locator('[data-vkify-navigation-logo]')).toHaveCSS('width','48px');
    await page.screenshot({path:info.outputPath('native-profile-mini-right.png'),fullPage:true});
  } finally { await browser.close(); }
});

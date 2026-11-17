import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('current menu supports all appearance modes, both sides and live settings', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel:'chromium', headless:true, executablePath:process.env.PW_CHROME_PATH,
    viewport:{width:1400,height:900},
    args:['--disable-features=DisableLoadExtensionCommandLineSwitch',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(()=>worker.evaluate(async ()=>(await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(()=>chrome.storage.local.set({language:'ru',onboarding_done:true,first_run:false,hide_menu_footer:false,block_left_ads:false}));
    const page=await context.newPage();
    const item=(id:string,label:string)=>`<li id="${id}"><a href="/${id}" ${id==='l_msg'?'data-active':''}><div style="width:20px;height:20px"><svg width="20" height="20"></svg></div><span><span><div>${label}</div></span></span>${id==='l_msg'?'<span class="vkuiInternalCounter">3</span>':''}<span aria-hidden="true"></span></a><div role="button" aria-hidden="true"><svg></svg></div></li>`;
    await page.route('https://vk.ru/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<style>
      :root{--spa-layout-header-height:48px;--spa-layout-sidebar-width:164px;--vkui--color_background_content:#fff;--vkui--color_text_primary:#111;--vkui--color_accent_blue:#07f;--vkui--color_separator_primary:#ddd;--vkui--size_border_radius_paper--regular:12px}
      *{box-sizing:border-box}body{margin:0;font:13px Arial;background:#eee}#page_header_cont{height:48px}#page_header,#page_layout{width:1100px;margin:auto}#page_header{height:48px;display:flex}.LayoutWrapper__body--test{display:flex;align-items:flex-start}#layout_sidebar{width:164px;flex:none}.LeftMenu__root--test{width:164px}nav{width:100%}ol{list-style:none;margin:0;padding:0}nav>ol>li{position:relative}nav>ol>li>a{display:flex;align-items:center;height:32px;width:150px;padding:6px;gap:8px;color:#333;text-decoration:none}nav>ol>li>a>div{flex:none}nav>ol>li>[role=button]{position:absolute;left:-20px}#page_body{flex:1;min-width:0;padding:16px;background:white;height:1800px}.vkuiInternalCounter{background:#ddd;border-radius:10px}#ads_wrapper{margin-top:12px}#ads_with_extra>div{padding-top:16px}#ads_with_extra ol{display:flex;flex-wrap:wrap;gap:8px}
      </style><div id="layout_wrapper_root"><header id="page_header_cont"><div class="TopNavigationWrapper__outer--test"><div id="page_header"><div class="TopNavigation__logo--test"><a class="Logo__root--test"><svg class="Logo__icon--test" width="136" height="24"></svg></a></div></div></div></header><div id="page_layout"><div class="LayoutWrapper__body--test"><div id="layout_sidebar"><div class="LeftMenu__root--test"><nav><ol>${item('l_pr','Профиль')}${item('l_msg','Мессенджер')}<div><hr></div>${item('l_aud','Музыка')}${item('l_gr','Сообщества')}</ol><div id="ads_wrapper"><div id="ads_with_extra"><div><ol><li id="l_blog"><a href="/blog"><span>Блог</span></a></li><li id="l_developers"><a href="https://dev.vk.ru"><span>Разработчикам</span></a></li></ol></div></div></div></nav></div></div><div id="page_body" class="LayoutWrapper__content--test">Контент</div></div></div></div>`}));
    await page.goto('https://vk.ru/feed');
    const sidebar=page.locator('#layout_sidebar');
    const label=page.locator('#l_msg [data-vkify-menu-label]');
    for(const right of [false,true]) for(const mode of ['default','mini','tiles','edge']) {
      await worker.evaluate(({right,mode})=>chrome.storage.local.set({sidebar_right:right,minimalistic_sidebar:mode==='mini',tile_sidebar:mode==='tiles',edge_sidebar:mode==='edge',fixed_sidebar:mode!=='edge',sidebar_with_background:mode!=='edge',edge_sidebar_width:240,edge_sidebar_background:'custom',edge_sidebar_color:'#18233b',edge_sidebar_item_height:48,edge_sidebar_item_radius:18}),{right,mode});
      await expect.poll(()=>page.evaluate(()=>['sidebar_right','minimalistic_sidebar','tile_sidebar','edge_sidebar'].map(flag=>document.documentElement.hasAttribute('data-vkify-'+flag)))).toEqual([right,mode==='mini',mode==='tiles',mode==='edge']);
      await expect(page.locator('nav')).toHaveAttribute('data-vkify-menu-nav','');
      await expect(page.locator('[data-vkify-menu-item]')).toHaveCount(5);
      await expect(page.locator('#l_vkify_settings')).toHaveCount(1);
      await expect(page.locator('#l_vkify_settings > a')).toHaveAttribute('href','/vkify_settings');
      const counter=page.locator('#l_msg [data-vkify-menu-counter]');
      await expect(counter).toBeVisible();
      await worker.evaluate(()=>chrome.storage.local.set({hide_menu_counters:true,hide_menu_settings:true}));
      await expect(counter).toBeHidden();
      await expect(page.locator('#l_msg [data-vkify-menu-settings]')).toBeHidden();
      await expect(page.locator('#l_vkify_settings > a')).toBeVisible();
      await worker.evaluate(()=>chrome.storage.local.set({hide_menu_counters:false,hide_menu_settings:false}));
      await expect(counter).toBeVisible();
      const menuBox=await sidebar.boundingBox(), contentBox=await page.locator('#page_body').boundingBox();
      expect(right?menuBox!.x>=contentBox!.x+contentBox!.width-1:menuBox!.x+menuBox!.width<=contentBox!.x+1).toBe(true);
      if(mode==='mini') {
        await expect(page.locator('#l_msg > a')).toHaveCSS('width','32px');
        await expect(label).toBeHidden();
        await page.locator('#l_msg > a').focus();
        await expect(label).toBeVisible();
        const tooltip=await label.boundingBox(), link=await page.locator('#l_msg > a').boundingBox();
        expect(right?tooltip!.x+tooltip!.width<link!.x:tooltip!.x>link!.x+link!.width).toBe(true);
        await page.locator('[data-vkify-footer-trigger]').focus();
        await expect(page.locator('#ads_with_extra > div')).toBeVisible();
        await page.keyboard.press('Escape');
      } else await expect(label).toBeVisible();
      if(mode==='tiles') {
        await expect(page.locator('nav > ol')).toHaveCSS('display','grid');
        const boxes=await page.locator('[data-vkify-menu-item]').evaluateAll(els=>els.map(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y})));
        expect(new Set(boxes.map(b=>b.x)).size).toBe(2);
        await expect(page.locator('#l_msg [data-vkify-menu-counter]')).toBeVisible();
      }
      if(mode==='edge') {
        await expect(sidebar).toHaveCSS('position','fixed');
        await expect(sidebar).toHaveCSS('width','240px');
        await expect(page.locator('#l_msg > a')).toHaveCSS('border-radius','18px');
        await expect(page.locator('#l_msg > a')).toHaveCSS('min-height','48px');
        expect(Math.abs((await sidebar.boundingBox())!.x-(right?1160:0))).toBeLessThan(1);
      }
      await page.locator('#page_body').click();
    }
    await worker.evaluate(()=>chrome.storage.local.set({sidebar_right:false,minimalistic_sidebar:false,tile_sidebar:false,edge_sidebar:false,fixed_sidebar:false,sidebar_with_background:false}));
    await expect(page.locator('[data-vkify-menu-item]')).toHaveCount(0);
    await expect(page.locator('#l_msg > a > span').first()).toBeVisible();
    await expect(sidebar).toHaveCSS('position','static');
    await worker.evaluate(()=>chrome.storage.local.set({hide_menu_counters:true,hide_menu_settings:true}));
    await expect(page.locator('#l_msg .vkuiInternalCounter')).toBeHidden();
    await expect(page.locator('#l_msg > [role="button"]')).toBeHidden();
    await worker.evaluate(()=>chrome.storage.local.set({hide_menu_counters:false,hide_menu_settings:false}));
    await expect(page.locator('#l_msg .vkuiInternalCounter')).toBeVisible();
    await page.locator('#l_vkify_settings').evaluate(el=>el.remove());
    await expect(page.locator('#l_vkify_settings')).toHaveCount(1);
    await page.locator('#l_vkify_settings > a').click();
    await expect(page).toHaveURL('https://vk.ru/vkify_settings');
    await expect(page.locator('#vkify-embed-host')).toBeVisible();
    await expect(page.locator('#vkify-embed-iframe')).toBeVisible();
  } finally {await context.close();}
});

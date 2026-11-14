import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

test('VK theme menu lazily applies palettes and profiles, restores native modes and cleans up', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 540, height: 720 } });
    await page.goto('about:blank');
    await page.setContent(`<style>body{font:13px Arial;background:#edeef0;padding:30px;--vkui--color_text_primary:#222;--vkui--color_text_secondary:#818c99;--vkui--color_separator_primary:#e7e8ec;--vkui--color_text_accent:#0077ff} [data-testid=dropdownactionsheet-content]{background:white;border-radius:12px;box-shadow:0 4px 24px #0001;width:240px;padding:8px} .native-theme-row{display:flex;align-items:center;gap:8px;padding:10px 12px;min-height:38px;box-sizing:border-box;border-radius:6px;cursor:pointer}.native-theme-label{flex:1;font-size:13px;line-height:18px;font-weight:500}.native-theme-check{display:flex;margin-left:auto;color:var(--vkui--color_text_accent)}</style>`);
    await page.evaluate(() => {
      const data: Record<string, unknown> = { appearance_profiles: [{ id:'saved',name:'Моя тема',settings:{custom_theme:'#334455',custom_accent:'#ffcc00'},createdAt:1 }] };
      const listeners = new Set<Function>();
      (window as any).fixture = { data, reads:0, nativeClicks:0, escapeEvents:0, closeMenus:false, failWrites:false, listeners };
      (window as any).chrome = { runtime:{id:'test',sendMessage:async(message:any)=>{
        if(message.type==='INJECT_THEME_MENU') return (window as any).injectThemeMenu();
        return {ok:false};
      }},storage:{ local:{
        get:async () => { (window as any).fixture.reads++; return {...data}; },
        set:async (patch: Record<string,unknown>) => {
          if ((window as any).fixture.failWrites) throw new Error('Storage failed');
          const changes=Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,{oldValue:data[key],newValue:value}]));
          Object.assign(data,patch);listeners.forEach(fn=>fn(changes,'local'));
        },
      },onChanged:{addListener:(fn:Function)=>listeners.add(fn),removeListener:(fn:Function)=>listeners.delete(fn)}} };
    });
    let injections = 0;
    const optionalModule = await readFile('dist/chrome/theme-menu.js','utf8');
    await page.exposeFunction('injectThemeMenu',async()=>{
      injections++;
      await page.addScriptTag({content:optionalModule});
      return {ok:true};
    });
    const script = await build({ stdin:{ resolveDir:process.cwd(),contents:`
      import { startThemeMenuLoader } from './src/content/embed/theme-menu-loader.ts';
      startThemeMenuLoader();
    ` },bundle:true,write:false,format:'iife',define:{'import.meta.env.DEV':'false'},tsconfig:'tsconfig.app.json' });
    await page.addScriptTag({content:script.outputFiles[0].text});
    expect(await page.evaluate(()=>(window as any).fixture.reads)).toBe(0);
    expect(injections).toBe(0);
    const insert = () => page.evaluate(() => {
      let root=document.querySelector('[data-testid="header-profile-menu"]');
      if(!root){root=document.createElement('div');root.setAttribute('data-testid','header-profile-menu');document.body.append(root);}
      if (!root.querySelector('#theme-trigger')) {
        const trigger=document.createElement('button');trigger.id='theme-trigger';trigger.innerHTML='Тема: <span>Системная</span>';root.append(trigger);
        (window as any).fixture.nativeThemeText=trigger.querySelector('span')!.firstChild;
      }
      const menu=document.createElement('div');menu.dataset.testid='dropdownactionsheet-content';
      const shell=document.createElement('div');shell.dataset.testid='theme-float';shell.style.cssText='position:fixed;left:70px;top:80px';
      const sheet=document.createElement('div');sheet.dataset.testid='dropdownactionsheet';sheet.setAttribute('role','dialog');
      sheet.append(menu);shell.append(sheet);
      menu.innerHTML=['Светлая','Тёмная','Системная'].map(text=>'<div role="button" tabindex="0" class="native-theme-row" data-testid="dropdownactionsheet-item"><span class="native-theme-label">'+text+'</span></div>').join('');
      menu.firstElementChild!.addEventListener('click',()=>{
        (window as any).fixture.nativeClicks++;
        (window as any).fixture.nativeThemeText.nodeValue='Светлая';
      });
      menu.addEventListener('keydown',event=>{
        if(event.key==='Escape') {
          (window as any).fixture.escapeEvents++;
          if((window as any).fixture.closeMenus) {
            shell.style.left='0px';
            (window as any).fixture.escapeVisibility=getComputedStyle(menu).visibility;
            setTimeout(()=>shell.remove(),80);
          }
        }
      });
      document.querySelector('[data-testid="header-profile-menu"]')!.append(shell);
    });
    await insert();
    const menu=page.getByTestId('dropdownactionsheet-content');
    await expect(menu.getByRole('button',{name:'Dracula',exact:true})).toBeVisible();
    expect(injections).toBe(1);
    const rowMetrics = (el: Element) => {
      const root = getComputedStyle(el), label = getComputedStyle(el.querySelector('.native-theme-label')!);
      return { padding:root.padding,height:el.getBoundingClientRect().height,radius:root.borderRadius,font:label.font };
    };
    expect(await menu.getByRole('button',{name:'Dracula',exact:true}).evaluate(rowMetrics))
      .toEqual(await menu.getByRole('button',{name:'Светлая',exact:true}).evaluate(rowMetrics));
    await expect(menu.locator('h4')).toHaveCount(0);
    await expect(menu.getByRole('button',{name:'Dracula',exact:true}).locator('.vkify-theme-menu-swatch')).toHaveCount(1);
    await expect(menu.getByRole('button',{name:'Dracula',exact:true}).locator('.vkify-theme-menu-swatch')).toHaveCSS('background-image',/linear-gradient/);
    await expect(menu.getByRole('button',{name:'Светлая',exact:true}).locator('.vkify-theme-menu-swatch')).toHaveCount(0);
    expect(await menu.locator('[data-vkify-theme-list]').evaluate(el=>getComputedStyle(el).overflowY)).not.toBe('auto');
    const initialReads=await page.evaluate(()=>(window as any).fixture.reads);
    await page.evaluate(async()=>chrome.storage.local.set({stats_ads_blocked:12}));
    expect(await page.evaluate(()=>(window as any).fixture.reads)).toBe(initialReads);
    await menu.getByRole('button',{name:'Dracula',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as any).fixture.data.custom_theme)).toBe('#282a36');
    await expect(menu.getByRole('button',{name:'Dracula',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(menu).toHaveAttribute('data-vkify-custom-theme-active','');
    expect(await page.evaluate(()=>(window as any).fixture.escapeEvents)).toBe(0);
    await expect(page.locator('#theme-trigger')).toHaveText('Тема: Dracula');
    await expect(menu).toBeVisible();
    await menu.getByRole('button',{name:'Моя тема',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as any).fixture.data.custom_theme)).toBe('#334455');
    await expect(menu.getByRole('button',{name:'Моя тема',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#theme-trigger')).toHaveText('Тема: Моя тема');
    await expect(menu.getByRole('button',{name:'Моя тема',exact:true}).locator('.vkify-theme-menu-swatch')).toHaveCSS('background-image',/rgb\(51, 68, 85\).*rgb\(255, 204, 0\)/);
    await menu.getByRole('button',{name:'Светлая',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as any).fixture.data.custom_theme)).toBe('');
    expect(await page.evaluate(()=>(window as any).fixture.nativeClicks)).toBe(1);
    await expect(menu).not.toHaveAttribute('data-vkify-custom-theme-active','');
    await expect(page.locator('#theme-trigger')).toHaveText('Тема: Светлая');
    expect(await page.evaluate(()=>document.querySelector('#theme-trigger span')!.firstChild===(window as any).fixture.nativeThemeText)).toBe(true);
    await menu.getByRole('button',{name:'Системная',exact:true}).focus();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('button',{name:'Моя тема',exact:true})).toBeFocused();
    await menu.getByRole('button',{name:'Моя тема',exact:true}).click();
    await menu.screenshot({path:info.outputPath('vk-theme-menu.png')});
    await page.evaluate(()=>{
      document.body.style.setProperty('--vkui--color_text_primary','#e1e3e6');
      document.body.style.setProperty('--vkui--color_separator_primary','#363738');
      const style=document.createElement('style');style.textContent='body{background:#141414;color:#e1e3e6}[data-testid=dropdownactionsheet-content]{background:#222}';document.head.append(style);
    });
    await menu.screenshot({path:info.outputPath('vk-theme-menu-dark.png')});
    await menu.evaluate(el=>el.remove());
    await expect.poll(()=>page.evaluate(()=>(window as any).fixture.listeners.size)).toBe(1);
    await insert();
    await expect(page.locator('[data-vkify-theme-menu]')).toHaveCount(1);
    expect(injections).toBe(1);
    await expect(menu.getByRole('button',{name:'Моя тема',exact:true})).toHaveAttribute('aria-pressed','true');
    // A failed write keeps the native popover open so the user can retry.
    await page.evaluate(()=>{ (window as any).fixture.failWrites=true;(window as any).fixture.closeMenus=true; });
    await menu.getByRole('button',{name:'Dracula',exact:true}).click();
    await expect(menu.getByRole('alert')).toContainText('Не удалось применить тему');
    await expect(menu).toBeVisible();
    await page.evaluate(()=>{ (window as any).fixture.failWrites=false; });
    await menu.getByRole('button',{name:'Dracula',exact:true}).click();
    await expect(menu).toBeVisible();
    await expect(page.locator('#theme-trigger')).toHaveText('Тема: Dracula');
    expect(await page.evaluate(()=>(window as any).fixture.escapeEvents)).toBe(0);
    // VK may rerender its original mode label: keep the selected VKify name.
    await page.evaluate(()=>{(window as any).fixture.nativeThemeText.nodeValue='Системная';});
    await expect(page.locator('#theme-trigger')).toHaveText('Тема: Dracula');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>(window as any).fixture.escapeVisibility)).toBe('hidden');
    await expect(menu).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>(window as any).fixture.listeners.size)).toBe(1);
    // Changes in the settings UI also update the parent menu with the list closed.
    await page.evaluate(async()=>chrome.storage.local.set({custom_theme:'#2e3440',custom_accent:'#88c0d0'}));
    await expect(page.locator('#theme-trigger')).toHaveText('Тема: Nord');
    await page.evaluate(()=>{ (window as any).fixture.closeMenus=false; });
    await insert();
    await expect(menu.getByRole('button',{name:'Nord',exact:true})).toHaveAttribute('aria-pressed','true');
    // During an outside-click exit, VK can reset fixed positioning before it
    // unmounts the popup. It must already be invisible at that point.
    await page.evaluate(()=>{
      const outside=document.createElement('button');outside.id='close-outside';outside.textContent='Закрыть меню';outside.style.cssText='position:fixed;right:0;top:0';
      outside.addEventListener('pointerdown',()=>{
        const shell=document.querySelector<HTMLElement>('[data-testid="theme-float"]:last-child')!;
        shell.style.left='0px';
        (window as any).fixture.outsideVisibility=getComputedStyle(shell).visibility;
        setTimeout(()=>shell.remove(),80);
      });document.body.append(outside);
    });
    await page.locator('#close-outside').click();
    expect(await page.evaluate(()=>(window as any).fixture.outsideVisibility)).toBe('hidden');
    await expect(menu).toHaveCount(0);
    await insert();
    await expect(menu.getByRole('button',{name:'Nord',exact:true})).toBeVisible();
    // Reject unrelated three-item menus inside the same profile popover.
    await menu.evaluate(el=>el.remove());
    await page.evaluate(()=>{
      const el=document.createElement('div');el.dataset.testid='dropdownactionsheet-content';
      el.innerHTML=['One','Two','Three'].map(x=>'<div data-testid="dropdownactionsheet-item">'+x+'</div>').join('');
      document.querySelector('[data-testid="header-profile-menu"]')!.append(el);
    });
    await expect(page.locator('[data-vkify-theme-menu]')).toHaveCount(0);
    await page.getByTestId('header-profile-menu').evaluate(el=>el.remove());
    await expect.poll(()=>page.evaluate(()=>(window as any).fixture.listeners.size)).toBe(0);
  } finally { await browser.close(); }
});

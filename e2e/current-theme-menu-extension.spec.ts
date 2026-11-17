import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('built extension restores presets and saved themes in a detached native dropdown without test IDs', async () => {
  const extension=resolve('dist/chrome');
  const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,executablePath:process.env.PW_CHROME_PATH,
    args:['--disable-features=DisableLoadExtensionCommandLineSwitch',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try {
    const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
    await expect.poll(()=>worker.evaluate(async()=>(await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(()=>chrome.storage.local.set({language:'ru',onboarding_done:true,first_run:false,appearance_profiles:[{id:'saved',name:'Моя тема',settings:{custom_theme:'#334455',custom_accent:'#ffcc00'},createdAt:1}]}));
    const page=await context.newPage();
    await page.route('https://vk.ru/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<style>
      body{font:13px Arial} [role=dialog]{position:fixed;left:50px;top:80px;width:240px;background:#fff}
      .native-row{display:flex;align-items:center;min-height:38px;padding:8px 12px;gap:8px;box-sizing:border-box}
      </style><div class="EcoPlate-module_menu__current" data-is-vkcom="true"><div role="button" tabindex="0" id="theme-trigger">Тема: <span>Системная</span></div></div>
      <script>
      document.querySelector('#theme-trigger').onclick=()=>{
        document.querySelector('#theme-dialog')?.remove();
        const dialog=document.createElement('div');dialog.id='theme-dialog';dialog.setAttribute('role','dialog');
        const content=document.createElement('div');dialog.append(content);document.body.append(dialog);
        requestAnimationFrame(()=>{content.innerHTML=['Светлая','Тёмная','Системная'].map((name,i)=>'<div class="native-row" role="button" tabindex="0"><div></div><span>'+name+'</span>'+(i===2?'<svg class="vkuiIcon--check_alt_20"></svg>':'')+'</div>').join('')});
      };
      document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('#theme-dialog')?.remove()});
      </script>`}));
    await page.goto('https://vk.ru/feed');
    const open=()=>page.locator('#theme-trigger').click();
    await open();
    const menu=page.locator('#theme-dialog');
    await expect(menu.getByRole('button',{name:'GitHub Dark',exact:true})).toBeVisible();
    await expect(menu.getByRole('button',{name:'Моя тема',exact:true})).toBeVisible();
    await menu.getByRole('button',{name:'GitHub Dark',exact:true}).click();
    await expect.poll(()=>worker.evaluate(async()=>(await chrome.storage.local.get('custom_theme')).custom_theme)).toBe('#0d1117');
    await expect(page.locator('#theme-trigger')).toHaveText('Тема: GitHub Dark');
    await expect(menu.getByRole('button',{name:'GitHub Dark',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(menu.getByRole('button',{name:'Системная',exact:true}).locator('svg')).toHaveCSS('visibility','hidden');
    await expect(menu.getByRole('button',{name:'GitHub Dark',exact:true}).locator('svg')).toHaveCSS('visibility','visible');
    await menu.getByRole('button',{name:'Моя тема',exact:true}).click();
    await expect(page.locator('#theme-trigger')).toHaveText('Тема: Моя тема');
    await expect.poll(()=>worker.evaluate(async()=>(await chrome.storage.local.get('custom_theme')).custom_theme)).toBe('#334455');
    await menu.getByRole('button',{name:'Системная',exact:true}).click();
    await expect.poll(()=>worker.evaluate(async()=>(await chrome.storage.local.get('custom_theme')).custom_theme)).toBe('');
    await expect(page.locator('#theme-trigger')).toHaveText('Тема: Системная');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await open();
    await expect(menu.locator('[data-vkify-theme-menu]')).toHaveCount(1);
    await expect(menu.getByRole('button',{name:'Моя тема',exact:true})).toBeVisible();
  } finally {await context.close();}
});

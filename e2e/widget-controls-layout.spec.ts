import { test, expect } from '@playwright/test';
import { build } from './esbuild-fixture.js';
import { resolve } from 'node:path';

for (const native of [true,false]) test('shared controls, narrow widths and keyboard actions (native popover: '+native+')', async ({ page }, info) => {
  await page.setContent('<style>body{background:#27222d} :root{--vkui--color_background_modal:#292a32;--vkui--color_text_primary:#eee}</style>');
  if (!native) await page.evaluate(()=>Object.defineProperty(HTMLElement.prototype,'showPopover',{value:undefined,configurable:true}));
  const bundle = await build({ stdin:{resolveDir:process.cwd(),contents:`
    import {createFloatingWidget} from './src/content/ui/floating-widget.ts';
    window.chrome={runtime:{id:'fixture'},storage:{local:{get:async()=>({}),set:async()=>{}},onChanged:{addListener(){},removeListener(){}}}};
    const widget=createFloatingWidget({id:'layout',title:'A very long widget title that must truncate',collapsible:true,width:340,initialPosition:{left:8,top:8}});
    widget.aux.textContent='Status information with a long translated description';
    const action=document.createElement('button'); action.type='button'; action.setAttribute('aria-label','An additional action with a very long translated label'); action.innerHTML='<svg width="16" height="16"></svg>';
    action.onclick=()=>{window.actionWasUsed=true}; widget.actions.append(action); widget.mount();
  `},bundle:true,write:false,format:'iife',alias:{'@':resolve('src')} });
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const widget=page.locator('[data-vkify-widget="layout"]');
  const trigger=widget.locator('[data-widget-more]');
  for (const zoom of [1,1.25,2]) for (const width of [160,200,240,340,480]) {
    await widget.evaluate((el,{zoom,width})=>Object.assign((el as HTMLElement).style,{width:width+'px',zoom:String(zoom)}),{zoom,width});
    const offset = await trigger.evaluate(button => {
      const b=button.getBoundingClientRect(), icon=button.querySelector('svg')!.getBoundingClientRect();
      return {x:Math.abs((b.left+b.right-icon.left-icon.right)/2),y:Math.abs((b.top+b.bottom-icon.top-icon.bottom)/2)};
    });
    expect(offset.x).toBeLessThan(.5);
    expect(offset.y).toBeLessThan(.5);
    const bounds=await widget.evaluate(root=>{
      const rect=(el:Element)=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
      return {root:rect(root),controls:[...root.querySelectorAll('.vkify-fw__controls button,.vkify-fw__identity,.vkify-fw__aux')].map(rect)};
    });
    for (const a of bounds.controls) {
      expect(a.left).toBeGreaterThanOrEqual(bounds.root.left);
      expect(a.right).toBeLessThanOrEqual(bounds.root.right);
      for (const b of bounds.controls) if(a!==b) expect(a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top).toBe(true);
    }
  }
  await widget.evaluate(el=>Object.assign((el as HTMLElement).style,{width:'240px',zoom:'1'}));
  await trigger.press('Enter');
  const menu=page.locator('[data-widget-actions]');
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  await expect(menu.locator('button').first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.locator('button').last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menu.locator('button').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole('button',{name:'An additional action with a very long translated label',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).actionWasUsed)).toBe(true);
  await expect(menu).toBeHidden();
  await trigger.click();
  await page.screenshot({path:info.outputPath('widget-actions.png')});
  await page.setViewportSize({width:480,height:500});
  await expect(menu).toBeHidden();
});
